"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import type { CitacionWeb } from "@/lib/tipos"
import { ExternalLink } from "lucide-react"

interface PropiedadesTarjetasCitacion {
  citaciones: CitacionWeb[]
}

// Extraer ID de video de una URL de YouTube
function extraerIdVideoYoutube(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.replace("www.", "")

    if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      const id = urlObj.searchParams.get("v")
      if (id) return id
      const partes = urlObj.pathname.split("/")
      const indiceClave = partes.findIndex((p) => p === "embed" || p === "shorts")
      if (indiceClave !== -1 && partes[indiceClave + 1]) {
        return partes[indiceClave + 1]
      }
    }

    if (hostname === "youtu.be") {
      return urlObj.pathname.slice(1) || null
    }
  } catch {
    // URL invalida
  }
  return null
}

// Extraer dominio limpio de una URL
function extraerDominio(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "")
  } catch {
    return url
  }
}

export function TarjetasCitacion({ citaciones }: PropiedadesTarjetasCitacion) {
  const refContenedor = useRef<HTMLDivElement>(null)
  const [mostrarFadeIzquierda, establecerMostrarFadeIzquierda] = useState(false)
  const [mostrarFadeDerecha, establecerMostrarFadeDerecha] = useState(false)

  const actualizarFades = useCallback(() => {
    const el = refContenedor.current
    if (!el) return
    const umbral = 8
    establecerMostrarFadeIzquierda(el.scrollLeft > umbral)
    establecerMostrarFadeDerecha(
      el.scrollLeft < el.scrollWidth - el.clientWidth - umbral
    )
  }, [])

  useEffect(() => {
    actualizarFades()
  }, [citaciones, actualizarFades])

  if (citaciones.length === 0) return null

  // Deduplicar citaciones por URL
  const citacionesUnicas = citaciones.filter(
    (citacion, indice, arr) => arr.findIndex((c) => c.url === citacion.url) === indice
  )

  return (
    <div className="mt-3 min-w-0">
      <p className="text-xs font-medium text-[var(--color-claude-texto-secundario)] mb-2">
        Fuentes ({citacionesUnicas.length})
      </p>

      <div className="relative">
        {/* Fade izquierda */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 bottom-2 w-10 z-10 transition-opacity duration-200"
          style={{
            opacity: mostrarFadeIzquierda ? 1 : 0,
            background: "linear-gradient(to right, var(--color-claude-bg), transparent)",
          }}
        />

        {/* Fade derecha */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 bottom-2 w-10 z-10 transition-opacity duration-200"
          style={{
            opacity: mostrarFadeDerecha ? 1 : 0,
            background: "linear-gradient(to left, var(--color-claude-bg), transparent)",
          }}
        />

        <div
          ref={refContenedor}
          onScroll={actualizarFades}
          className="flex gap-2 overflow-x-auto pb-2 scrollbar-citaciones"
        >
          {citacionesUnicas.map((citacion) => {
            const idYoutube = extraerIdVideoYoutube(citacion.url)
            const dominio = extraerDominio(citacion.url)

            return (
              <a
                key={citacion.url}
                href={citacion.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group/tarjeta shrink-0 w-[200px] rounded-lg border border-[var(--color-claude-input-border)] bg-[var(--color-claude-input)] hover:border-[var(--color-claude-acento)] hover:shadow-sm transition-all overflow-hidden"
              >
                {/* Thumbnail de YouTube */}
                {idYoutube && (
                  <div className="relative w-full h-[100px] bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://img.youtube.com/vi/${idYoutube}/mqdefault.jpg`}
                      alt={citacion.titulo || "Video de YouTube"}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-8 w-8 rounded-full bg-red-600 flex items-center justify-center shadow-md">
                        <svg width="12" height="14" viewBox="0 0 12 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 7L0 14V0L12 7Z" fill="white" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-2.5">
                  <p className="text-xs font-medium text-[var(--color-claude-texto)] line-clamp-2 leading-snug mb-1.5">
                    {citacion.titulo || dominio}
                  </p>

                  <div className="flex items-center gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${dominio}&sz=16`}
                      alt=""
                      className="h-3.5 w-3.5 rounded-sm shrink-0"
                      loading="lazy"
                    />
                    <span className="text-[11px] text-[var(--color-claude-texto-secundario)] truncate">
                      {dominio}
                    </span>
                    <ExternalLink className="h-2.5 w-2.5 text-[var(--color-claude-texto-secundario)] opacity-0 group-hover/tarjeta:opacity-100 transition-opacity shrink-0" />
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </div>
  )
}
