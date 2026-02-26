// Extractor de texto para diferentes tipos de archivos
// Soporta: archivos de texto plano, codigo fuente (~60 extensiones), PDF (via pdfjs-dist local) y Jupyter Notebooks (.ipynb)
// Todo se ejecuta en el navegador, sin servidor

import { EXTENSIONES_SOPORTADAS, NOMBRES_ARCHIVO_CONOCIDOS, extraerExtension } from "./separadores-codigo"

// Resultado de la extraccion
interface ResultadoExtraccion {
  exito: boolean
  texto: string
  error?: string
  metadatos?: {
    paginas?: number
    caracteres: number
  }
}

// Prefijos MIME que son texto (fallback si la extension no esta registrada)
const PREFIJOS_MIME_TEXTO = ["text/", "application/json", "application/xml", "application/javascript", "application/typescript"]

// Limite de caracteres por salida de celda de notebook
const LIMITE_SALIDA_NOTEBOOK = 500

/** Extrae texto de un archivo basandose en su tipo MIME y nombre */
export async function extraerTextoDeArchivo(
  contenidoBase64: string,
  tipoMime: string,
  nombreArchivo: string
): Promise<ResultadoExtraccion> {
  try {
    // Notebooks: parsing JSON especial (antes de la verificacion de texto plano)
    if (nombreArchivo.toLowerCase().endsWith(".ipynb")) {
      return extraerTextoDeNotebook(contenidoBase64)
    }

    if (esArchivoTexto(tipoMime, nombreArchivo)) {
      const texto = decodificarBase64ATexto(contenidoBase64)
      return {
        exito: true,
        texto,
        metadatos: { caracteres: texto.length },
      }
    }

    if (tipoMime === "application/pdf" || nombreArchivo.toLowerCase().endsWith(".pdf"))
      return await extraerTextoDePDF(contenidoBase64)

    return {
      exito: false,
      texto: "",
      error: `Tipo de archivo no soportado para RAG: ${tipoMime}`,
    }
  } catch (error) {
    return {
      exito: false,
      texto: "",
      error: error instanceof Error ? error.message : "Error al extraer texto del archivo",
    }
  }
}

/** Verifica si un archivo es de texto plano o codigo fuente */
function esArchivoTexto(tipoMime: string, nombre: string): boolean {
  const nombreLower = nombre.toLowerCase()

  // Verificar nombres de archivo conocidos sin extension (Dockerfile, Makefile, etc.)
  if (NOMBRES_ARCHIVO_CONOCIDOS.has(nombreLower)) return true

  // Verificar extension en el registro centralizado (excluir .pdf y .ipynb que tienen su propia logica)
  const extension = extraerExtension(nombre)
  if (extension && extension !== ".pdf" && extension !== ".ipynb" && EXTENSIONES_SOPORTADAS.has(extension)) return true

  // Fallback: verificar por prefijo MIME
  return PREFIJOS_MIME_TEXTO.some((prefijo) => tipoMime.startsWith(prefijo))
}

/** Decodifica un Data URL base64 a texto UTF-8 */
function decodificarBase64ATexto(dataUrl: string): string {
  const partes = dataUrl.split(",")
  const base64 = partes[1] || partes[0]
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  return new TextDecoder("utf-8").decode(bytes)
}

/** Convierte Data URL base64 a Uint8Array */
function base64ABytes(dataUrl: string): Uint8Array {
  const partes = dataUrl.split(",")
  const base64 = partes[1] || partes[0]
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

/** Extrae texto de un PDF usando pdfjs-dist con worker local */
async function extraerTextoDePDF(contenidoBase64: string): Promise<ResultadoExtraccion> {
  // Importacion dinamica para evitar SSR (pdfjs-dist usa APIs del navegador)
  const pdfjsLib = await import("pdfjs-dist")

  // Worker local servido desde public/ - sin CDN
  // El archivo se copia automaticamente via postinstall script en package.json
  if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
  }

  const bytes = base64ABytes(contenidoBase64)
  const documento = await pdfjsLib.getDocument({ data: bytes }).promise
  const numPaginas = documento.numPages
  const textosPaginas: string[] = []

  for (let i = 1; i <= numPaginas; i++) {
    const pagina = await documento.getPage(i)
    const contenido = await pagina.getTextContent()

    // Reconstruir texto preservando estructura de lineas
    let textoPagina = ""
    let ultimoY: number | null = null

    for (const item of contenido.items) {
      if (!("str" in item)) continue
      const elemento = item as { str: string; transform: number[]; hasEOL?: boolean }

      // Detectar salto de linea por cambio de posicion Y
      const posY = elemento.transform[5]
      if (ultimoY !== null && Math.abs(posY - ultimoY) > 2) {
        textoPagina += "\n"
      }

      textoPagina += elemento.str

      // pdfjs marca fin de linea explicito
      if (elemento.hasEOL) textoPagina += "\n"

      ultimoY = posY
    }

    const textoLimpio = textoPagina.trim()
    if (textoLimpio) textosPaginas.push(textoLimpio)
  }

  const textoCompleto = textosPaginas.join("\n\n")

  if (!textoCompleto.trim()) {
    return {
      exito: false,
      texto: "",
      error: "El PDF no contiene texto extraible (puede ser un PDF escaneado/imagen)",
    }
  }

  return {
    exito: true,
    texto: textoCompleto,
    metadatos: {
      paginas: numPaginas,
      caracteres: textoCompleto.length,
    },
  }
}

// === Parsing de Jupyter Notebooks (.ipynb) ===

/** Extrae texto semantico de las salidas de una celda de codigo */
function extraerSalidasCelda(outputs: Record<string, unknown>[]): string {
  const textos: string[] = []

  for (const salida of outputs) {
    const tipo = salida.output_type as string

    if (tipo === "stream") {
      const texto = Array.isArray(salida.text) ? (salida.text as string[]).join("") : (salida.text as string) || ""
      const limpio = texto.trim()
      if (limpio) {
        textos.push(limpio.length > LIMITE_SALIDA_NOTEBOOK
          ? limpio.slice(0, LIMITE_SALIDA_NOTEBOOK) + "\n[... output truncated]"
          : limpio)
      }
    } else if (tipo === "execute_result" || tipo === "display_data") {
      const data = salida.data as Record<string, unknown> | undefined
      if (data) {
        const textoPlano = data["text/plain"]
        if (textoPlano) {
          const t = Array.isArray(textoPlano) ? (textoPlano as string[]).join("") : textoPlano as string
          const limpio = t.trim()
          if (limpio) {
            textos.push(limpio.length > LIMITE_SALIDA_NOTEBOOK
              ? limpio.slice(0, LIMITE_SALIDA_NOTEBOOK) + "\n[... output truncated]"
              : limpio)
          }
        }
      }
    } else if (tipo === "error") {
      const nombre = salida.ename as string | undefined
      const valor = salida.evalue as string | undefined
      if (nombre && valor) textos.push(`${nombre}: ${valor}`)
    }
  }

  return textos.join("\n")
}

/** Extrae texto de un Jupyter Notebook (.ipynb) parseando las celdas JSON */
function extraerTextoDeNotebook(contenidoBase64: string): ResultadoExtraccion {
  const textoJSON = decodificarBase64ATexto(contenidoBase64)

  let notebook: {
    cells?: Array<{
      cell_type?: string
      source?: string | string[]
      outputs?: Record<string, unknown>[]
    }>
    metadata?: {
      kernelspec?: { language?: string }
    }
  }

  try {
    notebook = JSON.parse(textoJSON)
  } catch {
    return { exito: false, texto: "", error: "El archivo .ipynb no contiene JSON valido" }
  }

  if (!notebook.cells || !Array.isArray(notebook.cells)) {
    return { exito: false, texto: "", error: "El notebook no contiene celdas" }
  }

  const lenguaje = notebook.metadata?.kernelspec?.language || "python"
  const celdas: string[] = []

  for (const celda of notebook.cells) {
    const fuente = Array.isArray(celda.source) ? celda.source.join("") : celda.source || ""
    if (!fuente.trim()) continue

    switch (celda.cell_type) {
      case "markdown":
        celdas.push(fuente)
        break

      case "code": {
        let textoCelda = "```" + lenguaje + "\n" + fuente + "\n```"
        if (celda.outputs && celda.outputs.length > 0) {
          const salidas = extraerSalidasCelda(celda.outputs)
          if (salidas) textoCelda += "\n\nOutput:\n" + salidas
        }
        celdas.push(textoCelda)
        break
      }

      case "raw":
        celdas.push(fuente)
        break
    }
  }

  const textoCompleto = celdas.join("\n\n---\n\n")

  if (!textoCompleto.trim()) {
    return { exito: false, texto: "", error: "El notebook no contiene texto extraible" }
  }

  return {
    exito: true,
    texto: textoCompleto,
    metadatos: { caracteres: textoCompleto.length },
  }
}
