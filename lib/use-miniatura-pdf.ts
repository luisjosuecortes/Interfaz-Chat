"use client"

import { useState, useEffect } from "react"

// Cache global: evita re-renderizar PDFs ya procesados
const cacheMiniatura = new Map<string, string>()

/** Hook que genera una miniatura PNG de la primera pagina de un PDF.
 *  Usa pdfjs-dist (ya instalado) con import dinamico para evitar SSR. */
export function useMiniaturaPDF(
  adjuntoId: string | undefined,
  contenidoBase64: string | undefined,
  esPDF: boolean
): string | null {
  const [miniatura, establecerMiniatura] = useState<string | null>(() => {
    if (!adjuntoId) return null
    return cacheMiniatura.get(adjuntoId) ?? null
  })

  useEffect(() => {
    if (!esPDF || !adjuntoId || !contenidoBase64) return
    if (cacheMiniatura.has(adjuntoId)) {
      establecerMiniatura(cacheMiniatura.get(adjuntoId)!)
      return
    }

    let cancelado = false

    async function generar() {
      try {
        const pdfjsLib = await import("pdfjs-dist")

        if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
        }

        // Decodificar base64 a bytes
        const partes = contenidoBase64!.split(",")
        const base64 = partes[1] || partes[0]
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))

        const documento = await pdfjsLib.getDocument({ data: bytes }).promise
        const pagina = await documento.getPage(1)

        // Renderizar a canvas offscreen
        const ANCHO_OBJETIVO = 160
        const escala = (ANCHO_OBJETIVO * Math.min(window.devicePixelRatio, 2)) / pagina.getViewport({ scale: 1 }).width
        const viewport = pagina.getViewport({ scale: escala })

        const canvas = document.createElement("canvas")
        canvas.width = viewport.width
        canvas.height = viewport.height

        const ctx = canvas.getContext("2d")!
        await pagina.render({ canvasContext: ctx, viewport, canvas } as Parameters<typeof pagina.render>[0]).promise

        if (cancelado) return

        canvas.toBlob((blob) => {
          if (!blob || cancelado) return
          const objectUrl = URL.createObjectURL(blob)
          cacheMiniatura.set(adjuntoId!, objectUrl)
          establecerMiniatura(objectUrl)
        }, "image/png", 0.8)

        documento.destroy()
      } catch {
        // Silencioso: si falla, el componente muestra el icono normal
      }
    }

    generar()

    return () => { cancelado = true }
  }, [adjuntoId, contenidoBase64, esPDF])

  return miniatura
}

/** Limpia la miniatura de la memoria RAM global usando URL.revokeObjectURL */
export function limpiarCacheMiniaturaPDF(adjuntoId: string) {
  const url = cacheMiniatura.get(adjuntoId)
  if (url) {
    URL.revokeObjectURL(url)
    cacheMiniatura.delete(adjuntoId)
  }
}
