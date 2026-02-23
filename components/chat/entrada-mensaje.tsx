"use client"

import { useState, useRef, useCallback } from "react"
import { ArrowUp, Paperclip, X, ChevronDown, Check, Square, Image as ImageIcon, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { Adjunto } from "@/lib/tipos"
import { MODELOS_DISPONIBLES, obtenerNombreModelo } from "@/lib/modelos"

// Tipos de archivos aceptados
const TIPOS_IMAGEN = "image/png,image/jpeg,image/gif,image/webp"
const TIPOS_ARCHIVO = ".txt,.md,.csv,.json,.xml,.html,.css,.js,.ts,.py,.pdf"

// Categorías de modelos para el dropdown
const CATEGORIAS_MODELOS = [
  { clave: "gpt-5.2", etiqueta: "GPT-5.2" },
  { clave: "gpt-5.1", etiqueta: "GPT-5.1" },
  { clave: "gpt-5", etiqueta: "GPT-5" },
  { clave: "gpt-4.1", etiqueta: "GPT-4.1" },
  { clave: "gpt-4o", etiqueta: "GPT-4o" },
] as const

interface PropiedadesEntrada {
  alEnviar: (contenido: string, adjuntos?: Adjunto[]) => void
  estaDeshabilitado: boolean
  estaEscribiendo?: boolean
  alDetener?: () => void
  modeloSeleccionado: string
  alSeleccionarModelo: (idModelo: string) => void
}

// Generador de IDs simple
function generarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9)
}

export function EntradaMensaje({
  alEnviar,
  estaDeshabilitado,
  estaEscribiendo,
  alDetener,
  modeloSeleccionado,
  alSeleccionarModelo,
}: PropiedadesEntrada) {
  const [texto, establecerTexto] = useState("")
  const [adjuntos, establecerAdjuntos] = useState<Adjunto[]>([])
  const referenciaTextarea = useRef<HTMLTextAreaElement>(null)
  const referenciaInputArchivo = useRef<HTMLInputElement>(null)

  const tieneContenido = texto.trim().length > 0 || adjuntos.length > 0

  const manejarEnvio = useCallback(() => {
    if (!tieneContenido || estaDeshabilitado) return
    alEnviar(texto.trim(), adjuntos.length > 0 ? adjuntos : undefined)
    establecerTexto("")
    establecerAdjuntos([])
    if (referenciaTextarea.current) {
      referenciaTextarea.current.style.height = "auto"
    }
  }, [texto, adjuntos, tieneContenido, estaDeshabilitado, alEnviar])

  function manejarTecla(evento: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (evento.key === "Enter" && !evento.shiftKey) {
      evento.preventDefault()
      manejarEnvio()
    }
  }

  function manejarCambio(evento: React.ChangeEvent<HTMLTextAreaElement>) {
    establecerTexto(evento.target.value)
    const textarea = evento.target
    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
  }

  function abrirSelectorArchivos() {
    referenciaInputArchivo.current?.click()
  }

  function manejarSeleccionArchivos(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivos = evento.target.files
    if (!archivos) return

    Array.from(archivos).forEach((archivo) => {
      const lector = new FileReader()
      lector.onload = () => {
        const esImagen = archivo.type.startsWith("image/")
        const nuevoAdjunto: Adjunto = {
          id: generarId(),
          tipo: esImagen ? "imagen" : "archivo",
          nombre: archivo.name,
          contenido: lector.result as string,
          tipoMime: archivo.type,
        }
        establecerAdjuntos((previo) => [...previo, nuevoAdjunto])
      }
      lector.readAsDataURL(archivo)
    })

    // Resetear input para permitir seleccionar el mismo archivo
    evento.target.value = ""
  }

  function eliminarAdjunto(id: string) {
    establecerAdjuntos((previo) => previo.filter((a) => a.id !== id))
  }

  return (
    <div className="px-4 pb-4">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-[var(--color-claude-input-border)] bg-[var(--color-claude-input)] shadow-sm focus-within:border-[var(--color-claude-acento)] focus-within:shadow-md transition-all">
          {/* Vista previa de adjuntos */}
          {adjuntos.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 py-1.5">
              {adjuntos.map((adjunto) => (
                <div
                  key={adjunto.id}
                  className="relative group flex items-center gap-1.5 rounded-lg border border-[var(--color-claude-input-border)] bg-[var(--color-claude-sidebar)] px-2 py-1.5"
                >
                  {adjunto.tipo === "imagen" ? (
                    <div className="h-10 w-10 rounded overflow-hidden shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={adjunto.contenido}
                        alt={adjunto.nombre}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <FileText className="h-4 w-4 text-[var(--color-claude-acento)] shrink-0" />
                  )}
                  <span className="text-xs text-[var(--color-claude-texto)] max-w-[120px] truncate">
                    {adjunto.nombre}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0 text-[var(--color-claude-texto-secundario)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => eliminarAdjunto(adjunto.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Textarea */}
          <div className="px-3 pt-2">
            <textarea
              ref={referenciaTextarea}
              value={texto}
              onChange={manejarCambio}
              onKeyDown={manejarTecla}
              placeholder="Escribe tu mensaje..."
              disabled={estaDeshabilitado}
              rows={1}
              className={cn(
                "w-full resize-none bg-transparent text-sm text-[var(--color-claude-texto)] placeholder:text-[var(--color-claude-texto-secundario)] focus:outline-none",
                "min-h-[24px] max-h-[200px] py-1.5 pt-2"
              )}
            />
          </div>

          {/* Barra de acciones inferior */}
          <div className="flex items-center justify-between px-3 pb-2 pt-1">
            <div className="flex items-center gap-1">
              {/* Botón adjuntar archivo */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)] hover:bg-[var(--color-claude-sidebar-hover)]"
                    disabled={estaDeshabilitado}
                    onClick={abrirSelectorArchivos}
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Adjuntar archivo o imagen</TooltipContent>
              </Tooltip>

              {/* Input de archivo oculto */}
              <input
                ref={referenciaInputArchivo}
                type="file"
                accept={`${TIPOS_IMAGEN},${TIPOS_ARCHIVO}`}
                multiple
                className="hidden"
                onChange={manejarSeleccionArchivos}
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Selector de modelo */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-8 gap-1 px-3 text-xs font-medium text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)] hover:bg-[var(--color-claude-sidebar-hover)] rounded-lg transition-colors"
                  >
                    {obtenerNombreModelo(modeloSeleccionado)}
                    <ChevronDown className="h-3 w-3 mb-[1px]" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-64 bg-[var(--color-claude-input)] border-[var(--color-claude-input-border)]"
                >
                  {CATEGORIAS_MODELOS.map((categoria, indiceCat) => {
                    const modelosCategoria = MODELOS_DISPONIBLES.filter(
                      (m) => m.categoria === categoria.clave
                    )
                    if (modelosCategoria.length === 0) return null
                    return (
                      <div key={categoria.clave}>
                        {indiceCat > 0 && <DropdownMenuSeparator className="bg-[var(--color-claude-input-border)]" />}
                        <DropdownMenuLabel className="text-xs text-[var(--color-claude-texto-secundario)]">
                          {categoria.etiqueta}
                        </DropdownMenuLabel>
                        {modelosCategoria.map((modelo) => (
                          <DropdownMenuItem
                            key={modelo.id}
                            className="flex items-center gap-2 cursor-pointer text-[var(--color-claude-texto)] hover:bg-[var(--color-claude-sidebar-hover)] focus:bg-[var(--color-claude-sidebar-hover)]"
                            onClick={() => alSeleccionarModelo(modelo.id)}
                          >
                            <div className="flex-1">
                              <div className="text-sm font-medium">{modelo.nombre}</div>
                              <div className="text-xs text-[var(--color-claude-texto-secundario)]">
                                {modelo.descripcion}
                              </div>
                            </div>
                            {modeloSeleccionado === modelo.id && (
                              <Check className="h-4 w-4 text-[var(--color-claude-acento)] shrink-0" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </div>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Boton enviar / detener */}
              {estaEscribiendo && alDetener ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      className="h-8 w-8 shrink-0 rounded-full bg-[var(--color-claude-acento)] hover:bg-[var(--color-claude-acento-hover)] text-white transition-colors"
                      onClick={alDetener}
                    >
                      <Square className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Detener generacion</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      className={cn(
                        "h-8 w-8 shrink-0 rounded-full transition-colors",
                        tieneContenido && !estaDeshabilitado
                          ? "bg-[var(--color-claude-acento)] hover:bg-[var(--color-claude-acento-hover)] text-white"
                          : "bg-[var(--color-claude-input-border)] text-[var(--color-claude-texto-secundario)] cursor-not-allowed"
                      )}
                      disabled={!tieneContenido || estaDeshabilitado}
                      onClick={manejarEnvio}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Enviar mensaje</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>

        {/* Texto informativo */}
        <p className="mt-2 text-center text-xs text-[var(--color-claude-texto-secundario)]">
          ChatSLM puede cometer errores. Verifica la información importante.
        </p>
      </div>
    </div>
  )
}
