// Motor de embeddings: proxy hacia Web Worker con fallback a hilo principal
// Pipeline completo: archivo → Worker (extraccion + fragmentacion + vectorizacion)
// Soporta dos modos de operacion:
//   1. Web Worker (prioritario): pipeline streaming completo fuera del hilo principal (UI a 60 FPS)
//   2. Hilo principal (fallback): si el Worker falla (CSP, Workers anidados, falta de RAM),
//      se descarga el pipeline via import() dinamico y se procesa en el hilo de React
// Patron: tolerancia a fallos con importacion dinamica lazy

const DIMENSION_MATRYOSHKA = 256
const BYTES_BINARIO = DIMENSION_MATRYOSHKA >>> 3 // 32 bytes
const MODELO_EMBEDDINGS = "mixedbread-ai/mxbai-embed-xsmall-v1"
const LIMITE_CARACTERES = 16000
const TAMANO_BATCH_FALLBACK = 16

// Estado del motor
let estadoCarga: "inactivo" | "cargando" | "listo" | "error" = "inactivo"
let dispositivoUsado = "pendiente"

// Web Worker
let worker: Worker | null = null
let workerListo = false
let modoFallback = false
let promesaInicializacion: Promise<void> | null = null
let contadorMensajes = 0

// Cola de serializacion: solo un archivo se procesa en el Worker a la vez
// para evitar interleaving de inferencia ONNX concurrente
let archivoEnProceso = false
const colaArchivos: Array<() => void> = []

// Fallback: pipeline directamente en el hilo principal (se carga solo si el Worker falla)
interface PipelineEmbeddings {
  (textos: string | string[], opciones?: { pooling?: string; normalize?: boolean }): Promise<{
    data: Float32Array
    dims: number[]
  }>
}
let pipelinePrincipal: PipelineEmbeddings | null = null

// === Tipos para procesamiento de archivos ===

/** Fragmento procesado con embeddings duales (resultado del pipeline completo):
 *  - embedding: binario 32 bytes (Hamming, fase 1)
 *  - embeddingFloat: Float32 Matryoshka 256 dims (cosine, fase 2 re-ranking) */
export interface FragmentoProcesado {
  texto: string
  indice: number
  inicio: number
  fin: number
  embedding: Uint8Array
  embeddingFloat: Float32Array
}

/** Callback de progreso del procesamiento de archivos */
export interface CallbackProgresoArchivo {
  (datos: {
    fase: "extrayendo" | "fragmentando" | "vectorizando"
    procesados?: number
    pagina?: number
    totalPaginas?: number
    porcentaje?: number
  }): void
}

// === Promesas pendientes ===

// Consultas de embedding (busqueda) — retorna binario + Float32
const pendientes = new Map<number, {
  resolve: (embeddings: Uint8Array[], embeddingsFloat: Float32Array[]) => void
  reject: (error: Error) => void
}>()

// Procesamiento de archivos completos
const pendientesArchivo = new Map<number, {
  resolve: (fragmentos: FragmentoProcesado[]) => void
  reject: (error: Error) => void
  fragmentos: FragmentoProcesado[]
  alProgreso?: CallbackProgresoArchivo
  fragmentosEstimados?: number
  totalPaginas?: number
  esPDF?: boolean
}>()


// === Matryoshka + Cuantizacion binaria (duplicadas del Worker, necesarias para fallback) ===

function normalizar(v: Float32Array): Float32Array {
  let n = 0
  for (let i = 0; i < v.length; i++) n += v[i] * v[i]
  n = Math.sqrt(n)
  if (n > 0) for (let i = 0; i < v.length; i++) v[i] /= n
  return v
}

function truncarMatryoshka(emb: Float32Array): Float32Array {
  const t = new Float32Array(DIMENSION_MATRYOSHKA)
  t.set(emb.subarray(0, DIMENSION_MATRYOSHKA))
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

// === Deteccion de hardware (para fallback en hilo principal) ===

async function detectarWebGPU(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gpu = (navigator as any).gpu
    if (!gpu) return false
    const adapter = await gpu.requestAdapter()
    return adapter !== null
  } catch { return false }
}

// === Progreso unificado ===

/** Calcula porcentaje unificado de progreso (0-99) */
function calcularPorcentaje(
  procesados: number,
  fragmentosEstimados: number,
  esPDF: boolean
): number {
  const pesoExtraccion = esPDF ? 30 : 0
  const pesoVectorizacion = 100 - pesoExtraccion
  const porcentaje = pesoExtraccion + Math.round(procesados / fragmentosEstimados * pesoVectorizacion)
  return Math.min(porcentaje, 99)
}

// === Mensajes del Worker ===

/** Procesa mensajes recibidos del Worker */
function manejarMensajeWorker(data: Record<string, unknown>) {
  switch (data.tipo) {
    case "progresoCarga":
      break
    case "info":
      dispositivoUsado = data.device as string
      break
    case "listo":
      workerListo = true
      estadoCarga = "listo"
      dispositivoUsado = data.device as string
      break

    // Respuesta a embeddings de consulta (busqueda)
    case "resultadoBatch": {
      const p = pendientes.get(data.id as number)
      if (p) {
        const flat = data.datos as Uint8Array
        const flatFloat = data.datosFloat as Float32Array
        const cant = data.cantidad as number
        const embeddings: Uint8Array[] = []
        const embeddingsFloat: Float32Array[] = []
        for (let i = 0; i < cant; i++) {
          embeddings.push(flat.slice(i * BYTES_BINARIO, (i + 1) * BYTES_BINARIO))
          embeddingsFloat.push(flatFloat.slice(i * DIMENSION_MATRYOSHKA, (i + 1) * DIMENSION_MATRYOSHKA))
        }
        p.resolve(embeddings, embeddingsFloat)
        pendientes.delete(data.id as number)
      }
      break
    }

    // Progreso de procesamiento de archivos
    case "progresoArchivo": {
      const pa = pendientesArchivo.get(data.id as number)
      if (!pa) break

      // Guardar estimacion de fragmentos (viene en el primer mensaje)
      if (typeof data.fragmentosEstimados === "number") {
        pa.fragmentosEstimados = data.fragmentosEstimados
      }

      if (pa.alProgreso) {
        let porcentaje: number | undefined
        const procesados = data.procesados as number | undefined
        const fase = data.fase as "extrayendo" | "vectorizando"

        if (fase === "vectorizando" && procesados !== undefined && pa.fragmentosEstimados) {
          porcentaje = calcularPorcentaje(procesados, pa.fragmentosEstimados, !!pa.esPDF)
        } else if (fase === "extrayendo") {
          porcentaje = 0
        }

        pa.alProgreso({ fase, procesados, porcentaje })
      }
      break
    }

    case "progresoExtraccion": {
      const pa = pendientesArchivo.get(data.id as number)
      if (!pa) break

      const pagina = data.pagina as number
      const totalPaginas = data.totalPaginas as number

      // Marcar como PDF y guardar totalPaginas
      pa.esPDF = true
      pa.totalPaginas = totalPaginas

      if (pa.alProgreso) {
        const porcentaje = Math.round(pagina / totalPaginas * 30)
        pa.alProgreso({ fase: "extrayendo", pagina, totalPaginas, porcentaje })
      }
      break
    }

    // Batch de fragmentos procesados (resultado parcial)
    case "batchProcesado": {
      const pa = pendientesArchivo.get(data.id as number)
      if (pa) {
        const metadatos = data.fragmentos as { texto: string; indice: number; inicio: number; fin: number }[]
        const embeddings = data.embeddings as Uint8Array
        const embeddingsFloat = data.embeddingsFloat as Float32Array
        const cant = data.cantidad as number

        for (let i = 0; i < cant; i++) {
          pa.fragmentos.push({
            ...metadatos[i],
            embedding: embeddings.slice(i * BYTES_BINARIO, (i + 1) * BYTES_BINARIO),
            embeddingFloat: embeddingsFloat.slice(i * DIMENSION_MATRYOSHKA, (i + 1) * DIMENSION_MATRYOSHKA),
          })
        }

        if (pa.alProgreso) {
          const procesados = data.procesados as number
          let porcentaje: number | undefined
          if (pa.fragmentosEstimados) {
            porcentaje = calcularPorcentaje(procesados, pa.fragmentosEstimados, !!pa.esPDF)
          }
          pa.alProgreso({ fase: "vectorizando", procesados, porcentaje })
        }
      }
      break
    }

    // Archivo completamente procesado
    case "archivoCompleto": {
      const pa = pendientesArchivo.get(data.id as number)
      if (pa) {
        // Enviar 100% antes de resolver para transicion suave
        pa.alProgreso?.({ fase: "vectorizando", porcentaje: 100 })
        pa.resolve(pa.fragmentos)
        pendientesArchivo.delete(data.id as number)
      }
      break
    }

    case "error": {
      const id = data.id as number | undefined
      if (id !== undefined) {
        // Puede ser error de consulta o de archivo
        const p = pendientes.get(id)
        if (p) {
          p.reject(new Error(data.mensaje as string))
          pendientes.delete(id)
        }
        const pa = pendientesArchivo.get(id)
        if (pa) {
          pa.reject(new Error(data.mensaje as string))
          pendientesArchivo.delete(id)
        }
      }
      break
    }
  }
}

// === Inicializacion ===

/** Intenta inicializar via Web Worker */
function inicializarConWorker(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (typeof Worker === "undefined") {
      reject(new Error("Web Workers no disponibles"))
      return
    }

    try {
      worker = new Worker(
        new URL("./worker-embeddings.ts", import.meta.url),
        { type: "module" }
      )
    } catch (e) {
      reject(e)
      return
    }

    let resuelto = false

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as Record<string, unknown>

      if (!resuelto && data.tipo === "listo") {
        resuelto = true
        manejarMensajeWorker(data)
        resolve()
        return
      }

      if (!resuelto && data.tipo === "error" && data.id === undefined) {
        resuelto = true
        reject(new Error(data.mensaje as string))
        return
      }

      manejarMensajeWorker(data)
    }

    worker.onerror = (e) => {
      if (!resuelto) {
        resuelto = true
        reject(new Error(e.message || "Error en Web Worker"))
      }
    }

    worker.postMessage({ tipo: "inicializar" })
  })
}

/** Fallback: inicializa el modelo directamente en el hilo principal
 *  Se activa solo si el Worker falla (CSP, Workers anidados, falta de RAM).
 *  Usa import() dinamico para no cargar @huggingface/transformers en el bundle principal. */
async function inicializarEnHiloPrincipal(): Promise<void> {
  const { pipeline, env } = await import("@huggingface/transformers")

  env.allowLocalModels = false
  env.useBrowserCache = true
  env.allowRemoteModels = true

  const webgpu = await detectarWebGPU()
  dispositivoUsado = webgpu ? "webgpu" : "wasm"
  const dtype: "fp32" | "q8" = webgpu ? "fp32" : "q8"

  try {
    const p = await pipeline("feature-extraction", MODELO_EMBEDDINGS, {
      device: dispositivoUsado as "webgpu" | "wasm",
      dtype,
      progress_callback: () => { },
    })
    pipelinePrincipal = p as unknown as PipelineEmbeddings
  } catch {
    if (dispositivoUsado === "webgpu") {
      dispositivoUsado = "wasm"
      const p = await pipeline("feature-extraction", MODELO_EMBEDDINGS, {
        device: "wasm",
        dtype: "q8",
        progress_callback: () => { },
      })
      pipelinePrincipal = p as unknown as PipelineEmbeddings
    } else {
      throw new Error("No se pudo cargar el modelo de embeddings")
    }
  }

  estadoCarga = "listo"
}

/** Inicializa el motor: Web Worker con fallback a hilo principal.
 *  Si el Worker falla por cualquier razon (CSP, Workers anidados, falta de RAM),
 *  descarga el pipeline via import() dinamico y procesa en React. */
async function inicializar(): Promise<void> {
  if (promesaInicializacion) return promesaInicializacion
  if (estadoCarga === "listo") return

  estadoCarga = "cargando"

  promesaInicializacion = (async () => {
    try {
      await inicializarConWorker()
    } catch (errorWorker) {
      console.warn(
        "[RAG] Web Worker no disponible, usando hilo principal:",
        errorWorker instanceof Error ? errorWorker.message : errorWorker
      )
      modoFallback = true
      await inicializarEnHiloPrincipal()
    }
  })()

  try {
    await promesaInicializacion
  } catch (error) {
    estadoCarga = "error"
    promesaInicializacion = null
    throw error
  }
}

// === Utilidades ===

/** Decodifica un Data URL base64 a ArrayBuffer usando el decodificador nativo del navegador */
async function decodificarBase64(dataUrl: string): Promise<ArrayBuffer> {
  const respuesta = await fetch(dataUrl)
  return respuesta.arrayBuffer()
}

// === Fallback: pipeline completo en hilo principal ===

/** Procesa un archivo completamente en el hilo principal (fallback sin Worker).
 *  Usa import() dinamico para cargar extractor y fragmentador solo cuando se necesitan.
 *  Reporta progreso con porcentaje unificado (0-100%) igual que el Worker. */
async function procesarArchivoEnHiloPrincipal(
  contenidoBase64: string,
  tipoMime: string,
  nombre: string,
  alProgreso?: CallbackProgresoArchivo
): Promise<FragmentoProcesado[]> {
  if (!pipelinePrincipal) throw new Error("Pipeline no inicializado")

  const esPDF = tipoMime === "application/pdf" || nombre.toLowerCase().endsWith(".pdf")

  // Fase 1: Extraer texto (import dinamico — solo se descarga si el Worker fallo)
  alProgreso?.({ fase: "extrayendo", porcentaje: 0 })
  const { extraerTextoDeArchivo } = await import("./extractor-texto")
  const resultado = await extraerTextoDeArchivo(contenidoBase64, tipoMime, nombre)

  if (!resultado.exito || !resultado.texto.trim()) {
    throw new Error(resultado.error || "No se pudo extraer texto del archivo")
  }

  // Fase 2: Fragmentar (import dinamico)
  alProgreso?.({ fase: "fragmentando", porcentaje: esPDF ? 30 : 5 })
  const { fragmentarTexto } = await import("./fragmentador-texto")
  const fragmentos = fragmentarTexto(resultado.texto)

  if (fragmentos.length === 0) throw new Error("El documento no contiene texto procesable")

  // Fase 3: Vectorizar en batches con progreso
  const totalFragmentos = fragmentos.length
  const resultados: FragmentoProcesado[] = []

  for (let i = 0; i < totalFragmentos; i += TAMANO_BATCH_FALLBACK) {
    const batch = fragmentos.slice(i, i + TAMANO_BATCH_FALLBACK)
    const textos = batch.map(f => f.texto.slice(0, LIMITE_CARACTERES))

    const salida = await pipelinePrincipal(textos, { pooling: "mean", normalize: true })
    const dimOrig = salida.dims[1]

    for (let j = 0; j < batch.length; j++) {
      const completo = salida.data.slice(j * dimOrig, (j + 1) * dimOrig)
      const truncado = truncarMatryoshka(completo)
      resultados.push({
        texto: batch[j].texto,
        indice: batch[j].indice,
        inicio: batch[j].inicio,
        fin: batch[j].fin,
        embedding: cuantizarBinario(truncado),
        embeddingFloat: truncado,
      })
    }

    const procesados = i + batch.length
    const porcentaje = calcularPorcentaje(procesados, totalFragmentos, esPDF)
    alProgreso?.({ fase: "vectorizando", procesados, porcentaje })
  }

  // 100% explicito antes de terminar
  alProgreso?.({ fase: "vectorizando", porcentaje: 100 })

  return resultados
}

// === API publica ===

/** Procesa un archivo completo: extraccion + fragmentacion + vectorizacion.
 *  En modo Worker: envia el ArrayBuffer crudo via Transferable Objects (zero-copy).
 *  En modo fallback: usa extractor + fragmentador + embeddings en el hilo principal. */
export async function procesarArchivoCompleto(
  contenidoBase64: string,
  nombre: string,
  tipoMime: string,
  alProgreso?: CallbackProgresoArchivo
): Promise<FragmentoProcesado[]> {
  await inicializar()

  if (!modoFallback && worker && workerListo) {
    // Decodificar base64 fuera de la cola (rapido, no necesita serializacion)
    const archivo = await decodificarBase64(contenidoBase64)

    // Esperar turno en la cola: solo un archivo viaja al Worker a la vez
    if (archivoEnProceso) {
      await new Promise<void>(resolve => colaArchivos.push(resolve))
    }
    archivoEnProceso = true

    try {
      return await new Promise<FragmentoProcesado[]>((resolve, reject) => {
        const id = contadorMensajes++

        pendientesArchivo.set(id, {
          resolve,
          reject,
          fragmentos: [],
          alProgreso,
        })

        // Transferable: el ArrayBuffer se mueve al Worker sin copiar
        worker!.postMessage(
          { tipo: "procesarArchivo", id, archivo, nombre, tipoMime },
          [archivo]
        )
      })
    } finally {
      archivoEnProceso = false
      const siguiente = colaArchivos.shift()
      if (siguiente) siguiente()
    }
  }

  // Fallback: procesar en hilo principal usando extractor + fragmentador (import dinamico)
  return procesarArchivoEnHiloPrincipal(contenidoBase64, tipoMime, nombre, alProgreso)
}

/** Resultado de generarEmbedding: incluye ambas representaciones para Two-Stage Retrieval */
export interface EmbeddingConsulta {
  binario: Uint8Array       // 32 bytes, para filtrado Hamming rapido
  float: Float32Array       // 256 dims, para re-ranking cosine preciso
}

/** Genera embeddings duales (binario + Float32) para un texto de consulta */
export async function generarEmbedding(texto: string): Promise<EmbeddingConsulta> {
  await inicializar()

  if (!modoFallback && worker && workerListo) {
    return new Promise<EmbeddingConsulta>((resolve, reject) => {
      const id = contadorMensajes++
      pendientes.set(id, {
        resolve: (embeddings, embeddingsFloat) => resolve({
          binario: embeddings[0],
          float: embeddingsFloat[0],
        }),
        reject,
      })
      worker!.postMessage({ tipo: "embedSingle", id, texto })
    })
  }

  // Fallback: hilo principal
  if (!pipelinePrincipal) throw new Error("Pipeline no inicializado")
  const resultado = await pipelinePrincipal(texto.slice(0, LIMITE_CARACTERES), {
    pooling: "mean",
    normalize: true,
  })
  const truncado = truncarMatryoshka(resultado.data)
  return {
    binario: cuantizarBinario(truncado),
    float: truncado,
  }
}
