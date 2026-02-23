"use client"

import { PanelLeftOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Adjunto } from "@/lib/tipos"
import { EntradaMensaje } from "@/components/chat/entrada-mensaje"

interface PropiedadesPantallaInicio {
  estaBarraLateralAbierta: boolean
  modeloSeleccionado: string
  alAlternarBarraLateral: () => void
  alEnviar: (contenido: string, adjuntos?: Adjunto[]) => void
  alSeleccionarModelo: (idModelo: string) => void
}

export function PantallaInicio({
  estaBarraLateralAbierta,
  modeloSeleccionado,
  alAlternarBarraLateral,
  alEnviar,
  alSeleccionarModelo,
}: PropiedadesPantallaInicio) {
  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden w-full">
      {/* Cabecera */}
      <header className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-claude-input-border)]">
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
      </header>

      {/* Contenido central */}
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="max-w-2xl w-full text-center">
          {/* Logo y título */}
          <div className="mb-8">
            <div className="mx-auto mb-5 h-16 w-16 rounded-full bg-gradient-to-br from-[var(--color-claude-acento)] to-[#e8956d] flex items-center justify-center shadow-md">
              <svg width="28" height="28" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 1L6.5 6.5L1 8L6.5 9.5L8 15L9.5 9.5L15 8L9.5 6.5L8 1Z" fill="white" />
              </svg>
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
            />
          </div>
        </div>
      </div>
    </div>
  )
}
