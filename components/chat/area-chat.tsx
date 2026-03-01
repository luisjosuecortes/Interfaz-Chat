"use client"

import { useRef, useEffect, useState } from "react"
import { PanelLeftOpen, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Conversacion, Adjunto, DocumentoRAGUI } from "@/lib/tipos"
import { BurbujaMensaje } from "@/components/chat/burbuja-mensaje"
import { EntradaMensaje } from "@/components/chat/entrada-mensaje"
import { AvatarAsistente } from "@/components/ui/icono-sparkle"
import { useScrollAlFondo } from "@/lib/hooks"
import { useArtefacto } from "@/lib/contexto-artefacto"

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
  documentosRAG?: DocumentoRAGUI[]
  totalFragmentosRAG?: number
  alProcesarAdjuntoRAG?: (adjunto: Adjunto) => void
  estaIndexandoRAG?: boolean
  alEliminarDocumentoRAG?: (adjuntoId: string) => void
  archivosExternos?: File[] | null
  alLimpiarArchivosExternos?: () => void
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
  documentosRAG,
  totalFragmentosRAG,
  alProcesarAdjuntoRAG,
  estaIndexandoRAG,
  alEliminarDocumentoRAG,
  archivosExternos,
  alLimpiarArchivosExternos,
}: PropiedadesAreaChat) {
  const { contenedorRef, irAlFondo } = useScrollAlFondo()
  const { artefactoActivo } = useArtefacto()
  const referenciaInputTitulo = useRef<HTMLInputElement>(null)
  const [estaEditandoTitulo, establecerEstaEditandoTitulo] = useState(false)
  const [tituloEdicion, establecerTituloEdicion] = useState("")

  // Scroll instantaneo al fondo al cambiar de conversacion
  useEffect(() => {
    irAlFondo(false)
  }, [conversacion.id, irAlFondo])

  // Cuando el usuario envía un prompt: ir al fondo para mostrar el espacio reservado
  useEffect(() => {
    if (estaEscribiendo) irAlFondo(false)
  }, [estaEscribiendo, irAlFondo])

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
    <div className="flex flex-1 flex-col h-full overflow-hidden relative">
      {/* Barra superior flotante: boton sidebar + titulo.
          Se oculta cuando el panel de artefactos esta abierto para evitar
          solapamiento visual (en lg: ambos paneles coexisten). */}
      <div className={`absolute top-3 left-3 z-20 flex items-center gap-1 transition-opacity duration-200 ${artefactoActivo ? "lg:opacity-0 lg:pointer-events-none" : ""}`}>
        {!estaBarraLateralAbierta && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-[var(--color-claude-texto)] hover:text-[#000000] hover:bg-[var(--color-claude-sidebar-hover)]"
                onClick={alAlternarBarraLateral}
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Abrir barra lateral</TooltipContent>
          </Tooltip>
        )}

        {/* Titulo de la conversacion editable */}
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
            className="w-56 bg-[var(--color-claude-input)] text-[var(--color-claude-texto)] text-sm font-medium px-3 py-1.5 rounded-lg border border-[var(--color-claude-input-border)] outline-none focus:border-[var(--color-claude-texto)]"
          />
        ) : (
          <button
            onClick={iniciarEdicionTitulo}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--color-claude-texto)] hover:bg-[var(--color-claude-sidebar-hover)] transition-colors max-w-[260px] cursor-pointer"
          >
            <span className="truncate">{conversacion.titulo || "Nueva conversacion"}</span>
            <ChevronDown className="h-3 w-3 shrink-0 text-[var(--color-claude-texto)]/50" />
          </button>
        )}
      </div>

      {/* Mensajes: el hook gestiona el scroll listener internamente */}
      <div
        ref={contenedorRef}
        className="flex-1 overflow-y-auto bg-[var(--color-claude-bg)] min-h-0"
      >
        <div className="mx-auto max-w-3xl px-4 pt-14 pb-3">
          {conversacion.mensajes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-6">
                <AvatarAsistente tamano="md" />
              </div>
              <h2 className="text-xl font-semibold text-[var(--color-claude-texto)] mb-2">
                ¿En que puedo ayudarte hoy?
              </h2>
              <p className="text-sm text-[var(--color-claude-texto-secundario)] max-w-md">
                Escribe un mensaje para comenzar la conversacion
              </p>
            </div>
          ) : (
            <div>
              {conversacion.mensajes.map((mensaje, indice) => {
                const mensajeAnterior = indice > 0 ? conversacion.mensajes[indice - 1] : null
                const mismoRemitente = mensajeAnterior && mensajeAnterior.rol === mensaje.rol
                return (
                  <div key={mensaje.id} className={indice === 0 ? "" : mismoRemitente ? "mt-1.5" : "mt-6"}>
                    <BurbujaMensaje
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
                  </div>
                )
              })}
              {mensajeError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  {mensajeError}
                </div>
              )}
              {/* Sentinel: 16px de espacio final evita que el contenido quede pegado al borde */}
              <div className="min-h-4 shrink-0" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>

      {/* Contenedor inferior opaco para cortar el scroll */}
      <div className="bg-[var(--color-claude-bg)] relative z-10 mx-auto w-full">
        <EntradaMensaje
          alEnviar={alEnviar}
          estaDeshabilitado={estaEscribiendo}
          estaEscribiendo={estaEscribiendo}
          alDetener={alDetener}
          modeloSeleccionado={modeloSeleccionado}
          alSeleccionarModelo={alSeleccionarModelo}
          documentosRAG={documentosRAG}
          totalFragmentosRAG={totalFragmentosRAG}
          alProcesarAdjuntoRAG={alProcesarAdjuntoRAG}
          estaIndexandoRAG={estaIndexandoRAG}
          alEliminarDocumentoRAG={alEliminarDocumentoRAG}
          archivosExternos={archivosExternos}
          alLimpiarArchivosExternos={alLimpiarArchivosExternos}
        />
      </div>
    </div>
  )
}
