"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import type { Components } from "react-markdown"
import { BloqueCodigoConResaltado } from "@/components/chat/bloque-codigo"

interface PropiedadesRenderizador {
  contenido: string
}

// Componentes personalizados para react-markdown
const componentesMarkdown: Components = {
  // Bloques de codigo e inline code
  code({ children, className, ...resto }) {
    const coincidenciaLenguaje = /language-(\w+)/.exec(className || "")

    // Si tiene clase de lenguaje, es un bloque de codigo (fenced)
    if (coincidenciaLenguaje) {
      return (
        <BloqueCodigoConResaltado
          codigo={String(children).replace(/\n$/, "")}
          lenguaje={coincidenciaLenguaje[1]}
        />
      )
    }

    // Codigo inline
    return (
      <code
        className="bg-[#e8e3d8] text-[var(--color-claude-acento)] px-1.5 py-0.5 rounded text-[0.85em] font-mono"
        {...resto}
      >
        {children}
      </code>
    )
  },

  // Pre: passthrough porque BloqueCodigoConResaltado maneja su propio contenedor
  pre({ children }) {
    return <>{children}</>
  },

  // Enlaces: abrir en nueva pestaña
  a({ children, href, ...resto }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        {...resto}
      >
        {children}
      </a>
    )
  },

  // Tablas: con scroll horizontal para tablas anchas
  table({ children }) {
    return (
      <div className="overflow-x-auto my-3">
        <table>{children}</table>
      </div>
    )
  },
}

export function RenderizadorMarkdown({ contenido }: PropiedadesRenderizador) {
  if (!contenido) return null

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={componentesMarkdown}
    >
      {contenido}
    </ReactMarkdown>
  )
}
