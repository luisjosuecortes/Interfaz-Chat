"use client"

import type { Mensaje } from "@/lib/tipos"
import { cn } from "@/lib/utils"
import { Copy, Check, Pencil, RotateCcw, X, ArrowUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { memo, useState, useRef, useEffect } from "react"
import { useCopiarAlPortapapeles } from "@/lib/hooks"
import { AvatarAsistente } from "@/components/ui/icono-sparkle"
import { RenderizadorMarkdown } from "@/components/chat/renderizador-markdown"
import { IndicadorBusqueda } from "@/components/chat/indicador-busqueda"
import { TarjetasCitacion } from "@/components/chat/tarjetas-citacion"
import { BotonPensamiento, ContenidoPensamiento } from "@/components/chat/indicador-pensamiento"
import { TarjetaArchivoConMiniatura } from "@/components/chat/tarjeta-archivo"
import { obtenerNombreModelo } from "@/lib/modelos"
import { ProveedorMensaje } from "@/lib/contexto-mensaje"

interface PropiedadesBurbuja {
  mensaje: Mensaje
  estaEscribiendoEste?: boolean
  estaGenerando?: boolean
  alEditarMensaje?: (idMensaje: string, nuevoContenido: string) => void
  alReenviarMensaje?: (idMensaje: string) => void
  alRegenerarRespuesta?: (idMensaje: string) => void
}

export const BurbujaMensaje = memo(function BurbujaMensaje({
  mensaje,
  estaEscribiendoEste = false,
  estaGenerando = false,
  alEditarMensaje,
  alReenviarMensaje,
  alRegenerarRespuesta,
}: PropiedadesBurbuja) {
  const { haCopiado, copiar } = useCopiarAlPortapapeles()
  const [estaEditando, establecerEstaEditando] = useState(false)
  const [textoEdicion, establecerTextoEdicion] = useState("")
  const referenciaTextarea = useRef<HTMLTextAreaElement>(null)
  const esUsuario = mensaje.rol === "usuario"

  // Ajustar altura del textarea al entrar en modo edicion
  useEffect(() => {
    if (estaEditando && referenciaTextarea.current) {
      const textarea = referenciaTextarea.current
      textarea.style.height = "auto"
      textarea.style.height = `${Math.min(textarea.scrollHeight, 300)}px`
      textarea.focus({ preventScroll: true })
      textarea.selectionStart = textarea.value.length
      textarea.selectionEnd = textarea.value.length
    }
  }, [estaEditando])

  function iniciarEdicion() {
    establecerTextoEdicion(mensaje.contenido)
    establecerEstaEditando(true)
  }

  function cancelarEdicion() {
    establecerEstaEditando(false)
    establecerTextoEdicion("")
  }

  function guardarEdicion() {
    const contenidoLimpio = textoEdicion.trim()
    if (!contenidoLimpio) return
    establecerEstaEditando(false)
    alEditarMensaje?.(mensaje.id, contenidoLimpio)
  }

  function manejarTeclaEdicion(evento: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (evento.key === "Enter" && !evento.shiftKey) {
      evento.preventDefault()
      guardarEdicion()
    }
    if (evento.key === "Escape") {
      cancelarEdicion()
    }
  }

  function manejarCambioEdicion(evento: React.ChangeEvent<HTMLTextAreaElement>) {
    establecerTextoEdicion(evento.target.value)
    const textarea = evento.target
    textarea.style.height = "auto"
    textarea.style.height = `${Math.min(textarea.scrollHeight, 300)}px`
  }

  // Botones de accion del usuario (editar, copiar, reenviar)
  const botonesUsuario = !estaEditando && !estaGenerando && esUsuario && mensaje.contenido && (
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[var(--color-claude-texto)] hover:text-[#000000] hover:bg-[var(--color-claude-sidebar-hover)]"
            onClick={iniciarEdicion}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Editar mensaje</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[var(--color-claude-texto)] hover:text-[#000000] hover:bg-[var(--color-claude-sidebar-hover)]"
            onClick={() => copiar(mensaje.contenido)}
          >
            {haCopiado ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{haCopiado ? "Copiado" : "Copiar"}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[var(--color-claude-texto)] hover:text-[#000000] hover:bg-[var(--color-claude-sidebar-hover)]"
            onClick={() => alReenviarMensaje?.(mensaje.id)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Reenviar mensaje</TooltipContent>
      </Tooltip>
    </div>
  )

  // Botones de accion del asistente (copiar, regenerar, modelo)
  const botonesAsistente = !esUsuario && mensaje.contenido && !estaEscribiendoEste && !estaGenerando && (
    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[var(--color-claude-texto)] hover:text-[#000000] hover:bg-[var(--color-claude-sidebar-hover)]"
            onClick={() => copiar(mensaje.contenido)}
          >
            {haCopiado ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{haCopiado ? "Copiado" : "Copiar"}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[var(--color-claude-texto)] hover:text-[#000000] hover:bg-[var(--color-claude-sidebar-hover)]"
            onClick={() => alRegenerarRespuesta?.(mensaje.id)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Regenerar respuesta</TooltipContent>
      </Tooltip>
      {/* Nombre del modelo que genero la respuesta */}
      {mensaje.modelo && (
        <span className="ml-1.5 text-[11px] text-[var(--color-claude-texto-secundario)] font-medium select-none">
          {obtenerNombreModelo(mensaje.modelo)}
        </span>
      )}
    </div>
  )

  // Derivado: sin texto de respuesta aun (solo para dots de carga)
  const estaSoloEsperando = !esUsuario && estaEscribiendoEste && !mensaje.contenido
  // Estado del pensamiento expandido (levantado desde IndicadorPensamiento)
  const [pensamientoExpandido, establecerPensamientoExpandido] = useState(false)
  // Patron React: ajustar estado cuando props cambian (sin useEffect)
  // Auto-expande cuando transiciona "pensando" → "completado" durante streaming (no para mensajes historicos)
  const [prevEstadoPensamiento, establecerPrevEstadoPensamiento] = useState<string | undefined>(undefined)
  if (prevEstadoPensamiento !== mensaje.pensamiento?.estado) {
    establecerPrevEstadoPensamiento(mensaje.pensamiento?.estado)
    if (
      prevEstadoPensamiento === "pensando" &&
      mensaje.pensamiento?.estado === "completado" &&
      mensaje.pensamiento.resumen.length > 0
    ) {
      establecerPensamientoExpandido(true)
    }
  }
  // El avatar va en flex row si es el asistente
  const tieneIndicadorInline = !esUsuario

  return (
    <div
      className={cn(
        "group",
        esUsuario && estaEditando ? "w-full" : esUsuario ? "flex justify-end" : ""
      )}
    >
      {/* Zona del avatar: fila superior + contenido expandido + búsqueda debajo */}
      {!esUsuario && (
        <div className="mb-3.5">
          {/* Fila: Avatar + botón de estado (dots o pensamiento) */}
          <div className={cn(
            tieneIndicadorInline ? "flex items-center gap-3" : ""
          )}>
            <AvatarAsistente tamano="sm" />

            {/* Indicador inline: si hay pensamiento mostramos el botón, si no, mostramos animación o un adorno elegante */}
            {mensaje.pensamiento ? (
              <BotonPensamiento
                pensamiento={mensaje.pensamiento}
                estaExpandido={pensamientoExpandido}
                alAlternar={() => establecerPensamientoExpandido(!pensamientoExpandido)}
              />
            ) : estaSoloEsperando ? (
              <div className="flex items-center gap-[3px]">
                <span className="punto-cargando" />
                <span className="punto-cargando" />
                <span className="punto-cargando" />
              </div>
            ) : (
              <div className="flex items-center text-[var(--color-claude-texto-secundario)] opacity-60 cursor-default select-none">
                <span className="text-xs font-medium">Respuesta</span>
              </div>
            )}
          </div>
          {/* Contenido expandido del pensamiento (debajo, ancho completo) */}
          {mensaje.pensamiento && (
            <ContenidoPensamiento
              pensamiento={mensaje.pensamiento}
              estaExpandido={pensamientoExpandido}
            />
          )}
          {/* Búsqueda web: siempre debajo del pensamiento */}
          {mensaje.busquedaWeb && (
            <div>
              <IndicadorBusqueda busquedaWeb={mensaje.busquedaWeb} />
            </div>
          )}
        </div>
      )}

      {/* Contenido del mensaje */}
      <div
        className={cn(
          "relative min-w-0",
          esUsuario && estaEditando ? "w-full max-w-full" : esUsuario ? "max-w-[85%]" : "max-w-full",
          esUsuario ? "flex flex-col items-end" : "flex flex-col items-start"
        )}
      >
        {/* Burbuja */}
        <div
          className={cn(
            "rounded-2xl min-w-0 max-w-full",
            esUsuario && estaEditando
              ? "w-full overflow-hidden border border-[var(--color-claude-input-border)] bg-[var(--color-claude-input)] shadow-[var(--sombra-xs)] focus-within:border-[var(--color-claude-texto)] focus-within:shadow-[var(--sombra-input-foco)] ring-1 ring-transparent focus-within:ring-[var(--color-claude-texto)]/10"
              : esUsuario
                ? "bg-[var(--color-claude-usuario-burbuja)] text-[var(--color-claude-texto)] text-sm leading-relaxed rounded-br-md px-4 py-3"
                : "bg-transparent"
          )}
        >
          {/* Adjuntos del usuario */}
          {esUsuario && mensaje.adjuntos && mensaje.adjuntos.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {mensaje.adjuntos.map((adjunto) => (
                <TarjetaArchivoConMiniatura
                  key={adjunto.id}
                  adjunto={adjunto}
                  variante="expandida"
                />
              ))}
            </div>
          )}

          {/* Contenido del mensaje o modo edicion */}
          {esUsuario && estaEditando ? (
            <div className="w-full">
              <div className="px-3 pt-2">
                <textarea
                  ref={referenciaTextarea}
                  value={textoEdicion}
                  onChange={manejarCambioEdicion}
                  onKeyDown={manejarTeclaEdicion}
                  className="w-full resize-none bg-transparent text-sm text-[var(--color-claude-texto)] focus:outline-none min-h-[24px] max-h-[300px] py-1.5 scrollbar-oculto"
                  rows={1}
                />
              </div>
              <div className="flex items-center justify-end gap-2 px-3 pb-2 pt-1 border-t border-transparent">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs font-medium text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)] hover:bg-[var(--color-claude-sidebar-hover)] rounded-lg transition-colors"
                  onClick={cancelarEdicion}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className={cn(
                    "h-8 px-4 text-xs font-medium rounded-lg transition-all",
                    textoEdicion.trim()
                      ? "bg-[var(--color-claude-acento)] hover:bg-[var(--color-claude-acento-hover)] text-white shadow-[var(--sombra-xs)]"
                      : "bg-[var(--color-claude-input-border)] text-[var(--color-claude-texto-secundario)] cursor-not-allowed"
                  )}
                  disabled={!textoEdicion.trim()}
                  onClick={guardarEdicion}
                >
                  <ArrowUp className="h-3.5 w-3.5 mr-1" />
                  Enviar
                </Button>
              </div>
            </div>
          ) : esUsuario ? (
            <div className="whitespace-pre-wrap break-words">
              {mensaje.contenido}
            </div>
          ) : (
            <ProveedorMensaje estaGenerandose={estaEscribiendoEste && estaGenerando} contenidoMensaje={mensaje.contenido}>
              {/* Contenido de texto */}
              {(mensaje.contenido || !estaSoloEsperando) && (
                <div className="prosa-markdown break-words">
                  <RenderizadorMarkdown contenido={mensaje.contenido} />
                  {estaEscribiendoEste && <span className="cursor-parpadeo" />}
                </div>
              )}
              {/* Tarjetas de citaciones (fuera de prosa-markdown para evitar herencia de estilos) */}
              {mensaje.citaciones && mensaje.citaciones.length > 0 && (
                <TarjetasCitacion citaciones={mensaje.citaciones} />
              )}
            </ProveedorMensaje>
          )}
        </div>

        {/* Botones de accion debajo de la burbuja */}
        {esUsuario ? botonesUsuario : botonesAsistente}
      </div>
    </div>
  )
},
  // Comparador personalizado: solo recompara datos del mensaje, ignora callbacks.
  // Los callbacks (alEditarMensaje, etc.) son recreados en cada render del contenedor
  // padre pero su comportamiento no cambia → ignorarlos evita re-renders innecesarios.
  // El store preserva referencias de objetos no-modificados en actualizarUltimoMensaje,
  // por lo que anterior.mensaje === siguiente.mensaje es true para mensajes no streaming.
  (anterior, siguiente) =>
    anterior.mensaje === siguiente.mensaje &&
    anterior.estaEscribiendoEste === siguiente.estaEscribiendoEste &&
    anterior.estaGenerando === siguiente.estaGenerando
)
