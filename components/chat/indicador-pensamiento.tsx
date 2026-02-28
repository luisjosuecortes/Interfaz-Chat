"use client"

import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import type { InfoPensamiento } from "@/lib/tipos"
import { RenderizadorMarkdown } from "@/components/chat/renderizador-markdown"

interface PropiedadesBotonPensamiento {
  pensamiento: InfoPensamiento
  estaExpandido: boolean
  alAlternar: () => void
}

/** Boton/trigger del indicador de pensamiento (va junto al avatar) */
export function BotonPensamiento({ pensamiento, estaExpandido, alAlternar }: PropiedadesBotonPensamiento) {
  const estaPensando = pensamiento.estado === "pensando"
  const tieneResumen = pensamiento.resumen.length > 0

  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-1.5 text-xs font-medium transition-colors",
        estaPensando
          ? "text-[var(--color-claude-texto)]"
          : "text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)]",
        !tieneResumen && "cursor-default"
      )}
      onClick={() => tieneResumen && alAlternar()}
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
  )
}

interface PropiedadesContenidoPensamiento {
  pensamiento: InfoPensamiento
  estaExpandido: boolean
}

/** Contenido expandido del pensamiento (va debajo del avatar, ancho completo) */
export function ContenidoPensamiento({ pensamiento, estaExpandido }: PropiedadesContenidoPensamiento) {
  const estaPensando = pensamiento.estado === "pensando"
  const tieneResumen = pensamiento.resumen.length > 0

  if (!tieneResumen || (!estaExpandido && !estaPensando)) return null

  return (
    <div className={cn(
      "mt-1.5 pl-5 border-l-2",
      estaPensando ? "border-[var(--color-claude-texto)]/20" : "border-[var(--color-claude-input-border)]"
    )}>
      <div className="text-xs text-[var(--color-claude-texto-secundario)] prosa-pensamiento">
        <RenderizadorMarkdown contenido={pensamiento.resumen} />
      </div>
    </div>
  )
}
