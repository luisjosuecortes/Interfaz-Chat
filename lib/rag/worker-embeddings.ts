// Web Worker para pipeline RAG completo
// Pipeline streaming: archivo (ArrayBuffer) → extraccion (yield paginas) → fragmentacion (yield chunks) → vectorizacion (auto-batch)
// Todo ocurre en el Worker: el hilo principal solo recibe progreso y resultados finales
// Soporta WebGPU (GPU ~10x) con fallback a WASM (CPU)
// Pipeline de embeddings: ONNX(384) → Matryoshka(256) → Binario(32 bytes)
// Transferable Objects para cero copias en la transferencia

const MODELO = "mixedbread-ai/mxbai-embed-xsmall-v1"
const LIMITE_CHARS = 16000
const DIM_MATRYOSHKA = 256
const BYTES_BINARIO = DIM_MATRYOSHKA >>> 3 // 32 bytes

// Heuristicas de tamano
const UMBRAL_ARCHIVO_GRANDE = 5 * 1024 * 1024 // 5MB
const TAMANO_FRAGMENTO_NORMAL = 2000
const TAMANO_FRAGMENTO_GRANDE = 3000
const SOLAPAMIENTO_NORMAL = 200
const SOLAPAMIENTO_GRANDE = 300
const CHARS_MINIMO_PAGINA = 100 // Saltar paginas ruido (portadas, indices vacios)
const CHARS_POR_PAGINA_ESTIMADO = 1800 // Estimacion promedio de caracteres por pagina PDF
const PAGINAS_PARALELAS = 4 // Paginas PDF extraidas concurrentemente

// Tipo minimo del pipeline de feature-extraction
interface ResultadoPipeline {
  data: Float32Array
  dims: number[]
}

type FnPipeline = (
  textos: string | string[],
  opciones?: { pooling?: string; normalize?: boolean }
) => Promise<ResultadoPipeline>

let pipe: FnPipeline | null = null
let dispositivo: "webgpu" | "wasm" = "wasm"
let tamanoBatch = 32

// === Utilidades de transferencia ===

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function enviar(mensaje: unknown, transferibles?: Transferable[]) {
  if (transferibles) {
    (self as any).postMessage(mensaje, transferibles)
  } else {
    (self as any).postMessage(mensaje)
  }
}

// === Matematicas de embeddings ===

function normalizar(v: Float32Array): Float32Array {
  let n = 0
  for (let i = 0; i < v.length; i++) n += v[i] * v[i]
  n = Math.sqrt(n)
  if (n > 0) for (let i = 0; i < v.length; i++) v[i] /= n
  return v
}

function truncarMatryoshka(emb: Float32Array): Float32Array {
  const t = new Float32Array(DIM_MATRYOSHKA)
  t.set(emb.subarray(0, DIM_MATRYOSHKA))
  return normalizar(t)
}

/** Cuantizacion binaria: Float32Array[256] → Uint8Array[32] */
function cuantizarBinario(embedding: Float32Array): Uint8Array {
  const binario = new Uint8Array(BYTES_BINARIO)
  for (let i = 0; i < embedding.length; i++) {
    if (embedding[i] >= 0) binario[i >>> 3] |= (1 << (7 - (i & 7)))
  }
  return binario
}

// === Deteccion de hardware ===

async function detectarWebGPU(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gpu = (navigator as any).gpu
    if (!gpu) return false
    const adapter = await gpu.requestAdapter()
    return adapter !== null
  } catch { return false }
}

// === Inicializacion del modelo ONNX ===

async function inicializar() {
  const { pipeline, env } = await import("@huggingface/transformers")

  env.allowLocalModels = false
  env.useBrowserCache = true
  env.allowRemoteModels = true

  const webgpu = await detectarWebGPU()
  dispositivo = webgpu ? "webgpu" : "wasm"
  let dtype: "fp32" | "q8" = webgpu ? "fp32" : "q8"

  // Auto-tuning: batch moderado para GPU, pequeno para CPU (mas actualizaciones de progreso)
  tamanoBatch = webgpu ? 64 : 16

  enviar({ tipo: "info", device: dispositivo, dtype, tamanoBatch })

  try {
    const p = await pipeline("feature-extraction", MODELO, {
      device: dispositivo,
      dtype,
      progress_callback: (d: Record<string, unknown>) => {
        if (typeof d.progress === "number") enviar({ tipo: "progresoCarga", progreso: d.progress })
      },
    })
    pipe = p as unknown as FnPipeline
  } catch {
    if (dispositivo === "webgpu") {
      dispositivo = "wasm"
      dtype = "q8"
      tamanoBatch = 16
      enviar({ tipo: "info", device: dispositivo, dtype, tamanoBatch })

      const p = await pipeline("feature-extraction", MODELO, {
        device: "wasm",
        dtype: "q8",
        progress_callback: (d: Record<string, unknown>) => {
          if (typeof d.progress === "number") enviar({ tipo: "progresoCarga", progreso: d.progress })
        },
      })
      pipe = p as unknown as FnPipeline
    } else {
      throw new Error("No se pudo cargar el modelo de embeddings")
    }
  }

  enviar({ tipo: "listo", device: dispositivo })
}

// === EXTRACCION: async generator que yield paginas ===

/** Limpia texto removiendo espacios y saltos excesivos */
function limpiarTexto(texto: string): string {
  return texto
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim()
}

// Interfaz minima para el documento PDF (evita dependencia directa de pdfjs-dist types)
interface PaginaPDF {
  getTextContent(params?: { disableNormalization?: boolean }): Promise<{ items: Record<string, unknown>[] }>
}

interface DocPDF {
  numPages: number
  getPage(num: number): Promise<PaginaPDF>
}

/** Extrae texto de una sola pagina PDF */
async function extraerTextoPagina(docPDF: DocPDF, numPagina: number): Promise<string> {
  const pagina = await docPDF.getPage(numPagina)
  const contenido = await pagina.getTextContent({ disableNormalization: true })

  let texto = ""
  let ultimoY: number | null = null

  for (const item of contenido.items) {
    if (!("str" in item)) continue
    const elem = item as { str: string; transform: number[]; hasEOL?: boolean }

    const posY = elem.transform[5]
    if (ultimoY !== null && Math.abs(posY - ultimoY) > 2) texto += "\n"

    texto += elem.str
    if (elem.hasEOL) texto += "\n"
    ultimoY = posY
  }

  return texto.trim()
}

/** Extrae paginas de un PDF en lotes paralelos (yield por pagina, en orden).
 *  Usa Promise.all para extraer PAGINAS_PARALELAS concurrentemente. */
async function* extraerPaginasPDF(
  idMensaje: number,
  docPDF: DocPDF,
  esGrande: boolean
): AsyncGenerator<string> {
  const totalPaginas = docPDF.numPages

  for (let lote = 1; lote <= totalPaginas; lote += PAGINAS_PARALELAS) {
    const fin = Math.min(lote + PAGINAS_PARALELAS, totalPaginas + 1)
    const indices = Array.from({ length: fin - lote }, (_, j) => lote + j)

    // Extraer paginas en paralelo (pdfjs usa su propio sub-worker)
    const textos = await Promise.all(
      indices.map(i => extraerTextoPagina(docPDF, i))
    )

    // Yield en orden preservando la secuencia del documento
    for (let j = 0; j < textos.length; j++) {
      const textoLimpio = textos[j]

      // Heuristica: saltar paginas con poco contenido (portadas, indices vacios)
      if (!(esGrande && textoLimpio.length < CHARS_MINIMO_PAGINA) && textoLimpio) {
        yield textoLimpio + "\n\n"
      }

      enviar({ tipo: "progresoExtraccion", id: idMensaje, pagina: lote + j, totalPaginas })
    }
  }
}

/** Extrae texto de un archivo como stream de paginas/secciones */
async function* extraerPaginas(
  idMensaje: number,
  archivo: ArrayBuffer,
  tipoMime: string,
  nombre: string,
  esGrande: boolean,
  docPDF?: DocPDF
): AsyncGenerator<string> {
  if (docPDF) {
    yield* extraerPaginasPDF(idMensaje, docPDF, esGrande)
  } else {
    // Texto plano: decodificar y yield completo
    const texto = new TextDecoder("utf-8").decode(archivo)
    yield limpiarTexto(texto)
  }
}

// === FRAGMENTACION STREAMING: async generator que yield chunks ===

/** Busca un punto natural para cortar el texto */
function encontrarPuntoCorte(texto: string, tamano: number): number {
  if (texto.length <= tamano) return texto.length

  const ventana = texto.slice(0, tamano + 100)

  // 1. Fin de parrafo
  const posParrafo = ventana.lastIndexOf("\n\n", tamano)
  if (posParrafo > tamano * 0.7) return posParrafo + 2

  // 2. Fin de oracion
  for (const marca of [". ", "! ", "? ", ".\n", "!\n", "?\n"]) {
    const pos = ventana.lastIndexOf(marca, tamano)
    if (pos > tamano * 0.7) return pos + marca.length
  }

  // 3. Salto de linea
  const posLinea = ventana.lastIndexOf("\n", tamano)
  if (posLinea > tamano * 0.8) return posLinea + 1

  // 4. Espacio
  const posEspacio = ventana.lastIndexOf(" ", tamano)
  if (posEspacio > tamano * 0.9) return posEspacio + 1

  return tamano
}

interface FragmentoStream {
  texto: string
  indice: number
  inicio: number
  fin: number
}

/** Fragmenta un stream de paginas en chunks con solapamiento (yield por chunk) */
async function* fragmentarStream(
  paginas: AsyncGenerator<string>,
  tamanoFragmento: number,
  solapamiento: number
): AsyncGenerator<FragmentoStream> {
  let buffer = ""
  let posicionGlobal = 0
  let indice = 0

  for await (const pagina of paginas) {
    buffer += pagina

    while (buffer.length >= tamanoFragmento) {
      const punto = encontrarPuntoCorte(buffer, tamanoFragmento)
      const texto = buffer.slice(0, punto).trim()

      if (texto.length > 0) {
        yield { texto, indice: indice++, inicio: posicionGlobal, fin: posicionGlobal + punto }
      }

      const avance = Math.max(punto - solapamiento, 1)
      buffer = buffer.slice(avance)
      posicionGlobal += avance
    }
  }

  // Drenaje: ultimo fragmento
  const textoFinal = buffer.trim()
  if (textoFinal.length > 0) {
    yield { texto: textoFinal, indice: indice++, inicio: posicionGlobal, fin: posicionGlobal + buffer.length }
  }
}

// === VECTORIZACION: auto-batch con Matryoshka + binario ===

/** Vectoriza un batch de fragmentos y envia resultados al hilo principal */
async function vectorizarYEnviarBatch(
  id: number,
  batch: FragmentoStream[],
  offset: number
) {
  if (!pipe) throw new Error("Pipeline no inicializado")

  const textos = batch.map(f => f.texto.slice(0, LIMITE_CHARS))
  const resultado = await pipe(textos, { pooling: "mean", normalize: true })

  const dimOrig = resultado.dims[1]
  const cantidad = resultado.dims[0]

  // Matryoshka + cuantizacion binaria
  const embeddings = new Uint8Array(cantidad * BYTES_BINARIO)
  for (let i = 0; i < cantidad; i++) {
    const completo = resultado.data.slice(i * dimOrig, (i + 1) * dimOrig)
    const truncado = truncarMatryoshka(completo)
    const binario = cuantizarBinario(truncado)
    embeddings.set(binario, i * BYTES_BINARIO)
  }

  // Metadatos de fragmentos (texto + posiciones)
  const fragmentos = batch.map(f => ({
    texto: f.texto,
    indice: f.indice,
    inicio: f.inicio,
    fin: f.fin,
  }))

  enviar(
    { tipo: "batchProcesado", id, fragmentos, embeddings, cantidad, procesados: offset + cantidad },
    [embeddings.buffer]
  )
}

// === PIPELINE COMPLETO: archivo → extraccion → fragmentacion → vectorizacion ===

async function procesarArchivo(id: number, archivo: ArrayBuffer, nombre: string, tipoMime: string) {
  if (!pipe) throw new Error("Pipeline no inicializado")

  const esGrande = archivo.byteLength > UMBRAL_ARCHIVO_GRANDE
  const tamanoFragmento = esGrande ? TAMANO_FRAGMENTO_GRANDE : TAMANO_FRAGMENTO_NORMAL
  const solapamiento = esGrande ? SOLAPAMIENTO_GRANDE : SOLAPAMIENTO_NORMAL
  const esPDF = tipoMime === "application/pdf" || nombre.toLowerCase().endsWith(".pdf")

  // Abrir PDF temprano para obtener numPages y estimar fragmentos
  let docPDF: DocPDF | undefined
  let fragmentosEstimados: number

  if (esPDF) {
    const pdfjs = await import("pdfjs-dist")
    // pdfjs-dist v5 requiere workerSrc configurado explicitamente
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
    }
    const doc = await pdfjs.getDocument({ data: archivo }).promise
    docPDF = doc as unknown as DocPDF
    fragmentosEstimados = Math.max(1, Math.ceil(
      doc.numPages * CHARS_POR_PAGINA_ESTIMADO / (tamanoFragmento - solapamiento)
    ))
  } else {
    fragmentosEstimados = Math.max(1, Math.ceil(
      archivo.byteLength / (tamanoFragmento - solapamiento)
    ))
  }

  enviar({ tipo: "progresoArchivo", id, fase: "extrayendo", fragmentosEstimados })

  // Pipeline streaming con async generators:
  // extraerPaginas yield→ fragmentarStream yield→ acumular en batch → vectorizar
  const paginas = extraerPaginas(id, archivo, tipoMime, nombre, esGrande, docPDF)
  const fragmentos = fragmentarStream(paginas, tamanoFragmento, solapamiento)

  let batch: FragmentoStream[] = []
  let totalProcesados = 0

  for await (const fragmento of fragmentos) {
    batch.push(fragmento)

    if (batch.length >= tamanoBatch) {
      enviar({ tipo: "progresoArchivo", id, fase: "vectorizando", procesados: totalProcesados })
      await vectorizarYEnviarBatch(id, batch, totalProcesados)
      totalProcesados += batch.length
      batch = []
    }
  }

  // Drenaje final: procesar fragmentos restantes sin esperar a llenar el batch
  if (batch.length > 0) {
    enviar({ tipo: "progresoArchivo", id, fase: "vectorizando", procesados: totalProcesados })
    await vectorizarYEnviarBatch(id, batch, totalProcesados)
    totalProcesados += batch.length
  }

  enviar({ tipo: "archivoCompleto", id, totalFragmentos: totalProcesados })
}

// === EMBEDDINGS DE CONSULTA (para busqueda) ===

/** Genera embeddings binarios para un batch de textos (usado para consultas de busqueda) */
async function procesarBatchConsulta(id: number, textos: string[]) {
  if (!pipe) throw new Error("Pipeline no inicializado")

  const truncados = textos.map(t => t.slice(0, LIMITE_CHARS))
  const resultado = await pipe(truncados, { pooling: "mean", normalize: true })

  const dimOrig = resultado.dims[1]
  const cantidad = resultado.dims[0]

  const flat = new Uint8Array(cantidad * BYTES_BINARIO)
  for (let i = 0; i < cantidad; i++) {
    const completo = resultado.data.slice(i * dimOrig, (i + 1) * dimOrig)
    const truncado = truncarMatryoshka(completo)
    const binario = cuantizarBinario(truncado)
    flat.set(binario, i * BYTES_BINARIO)
  }

  enviar(
    { tipo: "resultadoBatch", id, datos: flat, cantidad },
    [flat.buffer]
  )
}

// === HANDLER DE MENSAJES ===

self.onmessage = async (event: MessageEvent) => {
  const msg = event.data
  try {
    switch (msg.tipo) {
      case "inicializar":
        await inicializar()
        break
      case "procesarArchivo":
        await procesarArchivo(msg.id, msg.archivo, msg.nombre, msg.tipoMime)
        break
      case "embedSingle":
        await procesarBatchConsulta(msg.id, [msg.texto])
        break
      case "embedBatch":
        await procesarBatchConsulta(msg.id, msg.textos)
        break
    }
  } catch (error) {
    enviar({
      tipo: "error",
      id: msg.id,
      mensaje: error instanceof Error ? error.message : "Error en worker RAG",
    })
  }
}
