"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { InfoPensamiento } from "@/lib/tipos"
import { RenderizadorMarkdown } from "@/components/chat/renderizador-markdown"

interface PropiedadesIndicadorPensamiento {
  pensamiento: InfoPensamiento
}

export function IndicadorPensamiento({ pensamiento }: PropiedadesIndicadorPensamiento) {
  const [estaExpandido, establecerEstaExpandido] = useState(false)
  const estaPensando = pensamiento.estado === "pensando"
  const tieneResumen = pensamiento.resumen.length > 0

  return (
    <div className="mb-2">
      <button
        type="button"
        className={cn(
          "flex items-center gap-1.5 text-xs font-medium transition-colors",
          estaPensando
            ? "text-[var(--color-claude-acento)]"
            : "text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)]",
          !tieneResumen && "cursor-default"
        )}
        onClick={() => tieneResumen && establecerEstaExpandido(!estaExpandido)}
        disabled={!tieneResumen}
      >
        {estaPensando ? (
          <>
            <span className="icono-pensamiento-girando inline-block">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10" />
              </svg>
            </span>
            <span>Pensando<span className="puntos-animados" /></span>
          </>
        ) : (
          <>
            {tieneResumen && (
              <ChevronDown className={cn(
                "h-3.5 w-3.5 transition-transform",
                estaExpandido && "rotate-180"
              )} />
            )}
            <span>Pensamiento</span>
          </>
        )}
      </button>

      {/* Contenido del pensamiento (colapsable) */}
      {tieneResumen && estaExpandido && !estaPensando && (
        <div className="mt-1.5 pl-5 border-l-2 border-[var(--color-claude-input-border)]">
          <div className="text-xs text-[var(--color-claude-texto-secundario)] prosa-pensamiento">
            <RenderizadorMarkdown contenido={pensamiento.resumen} />
          </div>
        </div>
      )}

      {/* Mostrar resumen en streaming mientras piensa */}
      {estaPensando && tieneResumen && (
        <div className="mt-1.5 pl-5 border-l-2 border-[var(--color-claude-acento)]/30">
          <div className="text-xs text-[var(--color-claude-texto-secundario)] prosa-pensamiento">
            <RenderizadorMarkdown contenido={pensamiento.resumen} />
          </div>
        </div>
      )}
    </div>
  )
}
