"use client"

import { useRef, useEffect } from "react"
import { PanelLeftOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Conversacion } from "@/lib/tipos"
import type { Adjunto } from "@/lib/tipos"
import { BurbujaMensaje } from "@/components/chat/burbuja-mensaje"
import { EntradaMensaje } from "@/components/chat/entrada-mensaje"

interface PropiedadesAreaChat {
  conversacion: Conversacion
  estaEscribiendo: boolean
  estaBarraLateralAbierta: boolean
  modeloSeleccionado: string
  mensajeError: string | null
  alEnviar: (contenido: string, adjuntos?: Adjunto[]) => void
  alAlternarBarraLateral: () => void
  alSeleccionarModelo: (idModelo: string) => void
  alDetener: () => void
  alEditarMensaje: (idMensaje: string, nuevoContenido: string) => void
  alReenviarMensaje: (idMensaje: string) => void
  alRegenerarRespuesta: (idMensaje: string) => void
}

export function AreaChat({
  conversacion,
  estaEscribiendo,
  estaBarraLateralAbierta,
  modeloSeleccionado,
  mensajeError,
  alEnviar,
  alAlternarBarraLateral,
  alSeleccionarModelo,
  alDetener,
  alEditarMensaje,
  alReenviarMensaje,
  alRegenerarRespuesta,
}: PropiedadesAreaChat) {
  const referenciaFinal = useRef<HTMLDivElement>(null)

  // Auto-scroll al final cuando hay nuevos mensajes
  useEffect(() => {
    referenciaFinal.current?.scrollIntoView({ behavior: "smooth" })
  }, [conversacion.mensajes, estaEscribiendo])

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      {/* Cabecera minimalista */}
      <header className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-claude-input-border)] bg-[var(--color-claude-bg)] shrink-0">
        {!estaBarraLateralAbierta && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)] hover:bg-[var(--color-claude-sidebar-hover)]"
                onClick={alAlternarBarraLateral}
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Abrir barra lateral</TooltipContent>
          </Tooltip>
        )}
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-[var(--color-claude-texto)]">
            {conversacion.titulo || "Sin titulo"}
          </span>
        </div>
      </header>

      {/* Mensajes */}
      <ScrollArea className="flex-1 bg-[var(--color-claude-bg)] min-h-0">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {conversacion.mensajes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-6 h-14 w-14 rounded-full bg-gradient-to-br from-[var(--color-claude-acento)] to-[#e8956d] flex items-center justify-center shadow-sm">
                <svg width="24" height="24" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 1L6.5 6.5L1 8L6.5 9.5L8 15L9.5 9.5L15 8L9.5 6.5L8 1Z" fill="white" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-[var(--color-claude-texto)] mb-2">
                ¿En qué puedo ayudarte hoy?
              </h2>
              <p className="text-sm text-[var(--color-claude-texto-secundario)] max-w-md">
                Escribe un mensaje para comenzar la conversación
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {conversacion.mensajes.map((mensaje, indice) => (
                <BurbujaMensaje
                  key={mensaje.id}
                  mensaje={mensaje}
                  estaEscribiendoEste={
                    estaEscribiendo &&
                    indice === conversacion.mensajes.length - 1 &&
                    mensaje.rol === "asistente"
                  }
                  estaGenerando={estaEscribiendo}
                  alEditarMensaje={alEditarMensaje}
                  alReenviarMensaje={alReenviarMensaje}
                  alRegenerarRespuesta={alRegenerarRespuesta}
                />
              ))}
              {mensajeError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  {mensajeError}
                </div>
              )}
            </div>
          )}
          <div ref={referenciaFinal} />
        </div>
      </ScrollArea>

      {/* Contenedor inferior opaco para cortar el scroll */}
      <div className="bg-[var(--color-claude-bg)] relative z-10 mx-auto w-full">
        {/* Entrada de mensaje con selector de modelo integrado */}
        <EntradaMensaje
          alEnviar={alEnviar}
          estaDeshabilitado={estaEscribiendo}
          estaEscribiendo={estaEscribiendo}
          alDetener={alDetener}
          modeloSeleccionado={modeloSeleccionado}
          alSeleccionarModelo={alSeleccionarModelo}
        />
      </div>
    </div>
  )
}
