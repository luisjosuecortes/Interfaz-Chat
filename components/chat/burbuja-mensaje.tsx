"use client"

import type { Mensaje } from "@/lib/tipos"
import { cn } from "@/lib/utils"
import { Copy, Check, FileText, Pencil, RotateCcw, X, ArrowUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useState, useRef, useEffect } from "react"
import { RenderizadorMarkdown } from "@/components/chat/renderizador-markdown"

interface PropiedadesBurbuja {
  mensaje: Mensaje
  estaEscribiendoEste?: boolean
  estaGenerando?: boolean
  alEditarMensaje?: (idMensaje: string, nuevoContenido: string) => void
  alReenviarMensaje?: (idMensaje: string) => void
  alRegenerarRespuesta?: (idMensaje: string) => void
}

export function BurbujaMensaje({
  mensaje,
  estaEscribiendoEste = false,
  estaGenerando = false,
  alEditarMensaje,
  alReenviarMensaje,
  alRegenerarRespuesta,
}: PropiedadesBurbuja) {
  const [haCopiado, establecerHaCopiado] = useState(false)
  const [estaEditando, establecerEstaEditando] = useState(false)
  const [textoEdicion, establecerTextoEdicion] = useState("")
  const referenciaTextarea = useRef<HTMLTextAreaElement>(null)
  const esUsuario = mensaje.rol === "usuario"

  // Ajustar altura del textarea al entrar en modo edicion
  useEffect(() => {
    if (estaEditando && referenciaTextarea.current) {
      const textarea = referenciaTextarea.current
      textarea.style.height = "auto"
      textarea.style.height = `${Math.min(textarea.scrollHeight, 300)}px`
      textarea.focus()
      textarea.selectionStart = textarea.value.length
      textarea.selectionEnd = textarea.value.length
    }
  }, [estaEditando])

  async function copiarContenido() {
    await navigator.clipboard.writeText(mensaje.contenido)
    establecerHaCopiado(true)
    setTimeout(() => establecerHaCopiado(false), 2000)
  }

  function iniciarEdicion() {
    establecerTextoEdicion(mensaje.contenido)
    establecerEstaEditando(true)
  }

  function cancelarEdicion() {
    establecerEstaEditando(false)
    establecerTextoEdicion("")
  }

  function guardarEdicion() {
    const contenidoLimpio = textoEdicion.trim()
    if (!contenidoLimpio) return
    establecerEstaEditando(false)
    alEditarMensaje?.(mensaje.id, contenidoLimpio)
  }

  function manejarTeclaEdicion(evento: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (evento.key === "Enter" && !evento.shiftKey) {
      evento.preventDefault()
      guardarEdicion()
    }
    if (evento.key === "Escape") {
      cancelarEdicion()
    }
  }

  function manejarCambioEdicion(evento: React.ChangeEvent<HTMLTextAreaElement>) {
    establecerTextoEdicion(evento.target.value)
    const textarea = evento.target
    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 300)}px`
  }

  // Botones de accion del usuario (editar, copiar, reenviar)
  const botonesUsuario = !estaEditando && !estaGenerando && esUsuario && mensaje.contenido && (
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)] hover:bg-[var(--color-claude-sidebar-hover)]"
            onClick={iniciarEdicion}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Editar mensaje</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)] hover:bg-[var(--color-claude-sidebar-hover)]"
            onClick={copiarContenido}
          >
            {haCopiado ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{haCopiado ? "Copiado" : "Copiar"}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)] hover:bg-[var(--color-claude-sidebar-hover)]"
            onClick={() => alReenviarMensaje?.(mensaje.id)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Reenviar mensaje</TooltipContent>
      </Tooltip>
    </div>
  )

  // Botones de accion del asistente (copiar, regenerar)
  const botonesAsistente = !esUsuario && mensaje.contenido && !estaEscribiendoEste && !estaGenerando && (
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)] hover:bg-[var(--color-claude-sidebar-hover)]"
            onClick={copiarContenido}
          >
            {haCopiado ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{haCopiado ? "Copiado" : "Copiar"}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)] hover:bg-[var(--color-claude-sidebar-hover)]"
            onClick={() => alRegenerarRespuesta?.(mensaje.id)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Regenerar respuesta</TooltipContent>
      </Tooltip>
    </div>
  )

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
          "relative max-w-[85%]",
          esUsuario ? "flex flex-col items-end" : "flex flex-col items-start"
        )}
      >
        {/* Burbuja */}
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
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

          {/* Contenido del mensaje o modo edicion */}
          {esUsuario && estaEditando ? (
            <div className="min-w-[280px]">
              <textarea
                ref={referenciaTextarea}
                value={textoEdicion}
                onChange={manejarCambioEdicion}
                onKeyDown={manejarTeclaEdicion}
                className="w-full resize-none bg-transparent text-sm text-[var(--color-claude-texto)] focus:outline-none min-h-[24px] max-h-[300px] py-0"
                rows={1}
              />
              <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-[var(--color-claude-input-border)]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-3 text-xs text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)]"
                  onClick={cancelarEdicion}
                >
                  <X className="h-3 w-3 mr-1" />
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="h-7 px-3 text-xs bg-[var(--color-claude-acento)] hover:bg-[var(--color-claude-acento-hover)] text-white rounded-lg"
                  disabled={!textoEdicion.trim()}
                  onClick={guardarEdicion}
                >
                  <ArrowUp className="h-3 w-3 mr-1" />
                  Enviar
                </Button>
              </div>
            </div>
          ) : esUsuario ? (
            <div className="whitespace-pre-wrap break-words">
              {mensaje.contenido}
            </div>
          ) : (
            <div className="prosa-markdown break-words">
              <RenderizadorMarkdown contenido={mensaje.contenido} />
              {estaEscribiendoEste && <span className="cursor-parpadeo" />}
            </div>
          )}
        </div>

        {/* Botones de accion debajo de la burbuja */}
        {esUsuario ? botonesUsuario : botonesAsistente}
      </div>
    </div>
  )
}
