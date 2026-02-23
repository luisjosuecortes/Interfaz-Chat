"use client"

import { useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

interface PropiedadesModalVideoYoutube {
  idVideo: string
  titulo?: string
  alCerrar: () => void
}

export function ModalVideoYoutube({ idVideo, titulo, alCerrar }: PropiedadesModalVideoYoutube) {
  const refBotonCerrar = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // Foco al botón de cerrar al abrir
    refBotonCerrar.current?.focus()

    // Bloquear scroll del body
    const scrollAnterior = window.scrollY
    document.body.style.overflow = "hidden"
    document.body.style.top = `-${scrollAnterior}px`
    document.body.style.position = "fixed"
    document.body.style.width = "100%"

    const manejarTeclado = (e: KeyboardEvent) => {
      if (e.key === "Escape") alCerrar()
    }
    window.addEventListener("keydown", manejarTeclado)

    return () => {
      window.removeEventListener("keydown", manejarTeclado)
      document.body.style.overflow = ""
      document.body.style.top = ""
      document.body.style.position = ""
      document.body.style.width = ""
      window.scrollTo(0, scrollAnterior)
    }
  }, [alCerrar])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo || "Video de YouTube"}
      className="modal-youtube-entrada fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 md:p-12"
    >
      {/* Backdrop con blur */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        onClick={alCerrar}
        aria-hidden="true"
      />

      {/* Contenido del modal */}
      <div className="modal-youtube-contenido relative z-10 w-full max-w-4xl flex flex-col">
        {/* Barra superior: titulo y botón cerrar */}
        <div className="flex items-center justify-between mb-3 px-1">
          {titulo ? (
            <p className="text-sm font-medium text-white/90 truncate pr-4 leading-snug">
              {titulo}
            </p>
          ) : (
            <div />
          )}
          <button
            ref={refBotonCerrar}
            onClick={alCerrar}
            className="shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Cerrar video"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Iframe 16:9 con sombra */}
        <div className="relative w-full rounded-xl overflow-hidden shadow-2xl bg-black">
          <div className="relative" style={{ paddingTop: "56.25%" }}>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${idVideo}?autoplay=1&rel=0&modestbranding=1`}
              title={titulo || "Video de YouTube"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 w-full h-full border-0"
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
