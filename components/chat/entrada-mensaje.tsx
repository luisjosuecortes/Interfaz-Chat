"use client"

import { useState, useRef, useCallback } from "react"
import { ArrowUp, Paperclip, X, ChevronDown, Check, Square, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn, generarId } from "@/lib/utils"
import type { Adjunto, DocumentoRAGUI } from "@/lib/tipos"
import { MODELOS_DISPONIBLES, obtenerNombreModelo, CATEGORIAS_MODELOS, PROVEEDORES, obtenerProveedorDeModelo } from "@/lib/modelos"
import { IconoProveedor } from "@/components/ui/iconos-proveedor"
import { IndicadorRAG } from "@/components/chat/indicador-rag"

// Tipos de archivos aceptados
const TIPOS_IMAGEN = "image/png,image/jpeg,image/gif,image/webp"
const TIPOS_ARCHIVO = ".txt,.md,.csv,.json,.xml,.html,.css,.js,.ts,.py,.pdf"

interface PropiedadesEntrada {
  alEnviar: (contenido: string, adjuntos?: Adjunto[]) => void
  estaDeshabilitado: boolean
  estaEscribiendo?: boolean
  alDetener?: () => void
  modeloSeleccionado: string
  alSeleccionarModelo: (idModelo: string) => void
  documentosRAG?: DocumentoRAGUI[]
  totalFragmentosRAG?: number
  alProcesarAdjuntoRAG?: (adjunto: Adjunto) => void
  estaIndexandoRAG?: boolean
  alEliminarDocumentoRAG?: (adjuntoId: string) => void
}

export function EntradaMensaje({
  alEnviar,
  estaDeshabilitado,
  estaEscribiendo,
  alDetener,
  modeloSeleccionado,
  alSeleccionarModelo,
  documentosRAG,
  totalFragmentosRAG,
  alProcesarAdjuntoRAG,
  estaIndexandoRAG,
  alEliminarDocumentoRAG,
}: PropiedadesEntrada) {
  const [texto, establecerTexto] = useState("")
  const [adjuntos, establecerAdjuntos] = useState<Adjunto[]>([])
  const [selectorAbierto, establecerSelectorAbierto] = useState(false)
  const [proveedorActivo, establecerProveedorActivo] = useState(PROVEEDORES[0].id)
  const referenciaTextarea = useRef<HTMLTextAreaElement>(null)
  const referenciaInputArchivo = useRef<HTMLInputElement>(null)

  const tieneContenido = texto.trim().length > 0 || adjuntos.length > 0

  // Categorias y modelos del proveedor activo
  const categoriasDelProveedor = CATEGORIAS_MODELOS.filter(
    (c) => c.proveedor === proveedorActivo
  )

  const puedeEnviar = tieneContenido && !estaDeshabilitado && !estaIndexandoRAG

  const manejarEnvio = useCallback(() => {
    if (!puedeEnviar) return
    alEnviar(texto.trim(), adjuntos.length > 0 ? adjuntos : undefined)
    establecerTexto("")
    establecerAdjuntos([])
    if (referenciaTextarea.current) {
      referenciaTextarea.current.style.height = "auto"
    }
  }, [texto, adjuntos, puedeEnviar, alEnviar])

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

        // Iniciar indexacion RAG inmediatamente para archivos de documento
        if (alProcesarAdjuntoRAG) {
          alProcesarAdjuntoRAG(nuevoAdjunto)
        }
      }
      lector.readAsDataURL(archivo)
    })

    // Resetear input para permitir seleccionar el mismo archivo
    evento.target.value = ""
  }

  function eliminarAdjunto(id: string) {
    establecerAdjuntos((previo) => previo.filter((a) => a.id !== id))
    alEliminarDocumentoRAG?.(id)
  }

  function seleccionarModeloYCerrar(idModelo: string) {
    alSeleccionarModelo(idModelo)
    establecerSelectorAbierto(false)
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

          {/* Indicador de documentos RAG */}
          {documentosRAG && documentosRAG.length > 0 && (
            <IndicadorRAG
              documentos={documentosRAG}
              totalFragmentos={totalFragmentosRAG ?? 0}
            />
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
              {/* Boton adjuntar archivo */}
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
              {/* Selector de modelo con panel de proveedores */}
              <Popover
                open={selectorAbierto}
                onOpenChange={(abierto) => {
                  establecerSelectorAbierto(abierto)
                  if (abierto) {
                    const proveedor = obtenerProveedorDeModelo(modeloSeleccionado)
                    if (proveedor) establecerProveedorActivo(proveedor.id)
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-8 gap-1.5 px-3 text-xs font-medium text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)] hover:bg-[var(--color-claude-sidebar-hover)] rounded-lg transition-colors"
                  >
                    {obtenerNombreModelo(modeloSeleccionado)}
                    <ChevronDown className="h-3 w-3 mb-[1px]" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  sideOffset={8}
                  className="w-80 p-0 overflow-hidden"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <div className="flex">
                    {/* Barra lateral de proveedores */}
                    <div className="w-12 shrink-0 border-r border-[var(--color-claude-input-border)] bg-[var(--color-claude-sidebar)] flex flex-col items-center py-2 gap-1">
                      {PROVEEDORES.map((proveedor) => (
                        <Tooltip key={proveedor.id}>
                          <TooltipTrigger asChild>
                            <button
                              className={cn(
                                "h-9 w-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer",
                                proveedorActivo === proveedor.id
                                  ? "bg-[var(--color-claude-sidebar-hover)] text-[var(--color-claude-texto)]"
                                  : "text-[var(--color-claude-texto-secundario)] hover:bg-[var(--color-claude-sidebar-hover)] hover:text-[var(--color-claude-texto)]"
                              )}
                              onClick={() => establecerProveedorActivo(proveedor.id)}
                            >
                              <IconoProveedor idProveedor={proveedor.id} className="h-5 w-5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right">{proveedor.nombre}</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>

                    {/* Panel de modelos del proveedor activo */}
                    <div className="flex-1 max-h-[400px] overflow-y-auto py-1">
                      {categoriasDelProveedor.map((categoria, indiceCat) => {
                        const modelosCategoria = MODELOS_DISPONIBLES.filter(
                          (m) => m.categoria === categoria.clave && m.proveedor === proveedorActivo
                        )
                        if (modelosCategoria.length === 0) return null

                        return (
                          <div key={categoria.clave}>
                            {indiceCat > 0 && (
                              <div className="mx-3 my-1 h-px bg-[var(--color-claude-input-border)]" />
                            )}
                            <div className="px-3 py-1.5 text-[11px] font-semibold text-[var(--color-claude-texto-secundario)] uppercase tracking-wide">
                              {categoria.etiqueta}
                            </div>
                            {modelosCategoria.map((modelo) => (
                              <button
                                key={modelo.id}
                                className={cn(
                                  "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors cursor-pointer",
                                  "hover:bg-[var(--color-claude-sidebar-hover)]",
                                  modeloSeleccionado === modelo.id && "bg-[var(--color-claude-sidebar-hover)]"
                                )}
                                onClick={() => seleccionarModeloYCerrar(modelo.id)}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-[var(--color-claude-texto)]">
                                    {modelo.nombre}
                                  </div>
                                  <div className="text-xs text-[var(--color-claude-texto-secundario)] truncate">
                                    {modelo.descripcion}
                                  </div>
                                </div>
                                {modeloSeleccionado === modelo.id && (
                                  <Check className="h-4 w-4 text-[var(--color-claude-acento)] shrink-0" />
                                )}
                              </button>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

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
                        puedeEnviar
                          ? "bg-[var(--color-claude-acento)] hover:bg-[var(--color-claude-acento-hover)] text-white"
                          : "bg-[var(--color-claude-input-border)] text-[var(--color-claude-texto-secundario)] cursor-not-allowed"
                      )}
                      disabled={!puedeEnviar}
                      onClick={manejarEnvio}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {estaIndexandoRAG ? "Indexando documentos..." : "Enviar mensaje"}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>

        {/* Texto informativo */}
        <p className="mt-2 text-center text-xs text-[var(--color-claude-texto-secundario)]">
          PenguinChat puede cometer errores. Verifica la informacion importante.
        </p>
      </div>
    </div>
  )
}
