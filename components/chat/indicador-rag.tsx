"use client"

import { Loader2, Check, AlertCircle, Database } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { DocumentoRAGUI } from "@/lib/tipos"

interface PropiedadesIndicadorRAG {
  documentos: DocumentoRAGUI[]
  totalFragmentos: number
}

const ETIQUETAS_ESTADO: Record<DocumentoRAGUI["estado"], string> = {
  pendiente: "Esperando...",
  extrayendo: "Extrayendo texto",
  fragmentando: "Fragmentando",
  vectorizando: "Vectorizando",
  listo: "Indexado",
  error: "Error",
}

export function IndicadorRAG({ documentos, totalFragmentos }: PropiedadesIndicadorRAG) {
  if (documentos.length === 0) return null

  const documentosEnProceso = documentos.filter(
    (d) => d.estado !== "listo" && d.estado !== "error"
  )
  const documentosListos = documentos.filter((d) => d.estado === "listo")
  const documentosConError = documentos.filter((d) => d.estado === "error")

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5">
      {/* Documentos en proceso */}
      {documentosEnProceso.map((doc) => (
        <Tooltip key={doc.id}>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 rounded-md border border-[var(--color-claude-input-border)] bg-[var(--color-claude-sidebar)] px-2 py-1">
              <Loader2 className="h-3 w-3 animate-spin text-[var(--color-claude-texto)]" />
              <span className="text-xs text-[var(--color-claude-texto)] max-w-[100px] truncate">
                {doc.nombre}
              </span>
              {doc.progreso !== undefined && (
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-1.5 rounded-full bg-[var(--color-claude-input-border)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${doc.progreso}%`,
                        backgroundColor: 'var(--color-claude-texto)',
                      }}
                    />
                  </div>
                  <span className="text-xs text-[var(--color-claude-texto-secundario)] tabular-nums w-7 text-right">
                    {doc.progreso}%
                  </span>
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>{ETIQUETAS_ESTADO[doc.estado]}</TooltipContent>
        </Tooltip>
      ))}

      {/* Resumen de documentos listos */}
      {documentosListos.length > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 rounded-md bg-green-500/10 border border-green-500/20 px-2 py-1">
              <Database className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-600">
                {documentosListos.length} doc{documentosListos.length > 1 ? "s" : ""}{" "}
                ({totalFragmentos} fragmentos)
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs">
              <p className="font-medium mb-1">Documentos indexados para RAG:</p>
              {documentosListos.map((d) => (
                <div key={d.id} className="flex items-center gap-1">
                  <Check className="h-3 w-3 text-green-500" />
                  <span>{d.nombre}</span>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Documentos con error */}
      {documentosConError.map((doc) => (
        <Tooltip key={doc.id}>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 rounded-md bg-red-500/10 border border-red-500/20 px-2 py-1">
              <AlertCircle className="h-3 w-3 text-red-500" />
              <span className="text-xs text-red-600 max-w-[100px] truncate">
                {doc.nombre}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs">
              <p className="font-medium text-red-500">Error al procesar</p>
              <p>{doc.error || "Error desconocido"}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}
