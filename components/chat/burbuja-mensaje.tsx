"use client"

import type { Mensaje } from "@/lib/tipos"
import { cn } from "@/lib/utils"
import { Copy, Check, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { RenderizadorMarkdown } from "@/components/chat/renderizador-markdown"

interface PropiedadesBurbuja {
  mensaje: Mensaje
  estaEscribiendo?: boolean
}

export function BurbujaMensaje({ mensaje, estaEscribiendo = false }: PropiedadesBurbuja) {
  const [haCopiado, establecerHaCopiado] = useState(false)
  const esUsuario = mensaje.rol === "usuario"

  async function copiarContenido() {
    await navigator.clipboard.writeText(mensaje.contenido)
    establecerHaCopiado(true)
    setTimeout(() => establecerHaCopiado(false), 2000)
  }

  return (
    <div
      className={cn(
        "flex gap-3 group",
        esUsuario ? "justify-end" : "justify-start"
      )}
    >
      {/* Avatar del asistente - sparkle estilo Claude */}
      {!esUsuario && (
        <div className="mt-1 h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-[var(--color-claude-acento)] to-[#e8956d] flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 1L6.5 6.5L1 8L6.5 9.5L8 15L9.5 9.5L15 8L9.5 6.5L8 1Z" fill="white" />
          </svg>
        </div>
      )}

      {/* Contenido del mensaje */}
      <div
        className={cn(
          "relative max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          esUsuario
            ? "bg-[var(--color-claude-usuario-burbuja)] text-[var(--color-claude-texto)] rounded-br-md"
            : "bg-transparent text-[var(--color-claude-texto)]"
        )}
      >
        {/* Adjuntos del usuario */}
        {esUsuario && mensaje.adjuntos && mensaje.adjuntos.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {mensaje.adjuntos.map((adjunto) => (
              <div key={adjunto.id}>
                {adjunto.tipo === "imagen" ? (
                  <div className="h-32 w-32 rounded-lg overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={adjunto.contenido}
                      alt={adjunto.nombre}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-lg border border-[var(--color-claude-input-border)] bg-[var(--color-claude-input)] px-2.5 py-1.5">
                    <FileText className="h-4 w-4 text-[var(--color-claude-acento)] shrink-0" />
                    <span className="text-xs max-w-[150px] truncate">{adjunto.nombre}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Renderizar contenido con markdown */}
        {esUsuario ? (
          <div className="whitespace-pre-wrap break-words">
            {mensaje.contenido}
          </div>
        ) : (
          <div className="prosa-markdown break-words">
            <RenderizadorMarkdown contenido={mensaje.contenido} />
            {estaEscribiendo && <span className="cursor-parpadeo" />}
          </div>
        )}

        {/* Boton de copiar */}
        {!esUsuario && mensaje.contenido && !estaEscribiendo && (
          <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)]"
              onClick={copiarContenido}
            >
              {haCopiado ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
