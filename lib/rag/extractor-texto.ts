// Extractor de texto para diferentes tipos de archivos
// Soporta: archivos de texto plano y PDF (via pdfjs-dist local)
// Todo se ejecuta en el navegador, sin servidor

import { EXTENSIONES_SOPORTADAS } from "./separadores-codigo"

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

// Prefijos MIME que son texto
const PREFIJOS_MIME_TEXTO = ["text/", "application/json", "application/xml"]

/** Extrae texto de un archivo basandose en su tipo MIME y nombre */
export async function extraerTextoDeArchivo(
  contenidoBase64: string,
  tipoMime: string,
  nombreArchivo: string
): Promise<ResultadoExtraccion> {
  try {
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

/** Verifica si un archivo es de texto plano */
function esArchivoTexto(tipoMime: string, nombre: string): boolean {
  const extension = nombre.toLowerCase().slice(nombre.lastIndexOf("."))
  return (
    EXTENSIONES_SOPORTADAS.has(extension) ||
    PREFIJOS_MIME_TEXTO.some((prefijo) => tipoMime.startsWith(prefijo))
  )
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
