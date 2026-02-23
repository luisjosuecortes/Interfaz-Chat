"use client"

import { useState } from "react"
import { MessageSquarePlus, PanelLeftClose, PanelLeftOpen, Trash2, Pencil, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { Conversacion } from "@/lib/tipos"
import { cn } from "@/lib/utils"

interface PropiedadesBarraLateral {
  estaAbierta: boolean
  conversaciones: Conversacion[]
  conversacionActiva: string | null
  alAlternar: () => void
  alNuevaConversacion: () => void
  alSeleccionarConversacion: (id: string) => void
  alEliminarConversacion: (id: string) => void
  alRenombrarConversacion: (id: string, titulo: string) => void
}

export function BarraLateral({
  estaAbierta,
  conversaciones,
  conversacionActiva,
  alAlternar,
  alNuevaConversacion,
  alSeleccionarConversacion,
  alEliminarConversacion,
  alRenombrarConversacion,
}: PropiedadesBarraLateral) {
  const [idEditando, establecerIdEditando] = useState<string | null>(null)
  const [tituloEditando, establecerTituloEditando] = useState("")

  function iniciarEdicion(conversacion: Conversacion) {
    establecerIdEditando(conversacion.id)
    establecerTituloEditando(conversacion.titulo)
  }

  function confirmarEdicion() {
    if (idEditando && tituloEditando.trim()) {
      alRenombrarConversacion(idEditando, tituloEditando.trim())
    }
    establecerIdEditando(null)
  }

  function cancelarEdicion() {
    establecerIdEditando(null)
  }

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-[var(--color-claude-sidebar)] transition-all duration-300 ease-in-out border-r border-[var(--color-claude-input-border)]",
        estaAbierta ? "w-64" : "w-0"
      )}
    >
      {estaAbierta && (
        <>
          {/* Cabecera */}
          <div className="flex items-center justify-between p-3 border-b border-[var(--color-claude-input-border)]">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)] hover:bg-[var(--color-claude-sidebar-hover)]"
                  onClick={alAlternar}
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Cerrar barra lateral</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)] hover:bg-[var(--color-claude-sidebar-hover)]"
                  onClick={alNuevaConversacion}
                >
                  <MessageSquarePlus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Nueva conversación</TooltipContent>
            </Tooltip>
          </div>

          {/* Lista de conversaciones */}
          <ScrollArea className="flex-1 px-2 py-2">
            {conversaciones.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-[var(--color-claude-texto-secundario)]">
                Sin conversaciones aún
              </div>
            ) : (
              <div className="space-y-0.5">
                {conversaciones.map((conversacion) => (
                  <div
                    key={conversacion.id}
                    className={cn(
                      "group flex items-center gap-1 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors",
                      conversacionActiva === conversacion.id
                        ? "bg-[var(--color-claude-sidebar-hover)] text-[var(--color-claude-texto)]"
                        : "text-[var(--color-claude-texto-secundario)] hover:bg-[var(--color-claude-sidebar-hover)] hover:text-[var(--color-claude-texto)]"
                    )}
                    onClick={() => {
                      if (idEditando !== conversacion.id) {
                        alSeleccionarConversacion(conversacion.id)
                      }
                    }}
                  >
                    {idEditando === conversacion.id ? (
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <input
                          type="text"
                          value={tituloEditando}
                          onChange={(e) => establecerTituloEditando(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmarEdicion()
                            if (e.key === "Escape") cancelarEdicion()
                          }}
                          className="flex-1 min-w-0 bg-[var(--color-claude-input)] text-[var(--color-claude-texto)] text-sm px-1.5 py-0.5 rounded border border-[var(--color-claude-input-border)] outline-none focus:border-[var(--color-claude-acento)]"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0 text-green-500 hover:text-green-400"
                          onClick={(e) => {
                            e.stopPropagation()
                            confirmarEdicion()
                          }}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0 text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)]"
                          onClick={(e) => {
                            e.stopPropagation()
                            cancelarEdicion()
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="truncate flex-1">{conversacion.titulo}</span>
                        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)]"
                            onClick={(e) => {
                              e.stopPropagation()
                              iniciarEdicion(conversacion)
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-[var(--color-claude-texto-secundario)] hover:text-red-400"
                            onClick={(e) => {
                              e.stopPropagation()
                              alEliminarConversacion(conversacion.id)
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Pie de la barra lateral */}
          <div className="border-t border-[var(--color-claude-input-border)] p-3">
            <div className="flex items-center gap-2 text-xs text-[var(--color-claude-texto-secundario)]">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[var(--color-claude-acento)] to-[#e8956d] flex items-center justify-center text-white text-xs font-medium">
                U
              </div>
              <span className="font-medium">Usuario</span>
            </div>
          </div>
        </>
      )}
    </aside>
  )
}
