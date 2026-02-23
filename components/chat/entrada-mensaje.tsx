"use client"

import { useState, useRef, useCallback } from "react"
import { ArrowUp, Paperclip } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface PropiedadesEntrada {
  alEnviar: (contenido: string) => void
  estaDeshabilitado: boolean
}

export function EntradaMensaje({ alEnviar, estaDeshabilitado }: PropiedadesEntrada) {
  const [texto, establecerTexto] = useState("")
  const referenciaTextarea = useRef<HTMLTextAreaElement>(null)

  const tieneTexto = texto.trim().length > 0

  const manejarEnvio = useCallback(() => {
    if (!tieneTexto || estaDeshabilitado) return
    alEnviar(texto.trim())
    establecerTexto("")
    // Resetear altura del textarea
    if (referenciaTextarea.current) {
      referenciaTextarea.current.style.height = "auto"
    }
  }, [texto, tieneTexto, estaDeshabilitado, alEnviar])

  function manejarTecla(evento: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (evento.key === "Enter" && !evento.shiftKey) {
      evento.preventDefault()
      manejarEnvio()
    }
  }

  function manejarCambio(evento: React.ChangeEvent<HTMLTextAreaElement>) {
    establecerTexto(evento.target.value)
    // Auto-resize
    const textarea = evento.target
    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
  }

  return (
    <div className="bg-[var(--color-claude-bg)] px-4 py-3">
      <div className="mx-auto max-w-3xl">
        <div className="relative flex items-end gap-2 rounded-2xl border border-[var(--color-claude-input-border)] bg-[var(--color-claude-input)] px-3 py-2 shadow-sm focus-within:border-[var(--color-claude-acento)] focus-within:shadow-md transition-all">
          {/* Botón adjuntar archivo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)] hover:bg-transparent mb-0.5"
                disabled={estaDeshabilitado}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Adjuntar archivo</TooltipContent>
          </Tooltip>

          {/* Textarea */}
          <textarea
            ref={referenciaTextarea}
            value={texto}
            onChange={manejarCambio}
            onKeyDown={manejarTecla}
            placeholder="Escribe tu mensaje..."
            disabled={estaDeshabilitado}
            rows={1}
            className={cn(
              "flex-1 resize-none bg-transparent text-sm text-[var(--color-claude-texto)] placeholder:text-[var(--color-claude-texto-secundario)] focus:outline-none",
              "min-h-[24px] max-h-[200px] py-1.5"
            )}
          />

          {/* Botón enviar */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className={cn(
                  "h-8 w-8 shrink-0 rounded-full mb-0.5 transition-colors",
                  tieneTexto && !estaDeshabilitado
                    ? "bg-[var(--color-claude-acento)] hover:bg-[var(--color-claude-acento-hover)] text-white"
                    : "bg-[var(--color-claude-input-border)] text-[var(--color-claude-texto-secundario)] cursor-not-allowed"
                )}
                disabled={!tieneTexto || estaDeshabilitado}
                onClick={manejarEnvio}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Enviar mensaje</TooltipContent>
          </Tooltip>
        </div>

        {/* Texto informativo */}
        <p className="mt-2 text-center text-xs text-[var(--color-claude-texto-secundario)]">
          ChatSLM puede cometer errores. Verifica la información importante.
        </p>
      </div>
    </div>
  )
}
