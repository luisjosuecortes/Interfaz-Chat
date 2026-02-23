"use client"

import { Globe } from "lucide-react"
import type { InfoBusquedaWeb } from "@/lib/tipos"

interface PropiedadesIndicadorBusqueda {
  busquedaWeb: InfoBusquedaWeb
}

export function IndicadorBusqueda({ busquedaWeb }: PropiedadesIndicadorBusqueda) {
  const estaActiva = busquedaWeb.estado !== "completada"

  return (
    <div className="flex items-start gap-2.5 py-2">
      <div className={`shrink-0 mt-0.5 ${estaActiva ? "icono-busqueda-pulsando" : ""}`}>
        <Globe className="h-4 w-4 text-[var(--color-claude-acento)]" />
      </div>
      <div className="min-w-0">
        <span className="text-sm font-medium text-[var(--color-claude-texto)]">
          {estaActiva ? "Buscando en la web" : "Búsqueda web completada"}
          {estaActiva && <span className="puntos-animados" />}
        </span>
        {busquedaWeb.consultas.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {busquedaWeb.consultas.map((consulta, indice) => (
              <span
                key={indice}
                className="inline-flex items-center rounded-md bg-[var(--color-claude-sidebar)] px-2 py-0.5 text-xs text-[var(--color-claude-texto-secundario)] border border-[var(--color-claude-input-border)]"
              >
                &ldquo;{consulta}&rdquo;
              </span>
            ))}
          </div>
        )}
        {busquedaWeb.fuentes.length > 0 && (
          <p className="mt-1 text-xs text-[var(--color-claude-texto-secundario)]">
            {busquedaWeb.fuentes.length} {busquedaWeb.fuentes.length === 1 ? "fuente encontrada" : "fuentes encontradas"}
          </p>
        )}
      </div>
    </div>
  )
}
