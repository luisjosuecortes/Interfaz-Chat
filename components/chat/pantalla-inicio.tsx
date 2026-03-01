"use client"

import { PanelLeftOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { AvatarAsistente } from "@/components/ui/icono-sparkle"
import type { Adjunto, DocumentoRAGUI } from "@/lib/tipos"
import { EntradaMensaje } from "@/components/chat/entrada-mensaje"

interface PropiedadesPantallaInicio {
  estaBarraLateralAbierta: boolean
  modeloSeleccionado: string
  alAlternarBarraLateral: () => void
  alEnviar: (contenido: string, adjuntos?: Adjunto[]) => void
  alSeleccionarModelo: (idModelo: string) => void
  documentosRAG?: DocumentoRAGUI[]
  totalFragmentosRAG?: number
  alProcesarAdjuntoRAG?: (adjunto: Adjunto) => void
  estaIndexandoRAG?: boolean
  alEliminarDocumentoRAG?: (adjuntoId: string) => void
  archivosExternos?: File[] | null
  alLimpiarArchivosExternos?: () => void
}

export function PantallaInicio({
  estaBarraLateralAbierta,
  modeloSeleccionado,
  alAlternarBarraLateral,
  alEnviar,
  alSeleccionarModelo,
  documentosRAG,
  totalFragmentosRAG,
  alProcesarAdjuntoRAG,
  estaIndexandoRAG,
  alEliminarDocumentoRAG,
  archivosExternos,
  alLimpiarArchivosExternos,
}: PropiedadesPantallaInicio) {
  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden w-full relative">
      {/* Boton flotante para abrir barra lateral (solo visible cuando esta cerrada) */}
      {!estaBarraLateralAbierta && (
        <div className="absolute top-3 left-3 z-20">
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
        </div>
      )}

      {/* Contenido central */}
      <div className="flex flex-1 flex-col items-center justify-center w-full">
        <div className="w-full text-center">
          {/* Logo y titulo */}
          <div className="mb-8 px-4">
            <div className="flex justify-center mb-5">
              <AvatarAsistente tamano="lg" />
            </div>
            <h1 className="text-3xl font-semibold text-[var(--color-claude-texto)] mb-2">
              ¿En qué puedo ayudarte hoy?
            </h1>
          </div>

          <div className="w-full">
            {/* Entrada de mensaje con selector de modelo */}
            <EntradaMensaje
              alEnviar={alEnviar}
              estaDeshabilitado={false}
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
      </div>
    </div>
  )
}
