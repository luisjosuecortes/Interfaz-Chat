"use client"

import { PanelLeftOpen, Sparkles, Code, BookOpen, Lightbulb } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface PropiedadesPantallaInicio {
  estaBarraLateralAbierta: boolean
  alNuevaConversacion: () => void
  alAlternarBarraLateral: () => void
}

const SUGERENCIAS = [
  {
    icono: Sparkles,
    titulo: "Explícame un concepto",
    descripcion: "¿Qué es la inteligencia artificial?",
  },
  {
    icono: Code,
    titulo: "Ayúdame con código",
    descripcion: "Escribe una función en Python",
  },
  {
    icono: BookOpen,
    titulo: "Resumen de texto",
    descripcion: "Resume este artículo para mí",
  },
  {
    icono: Lightbulb,
    titulo: "Ideas creativas",
    descripcion: "Sugiere nombres para mi proyecto",
  },
]

export function PantallaInicio({
  estaBarraLateralAbierta,
  alNuevaConversacion,
  alAlternarBarraLateral,
}: PropiedadesPantallaInicio) {
  return (
    <div className="flex flex-1 flex-col h-screen">
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
          {/* Logo y título estilo Claude */}
          <div className="mb-8">
            <div className="mx-auto mb-5 h-16 w-16 rounded-full bg-gradient-to-br from-[var(--color-claude-acento)] to-[#e8956d] flex items-center justify-center shadow-md">
              <svg width="28" height="28" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 1L6.5 6.5L1 8L6.5 9.5L8 15L9.5 9.5L15 8L9.5 6.5L8 1Z" fill="white"/>
              </svg>
            </div>
            <h1 className="text-3xl font-semibold text-[var(--color-claude-texto)] mb-2">
              ¿En qué puedo ayudarte hoy?
            </h1>
            <p className="text-[var(--color-claude-texto-secundario)]">
              ChatSLM — Tu asistente de inteligencia artificial
            </p>
          </div>

          {/* Tarjetas de sugerencias */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {SUGERENCIAS.map((sugerencia) => (
              <button
                key={sugerencia.titulo}
                className="flex items-start gap-3 rounded-xl border border-[var(--color-claude-input-border)] bg-[var(--color-claude-input)] p-4 text-left transition-colors hover:bg-[var(--color-claude-sidebar-hover)] hover:border-[var(--color-claude-acento)]/30"
                onClick={alNuevaConversacion}
              >
                <sugerencia.icono className="h-5 w-5 mt-0.5 text-[var(--color-claude-acento)] shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[var(--color-claude-texto)]">
                    {sugerencia.titulo}
                  </p>
                  <p className="text-xs text-[var(--color-claude-texto-secundario)] mt-0.5">
                    {sugerencia.descripcion}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Botón nueva conversación */}
          <Button
            className="bg-[var(--color-claude-acento)] hover:bg-[var(--color-claude-acento-hover)] text-white px-6 py-2 rounded-full"
            onClick={alNuevaConversacion}
          >
            Iniciar nueva conversación
          </Button>
        </div>
      </div>

      {/* Pie de página */}
      <div className="py-4 text-center">
        <p className="text-xs text-[var(--color-claude-texto-secundario)]">
          ChatSLM — Laboratorio LABSEMCO
        </p>
      </div>
    </div>
  )
}
