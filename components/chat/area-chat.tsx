"use client"

import { useRef, useEffect, useState } from "react"
import { PanelLeftOpen, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Conversacion, Adjunto } from "@/lib/tipos"
import { BurbujaMensaje } from "@/components/chat/burbuja-mensaje"
import { EntradaMensaje } from "@/components/chat/entrada-mensaje"
import { AvatarAsistente } from "@/components/ui/icono-sparkle"

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
  alRenombrarConversacion: (id: string, titulo: string) => void
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
  alRenombrarConversacion,
}: PropiedadesAreaChat) {
  const referenciaFinal = useRef<HTMLDivElement>(null)
  const referenciaInputTitulo = useRef<HTMLInputElement>(null)
  const [estaEditandoTitulo, establecerEstaEditandoTitulo] = useState(false)
  const [tituloEdicion, establecerTituloEdicion] = useState("")

  // Auto-scroll al final cuando hay nuevos mensajes
  useEffect(() => {
    referenciaFinal.current?.scrollIntoView({ behavior: "smooth" })
  }, [conversacion.mensajes, estaEscribiendo])

  // Focus en el input de titulo al entrar en modo edicion
  useEffect(() => {
    if (estaEditandoTitulo && referenciaInputTitulo.current) {
      referenciaInputTitulo.current.focus()
      referenciaInputTitulo.current.select()
    }
  }, [estaEditandoTitulo])

  function iniciarEdicionTitulo() {
    establecerTituloEdicion(conversacion.titulo || "")
    establecerEstaEditandoTitulo(true)
  }

  function confirmarEdicionTitulo() {
    const tituloLimpio = tituloEdicion.trim()
    if (tituloLimpio) {
      alRenombrarConversacion(conversacion.id, tituloLimpio)
    }
    establecerEstaEditandoTitulo(false)
  }

  function cancelarEdicionTitulo() {
    establecerEstaEditandoTitulo(false)
  }

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      {/* Cabecera con título de conversación */}
      <header className="flex items-center gap-2 px-4 py-3 bg-[var(--color-claude-bg)] shrink-0">
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

        {/* Contenedor del titulo con ancho fijo */}
        {estaEditandoTitulo ? (
          <input
            ref={referenciaInputTitulo}
            type="text"
            value={tituloEdicion}
            onChange={(e) => establecerTituloEdicion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmarEdicionTitulo()
              if (e.key === "Escape") cancelarEdicionTitulo()
            }}
            onBlur={confirmarEdicionTitulo}
            className="w-64 bg-[var(--color-claude-input)] text-[var(--color-claude-texto)] text-sm font-medium px-3 py-1.5 rounded-lg border border-[var(--color-claude-input-border)] outline-none focus:border-[var(--color-claude-acento)]"
          />
        ) : (
          <button
            onClick={iniciarEdicionTitulo}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--color-claude-texto)] hover:bg-[var(--color-claude-sidebar-hover)] transition-colors max-w-[280px] cursor-pointer"
          >
            <span className="truncate">{conversacion.titulo || "Nueva conversación"}</span>
            <ChevronDown className="h-3 w-3 shrink-0 text-[var(--color-claude-texto-secundario)]" />
          </button>
        )}
      </header>

      {/* Mensajes */}
      <ScrollArea className="flex-1 bg-[var(--color-claude-bg)] min-h-0">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {conversacion.mensajes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-6">
                <AvatarAsistente tamano="md" />
              </div>
              <h2 className="text-xl font-semibold text-[var(--color-claude-texto)] mb-2">
                ¿En que puedo ayudarte hoy?
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
