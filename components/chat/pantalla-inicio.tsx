"use client"

import { PanelLeftOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { AvatarAsistente } from "@/components/ui/icono-sparkle"
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
      <header className="flex items-center gap-2 px-4 py-3">
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
          {/* Logo y titulo */}
          <div className="mb-8">
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
            />
          </div>
        </div>
      </div>
    </div>
  )
}
