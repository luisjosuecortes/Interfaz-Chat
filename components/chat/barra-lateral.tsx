"use client"

import { useState } from "react"
import { MessageSquarePlus, PanelLeftClose, PanelLeftOpen, MoreHorizontal, Pencil, Trash2, Check, X } from "lucide-react"
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
                      "group relative flex items-center gap-2 rounded-lg px-2 py-2 cursor-pointer transition-colors max-w-full overflow-hidden h-9",
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
                      <div className="flex items-center gap-1 flex-1 min-w-0 z-10 px-1">
                        <input
                          type="text"
                          value={tituloEditando}
                          onChange={(e) => establecerTituloEditando(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmarEdicion()
                            if (e.key === "Escape") cancelarEdicion()
                          }}
                          className="flex-1 min-w-0 bg-[var(--color-claude-input)] text-[var(--color-claude-texto)] text-[13px] px-1.5 py-0.5 rounded border border-[var(--color-claude-input-border)] outline-none focus:border-[var(--color-claude-acento)]"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0 text-green-600 hover:text-green-500 hover:bg-black/5"
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
                          className="h-5 w-5 shrink-0 text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)] hover:bg-black/5"
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
                        {/* Contenedor del titulo: el texto fluye por debajo del area del fade */}
                        <div className="relative flex-1 min-w-0 px-1 flex items-center overflow-hidden h-full">
                          <span className="whitespace-nowrap text-[13px]">{conversacion.titulo || "Sin título"}</span>
                        </div>

                        {/* Fade y Boton de acciones montados sobre y a la derecha */}
                        <div className="absolute right-0 top-0 bottom-0 flex items-center pr-1 pointer-events-none">

                          {/* Gradiente de difuminado to-transparent */}
                          <div
                            className={cn(
                              "w-10 h-full bg-gradient-to-l to-transparent",
                              conversacionActiva === conversacion.id
                                ? "from-[var(--color-claude-sidebar-hover)]"
                                : "from-[var(--color-claude-sidebar)] group-hover:from-[var(--color-claude-sidebar-hover)]"
                            )}
                          />

                          {/* Area de fondo solido para el dropdown */}
                          <div
                            className={cn(
                              "h-full flex items-center justify-center pl-0.5 pr-0.5 pointer-events-auto",
                              conversacionActiva === conversacion.id
                                ? "bg-[var(--color-claude-sidebar-hover)]"
                                : "bg-[var(--color-claude-sidebar)] group-hover:bg-[var(--color-claude-sidebar-hover)]"
                            )}
                          >
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 shrink-0 rounded-md opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)] hover:bg-black/10 transition-opacity"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" side="right" className="w-40 border-[var(--color-claude-input-border)] rounded-xl shadow-md p-1">
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
                          </div>
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
