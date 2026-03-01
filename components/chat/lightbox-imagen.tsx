"use client"

import { useEffect, useCallback } from "react"
import { X } from "lucide-react"
import { createPortal } from "react-dom"

interface PropiedadesLightbox {
  src: string
  alt: string
  alCerrar: () => void
}

/** Lightbox modal para visualizar imagenes en grande.
 *  Se cierra con Escape, click fuera de la imagen, o boton X. */
export function LightboxImagen({ src, alt, alCerrar }: PropiedadesLightbox) {
  const manejarTecla = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") alCerrar()
  }, [alCerrar])

  useEffect(() => {
    document.addEventListener("keydown", manejarTecla)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", manejarTecla)
      document.body.style.overflow = ""
    }
  }, [manejarTecla])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={alCerrar}
    >
      <button
        className="absolute top-4 right-4 flex items-center justify-center h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        onClick={alCerrar}
      >
        <X className="h-5 w-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  )
}
