"use client"

import { useState } from "react"
import { MessageSquarePlus, PanelLeftClose, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
        "flex flex-col h-screen bg-[var(--color-claude-sidebar)] transition-all duration-300 ease-in-out border-r border-[var(--color-claude-input-border)] overflow-hidden",
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

            <button
              onClick={alNuevaConversacion}
              className="text-base font-medium text-[var(--color-claude-texto)] hover:text-[var(--color-claude-acento)] transition-colors cursor-pointer"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              PenguinChat
            </button>

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
          <ScrollArea className="flex-1 min-w-0 px-2 py-2">
            {conversaciones.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-[var(--color-claude-texto-secundario)]">
                Sin conversaciones aún
              </div>
            ) : (
              <div className="space-y-0.5 w-full overflow-hidden">
                {conversaciones.map((conversacion) => {
                  const estaActiva = conversacionActiva === conversacion.id
                  const estaEnEdicion = idEditando === conversacion.id

                  return (
                    <div
                      key={conversacion.id}
                      className={cn(
                        "group flex items-center gap-1 rounded-lg px-2 py-2 cursor-pointer transition-colors h-9 overflow-hidden",
                        estaActiva
                          ? "bg-[var(--color-claude-sidebar-hover)] text-[var(--color-claude-texto)]"
                          : "text-[var(--color-claude-texto-secundario)] hover:bg-[var(--color-claude-sidebar-hover)] hover:text-[var(--color-claude-texto)]"
                      )}
                      onClick={() => {
                        if (!estaEnEdicion) alSeleccionarConversacion(conversacion.id)
                      }}
                    >
                      {estaEnEdicion ? (
                        <input
                          type="text"
                          value={tituloEditando}
                          onChange={(e) => establecerTituloEditando(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmarEdicion()
                            if (e.key === "Escape") cancelarEdicion()
                          }}
                          onBlur={confirmarEdicion}
                          className="flex-1 min-w-0 bg-[var(--color-claude-input)] text-[var(--color-claude-texto)] text-[13px] px-1.5 py-0.5 rounded border border-[var(--color-claude-input-border)] outline-none focus:border-[var(--color-claude-acento)]"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <>
                          <span className="flex-1 min-w-0 truncate text-[13px] px-1">
                            {conversacion.titulo || "Sin título"}
                          </span>

                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  "h-6 w-6 shrink-0 rounded-md text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)] hover:bg-black/10 transition-opacity",
                                  estaActiva
                                    ? "opacity-100"
                                    : "opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                                )}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" side="bottom" className="w-40 border-[var(--color-claude-input-border)] rounded-xl shadow-md p-1">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  iniciarEdicion(conversacion)
                                }}
                                className="cursor-pointer text-[13px] py-1.5 focus:bg-[var(--color-claude-sidebar-hover)]"
                              >
                                <Pencil className="h-3.5 w-3.5 mr-2" />
                                Renombrar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  alEliminarConversacion(conversacion.id)
                                }}
                                className="cursor-pointer text-[13px] py-1.5 focus:bg-red-50 focus:text-red-600 outline-none"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      )}
                    </div>
                  )
                })}
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
