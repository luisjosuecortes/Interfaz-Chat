// Preprocesamiento de imagenes antes de enviar al LLM
// Redimensiona fotos grandes (ej. 48MP iPhone) a max 2048px y comprime a JPEG/WebP
// Usa createImageBitmap (maneja EXIF automaticamente) + OffscreenCanvas
// Resultado: ~200-400KB en vez de ~15-20MB, sin perdida perceptible para el modelo

const MAX_DIMENSION = 2048
const UMBRAL_PREPROCESAMIENTO = 1024

/** Preprocesa una imagen: redimensiona y comprime si es necesario.
 *  Fotos grandes (>1024px) se escalan a max 2048px y se comprimen.
 *  Imagenes pequeñas y GIFs se devuelven sin cambios. */
export async function preprocesarImagen(
  archivo: File
): Promise<{ dataUrl: string; tipoMime: string }> {
  // GIFs pueden ser animados — no tocar
  if (archivo.type === "image/gif") {
    return leerOriginal(archivo)
  }

  // Decodificar imagen con orientacion EXIF correcta
  const bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" })
  const anchoOriginal = bitmap.width
  const altoOriginal = bitmap.height

  // Imagenes pequeñas: devolver original sin perdida de calidad
  if (anchoOriginal <= UMBRAL_PREPROCESAMIENTO && altoOriginal <= UMBRAL_PREPROCESAMIENTO) {
    bitmap.close()
    return leerOriginal(archivo)
  }

  // Calcular nuevas dimensiones manteniendo proporcion
  let ancho = anchoOriginal
  let alto = altoOriginal

  if (ancho > MAX_DIMENSION || alto > MAX_DIMENSION) {
    const escala = MAX_DIMENSION / Math.max(ancho, alto)
    ancho = Math.round(ancho * escala)
    alto = Math.round(alto * escala)
  }

  // Renderizar en OffscreenCanvas
  const canvas = new OffscreenCanvas(ancho, alto)
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    bitmap.close()
    return leerOriginal(archivo)
  }

  ctx.drawImage(bitmap, 0, 0, ancho, alto)
  bitmap.close()

  // Formato de salida: JPEG para fotos, WebP para PNGs (capturas de pantalla, transparencias)
  const esPNG = archivo.type === "image/png"
  const tipoSalida = esPNG ? "image/webp" : "image/jpeg"
  const calidad = esPNG ? 0.92 : 0.85

  const blob = await canvas.convertToBlob({ type: tipoSalida, quality: calidad })
  const dataUrl = await blobADataUrl(blob)

  return { dataUrl, tipoMime: tipoSalida }
}

/** Lee un archivo como data URL sin modificaciones */
function leerOriginal(archivo: File): Promise<{ dataUrl: string; tipoMime: string }> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve({
      dataUrl: lector.result as string,
      tipoMime: archivo.type,
    })
    lector.onerror = () => reject(new Error("Error al leer archivo de imagen"))
    lector.readAsDataURL(archivo)
  })
}

/** Convierte un Blob a data URL */
function blobADataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(lector.result as string)
    lector.onerror = () => reject(new Error("Error al convertir blob a data URL"))
    lector.readAsDataURL(blob)
  })
}
