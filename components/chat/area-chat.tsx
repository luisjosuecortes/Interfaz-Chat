"use client"

import { useRef, useEffect, useState } from "react"
import { PanelLeftOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Conversacion } from "@/lib/tipos"
import { BurbujaMensaje } from "@/components/chat/burbuja-mensaje"
import { EntradaMensaje } from "@/components/chat/entrada-mensaje"
import { enviarMensajeConStreaming } from "@/lib/cliente-chat"

interface PropiedadesAreaChat {
  conversacion: Conversacion
  estaEscribiendo: boolean
  estaBarraLateralAbierta: boolean
  alEnviarMensaje: (contenido: string) => void
  alActualizarUltimoMensaje: (contenido: string) => void
  alAgregarMensajeAsistente: (contenido: string) => void
  alEstablecerEscribiendo: (valor: boolean) => void
  alAlternarBarraLateral: () => void
}

export function AreaChat({
  conversacion,
  estaEscribiendo,
  estaBarraLateralAbierta,
  alEnviarMensaje,
  alActualizarUltimoMensaje,
  alAgregarMensajeAsistente,
  alEstablecerEscribiendo,
  alAlternarBarraLateral,
}: PropiedadesAreaChat) {
  const referenciaFinal = useRef<HTMLDivElement>(null)
  const [mensajeError, establecerMensajeError] = useState<string | null>(null)

  // Auto-scroll al final cuando hay nuevos mensajes
  useEffect(() => {
    referenciaFinal.current?.scrollIntoView({ behavior: "smooth" })
  }, [conversacion.mensajes, estaEscribiendo])

  async function manejarEnvio(contenido: string) {
    establecerMensajeError(null)

    // Agregar mensaje del usuario
    alEnviarMensaje(contenido)

    // Preparar historial para la API
    const historialMensajes = [
      ...conversacion.mensajes.map((m) => ({
        rol: m.rol,
        contenido: m.contenido,
      })),
      { rol: "usuario" as const, contenido },
    ]

    // Simular respuesta de IA
    alEstablecerEscribiendo(true)

    // Agregar mensaje vacío del asistente
    alAgregarMensajeAsistente("")

    await enviarMensajeConStreaming(
      historialMensajes,
      (textoActual) => {
        alActualizarUltimoMensaje(textoActual)
      },
      () => {
        alEstablecerEscribiendo(false)
      },
      (error) => {
        establecerMensajeError(error)
        alEstablecerEscribiendo(false)
      }
    )
  }

  return (
    <div className="flex flex-1 flex-col h-screen">
      {/* Cabecera estilo Claude */}
      <header className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-claude-input-border)] bg-[var(--color-claude-bg)]">
        {!estaBarraLateralAbierta && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)] hover:bg-[var(--color-claude-sidebar-hover)]"
                onClick={alAlternarBarraLateral}
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Abrir barra lateral</TooltipContent>
          </Tooltip>
        )}
        <div className="flex items-center gap-2">
          {/* Logo estilo Claude sparkle */}
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[var(--color-claude-acento)] to-[#e8956d] flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 1L6.5 6.5L1 8L6.5 9.5L8 15L9.5 9.5L15 8L9.5 6.5L8 1Z" fill="white"/>
            </svg>
          </div>
          <span className="text-sm font-semibold text-[var(--color-claude-texto)]">
            ChatSLM
          </span>
        </div>
        <div className="ml-auto">
          <span className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-claude-sidebar)] text-[var(--color-claude-texto-secundario)] font-medium border border-[var(--color-claude-input-border)]">
            GPT-4o Mini
          </span>
        </div>
      </header>

      {/* Mensajes */}
      <ScrollArea className="flex-1 bg-[var(--color-claude-bg)]">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {conversacion.mensajes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-6 h-14 w-14 rounded-full bg-gradient-to-br from-[var(--color-claude-acento)] to-[#e8956d] flex items-center justify-center shadow-sm">
                <svg width="24" height="24" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 1L6.5 6.5L1 8L6.5 9.5L8 15L9.5 9.5L15 8L9.5 6.5L8 1Z" fill="white"/>
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
                  estaEscribiendo={
                    estaEscribiendo &&
                    indice === conversacion.mensajes.length - 1 &&
                    mensaje.rol === "asistente"
                  }
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

      {/* Entrada de mensaje */}
      <EntradaMensaje
        alEnviar={manejarEnvio}
        estaDeshabilitado={estaEscribiendo}
      />
    </div>
  )
}
