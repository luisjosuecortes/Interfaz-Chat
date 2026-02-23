"use client"

import type { Mensaje } from "@/lib/tipos"
import { cn } from "@/lib/utils"
import { Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"

interface PropiedadesBurbuja {
  mensaje: Mensaje
  estaEscribiendo?: boolean
}

export function BurbujaMensaje({ mensaje, estaEscribiendo = false }: PropiedadesBurbuja) {
  const [haCopiado, establecerHaCopiado] = useState(false)
  const esUsuario = mensaje.rol === "usuario"

  async function copiarContenido() {
    await navigator.clipboard.writeText(mensaje.contenido)
    establecerHaCopiado(true)
    setTimeout(() => establecerHaCopiado(false), 2000)
  }

  return (
    <div
      className={cn(
        "flex gap-3 group",
        esUsuario ? "justify-end" : "justify-start"
      )}
    >
      {/* Avatar del asistente - sparkle estilo Claude */}
      {!esUsuario && (
        <div className="mt-1 h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-[var(--color-claude-acento)] to-[#e8956d] flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 1L6.5 6.5L1 8L6.5 9.5L8 15L9.5 9.5L15 8L9.5 6.5L8 1Z" fill="white"/>
          </svg>
        </div>
      )}

      {/* Contenido del mensaje */}
      <div
        className={cn(
          "relative max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          esUsuario
            ? "bg-[var(--color-claude-usuario-burbuja)] text-[var(--color-claude-texto)] rounded-br-md"
            : "bg-transparent text-[var(--color-claude-texto)]"
        )}
      >
        {/* Renderizar contenido con formato básico */}
        <div className="whitespace-pre-wrap break-words">
          <ContenidoFormateado texto={mensaje.contenido} />
          {estaEscribiendo && <span className="cursor-parpadeo" />}
        </div>

        {/* Botón de copiar */}
        {!esUsuario && mensaje.contenido && !estaEscribiendo && (
          <div className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)]"
              onClick={copiarContenido}
            >
              {haCopiado ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Avatar del usuario */}
      {esUsuario && (
        <div className="mt-1 h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9] flex items-center justify-center text-xs font-medium text-white">
          U
        </div>
      )}
    </div>
  )
}

// Componente para formatear texto con markdown básico
function ContenidoFormateado({ texto }: { texto: string }) {
  if (!texto) return null

  const lineas = texto.split("\n")

  return (
    <>
      {lineas.map((linea, indice) => {
        // Encabezados
        if (linea.startsWith("### "))
          return (
            <h3 key={indice} className="text-base font-semibold mt-3 mb-1 text-[var(--color-claude-texto)]">
              {linea.substring(4)}
            </h3>
          )
        if (linea.startsWith("## "))
          return (
            <h2 key={indice} className="text-lg font-semibold mt-4 mb-1 text-[var(--color-claude-texto)]">
              {linea.substring(3)}
            </h2>
          )

        // Bloque de código
        if (linea.startsWith("```"))
          return (
            <div key={indice} className="my-1 text-xs text-[var(--color-claude-texto-secundario)]">
              {linea}
            </div>
          )

        // Listas con viñetas
        if (linea.startsWith("- "))
          return (
            <div key={indice} className="flex gap-2 ml-2">
              <span className="text-[var(--color-claude-acento)]">•</span>
              <span><TextoConNegritas texto={linea.substring(2)} /></span>
            </div>
          )

        // Listas numeradas
        const coincidenciaNumero = linea.match(/^(\d+)\.\s(.+)/)
        if (coincidenciaNumero)
          return (
            <div key={indice} className="flex gap-2 ml-2">
              <span className="text-[var(--color-claude-acento)] font-medium">{coincidenciaNumero[1]}.</span>
              <span><TextoConNegritas texto={coincidenciaNumero[2]} /></span>
            </div>
          )

        // Línea vacía
        if (linea.trim() === "")
          return <div key={indice} className="h-2" />

        // Texto normal
        return (
          <span key={indice}>
            <TextoConNegritas texto={linea} />
            {indice < lineas.length - 1 && "\n"}
          </span>
        )
      })}
    </>
  )
}

// Formatear negritas **texto**
function TextoConNegritas({ texto }: { texto: string }) {
  const partes = texto.split(/(\*\*[^*]+\*\*)/)
  return (
    <>
      {partes.map((parte, indice) => {
        if (parte.startsWith("**") && parte.endsWith("**"))
          return (
            <strong key={indice} className="font-semibold text-[var(--color-claude-texto)]">
              {parte.slice(2, -2)}
            </strong>
          )
        return <span key={indice}>{parte}</span>
      })}
    </>
  )
}
