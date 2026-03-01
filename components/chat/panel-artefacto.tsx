"use client"

import { useState, useEffect, useCallback } from "react"
import { X, Copy, Check, Download, Eye, Code2, Pencil } from "lucide-react"
import { useArtefacto } from "@/lib/contexto-artefacto"
import { useCopiarAlPortapapeles, useScrollAlFondo } from "@/lib/hooks"
import { CodigoConResaltado, NOMBRES_LENGUAJE, EXTENSIONES_DESCARGA } from "./bloque-codigo"
import { cn } from "@/lib/utils"
import { RenderizadorMarkdown } from "./renderizador-markdown"

/** Descarga el contenido como archivo de texto */
function descargarArchivo(contenido: string, nombreArchivo: string) {
  const blob = new Blob([contenido], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement("a")
  enlace.href = url
  enlace.download = nombreArchivo
  document.body.appendChild(enlace)
  enlace.click()
  document.body.removeChild(enlace)
  URL.revokeObjectURL(url)
}

/** Vista previa sandboxed para HTML y SVG */
function VistaPreviaArtefacto({ contenido, tipo }: { contenido: string; tipo: "html" | "svg" }) {
  const srcDoc = tipo === "svg"
    ? `<!DOCTYPE html><html><head><style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f9f9f9;}</style></head><body>${contenido}</body></html>`
    : contenido

  return (
    <iframe
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      className="w-full h-full border-0 bg-white"
      title="Vista previa del artefacto"
    />
  )
}

/**
 * Convertidor ligero de LaTeX a Markdown.
 * Transforma la estructura del documento (secciones, listas, formato)
 * a Markdown equivalente, preservando las fórmulas $...$ y $$...$$ intactas
 * para que RenderizadorMarkdown las renderice con KaTeX.
 *
 * KaTeX SOLO renderiza fórmulas matemáticas. No puede interpretar
 * \documentclass, \section, \textbf, \begin{enumerate}, etc.
 * Este convertidor cierra esa brecha transformando la estructura del
 * documento a Markdown y dejando las fórmulas math intactas.
 */
function convertirLatexAMarkdown(latex: string): string {
  let texto = latex

  // 1. Extraer contenido entre \begin{document} y \end{document} si existe
  const regexDocumento = /\\begin\{document\}([\s\S]*?)\\end\{document\}/
  const coincidenciaDoc = regexDocumento.exec(texto)
  if (coincidenciaDoc) {
    // Extraer título del preámbulo si existe
    const regexTitulo = /\\title\{([^}]*)\}/
    const coincidenciaTitulo = regexTitulo.exec(texto)
    const titulo = coincidenciaTitulo ? `# ${coincidenciaTitulo[1]}\n\n` : ""
    texto = titulo + coincidenciaDoc[1]
  }

  // 2. Eliminar comandos del preámbulo que no se renderizarán
  texto = texto.replace(/\\(documentclass|usepackage|author|date|tableofcontents|newpage|clearpage|pagebreak|bibliographystyle|bibliography)(\[[^\]]*\])?\{[^}]*\}/g, "")
  texto = texto.replace(/\\maketitle/g, "")

  // 3. Secciones → Headers Markdown
  texto = texto.replace(/\\section\*?\{([^}]*)\}/g, "\n## $1\n")
  texto = texto.replace(/\\subsection\*?\{([^}]*)\}/g, "\n### $1\n")
  texto = texto.replace(/\\subsubsection\*?\{([^}]*)\}/g, "\n#### $1\n")
  texto = texto.replace(/\\paragraph\*?\{([^}]*)\}/g, "\n**$1** ")

  // 4. Formato de texto
  texto = texto.replace(/\\textbf\{([^}]*)\}/g, "**$1**")
  texto = texto.replace(/\\textit\{([^}]*)\}/g, "*$1*")
  texto = texto.replace(/\\emph\{([^}]*)\}/g, "*$1*")
  texto = texto.replace(/\\underline\{([^}]*)\}/g, "$1")
  texto = texto.replace(/\\texttt\{([^}]*)\}/g, "`$1`")
  texto = texto.replace(/\\verb\|([^|]*)\|/g, "`$1`")

  // 5. Listas: enumerate → numeradas, itemize → bullets
  // Reemplazar entornos de lista
  texto = texto.replace(/\\begin\{enumerate\}/g, "")
  texto = texto.replace(/\\end\{enumerate\}/g, "")
  texto = texto.replace(/\\begin\{itemize\}/g, "")
  texto = texto.replace(/\\end\{itemize\}/g, "")
  texto = texto.replace(/\\item\b\s*/g, "\n- ")

  // 6. Entornos math display: equation, align, gather → $$...$$
  texto = texto.replace(
    /\\begin\{(equation|align|gather|multline|flalign|eqnarray)\*?\}([\s\S]*?)\\end\{\1\*?\}/g,
    (_, _env, contenidoMath) => `\n$$\n${contenidoMath.trim()}\n$$\n`
  )

  // 7. Otros entornos comunes
  texto = texto.replace(/\\begin\{(center|flushleft|flushright)\}([\s\S]*?)\\end\{\1\}/g, "$2")
  texto = texto.replace(/\\begin\{quote\}([\s\S]*?)\\end\{quote\}/g, (_, contenidoQuote) => {
    return contenidoQuote.split("\n").map((linea: string) => `> ${linea}`).join("\n")
  })
  texto = texto.replace(/\\begin\{verbatim\}([\s\S]*?)\\end\{verbatim\}/g, "```\n$1\n```")

  // 8. Comandos de espaciado y salto de línea
  texto = texto.replace(/\\\\(?!\[)/g, "\n")
  texto = texto.replace(/\\(hfill|vfill|noindent|bigskip|medskip|smallskip)\b/g, "")
  texto = texto.replace(/\\(hspace|vspace)\*?\{[^}]*\}/g, " ")
  texto = texto.replace(/\\newline/g, "\n")
  texto = texto.replace(/~/g, " ")

  // 9. Caracteres especiales LaTeX escapados
  texto = texto.replace(/\\&/g, "&")
  texto = texto.replace(/\\%/g, "%")
  texto = texto.replace(/\\#/g, "#")
  texto = texto.replace(/\\\$/g, "\\$")
  texto = texto.replace(/\\_/g, "_")

  // 10. Eliminar comandos de referencia/etiqueta (no renderizables en web)
  texto = texto.replace(/\\(label|ref|cite|footnote|centering|raggedright|raggedleft)\{[^}]*\}/g, "")

  // 11. Limpiar líneas vacías excesivas
  texto = texto.replace(/\n{3,}/g, "\n\n")

  return texto.trim()
}

/** Panel lateral para visualizar artefactos (codigo, HTML, SVG, LaTeX) */
export function PanelArtefacto() {
  const { artefactoActivo, cerrarArtefacto, actualizarContenidoArtefacto } = useArtefacto()
  const { haCopiado, copiar } = useCopiarAlPortapapeles()
  const [modoVistaPrevia, establecerModoVistaPrevia] = useState(false)
  const [modoEdicion, establecerModoEdicion] = useState(false)
  const { contenedorRef, irAlFondo } = useScrollAlFondo()

  // Scroll al fondo al cambiar de artefacto
  useEffect(() => {
    irAlFondo(false)
  }, [artefactoActivo?.id, irAlFondo])

  // Restablecer modos al cambiar de artefacto (patron "ajustar estado durante render"):
  // markdown, svg, html, latex: preview por defecto; codigo: codigo por defecto
  const [prevIdArtefacto, establecerPrevIdArtefacto] = useState<string | undefined>(undefined)
  if (prevIdArtefacto !== artefactoActivo?.id) {
    establecerPrevIdArtefacto(artefactoActivo?.id)
    if (artefactoActivo) {
      establecerModoVistaPrevia(["markdown", "svg", "html", "latex"].includes(artefactoActivo.tipo))
      establecerModoEdicion(false)
    }
  }

  if (!artefactoActivo) return null

  const { tipo, titulo, contenido, lenguaje, totalLineas } = artefactoActivo
  const nombreLenguaje = lenguaje ? (NOMBRES_LENGUAJE[lenguaje] ?? lenguaje) : tipo
  const tieneVistaPrevia = tipo === "html" || tipo === "svg" || tipo === "markdown" || tipo === "latex"

  function manejarDescarga() {
    const extension = lenguaje
      ? (EXTENSIONES_DESCARGA[lenguaje] ?? "txt")
      : tipo === "markdown" ? "md" : tipo === "svg" ? "svg" : tipo === "html" ? "html" : "txt"
    const nombreBase = titulo.includes(".") ? titulo : `${titulo}.${extension}`
    descargarArchivo(contenido, nombreBase)
  }

  // Manejar edición del contenido
  const manejarCambioEdicion = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    actualizarContenidoArtefacto(e.target.value, e.target.value.split("\n").length)
  }, [actualizarContenidoArtefacto])

  function alternarEdicion() {
    if (modoEdicion) {
      establecerModoEdicion(false)
      establecerModoVistaPrevia(tieneVistaPrevia)
    } else {
      establecerModoEdicion(true)
      establecerModoVistaPrevia(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-[var(--color-claude-bg)] border-l border-[var(--color-claude-input-border)] animate-entrada-panel">
      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-claude-input-border)] shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--color-claude-texto)] truncate">
            {titulo}
          </h3>
          <span className="text-xs text-[var(--color-claude-texto-secundario)] shrink-0">
            {nombreLenguaje} · {totalLineas} lineas
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Botón Editar */}
          <button
            onClick={alternarEdicion}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors",
              modoEdicion
                ? "bg-[var(--color-claude-sidebar-hover)] text-[var(--color-claude-texto)]"
                : "text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)] hover:bg-[var(--color-claude-sidebar-hover)]"
            )}
            title={modoEdicion ? "Salir de edición" : "Editar código"}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{modoEdicion ? "Editando" : "Editar"}</span>
          </button>

          {/* Toggle vista previa (solo tipos con preview, y no en modo edición) */}
          {tieneVistaPrevia && !modoEdicion && (
            <button
              onClick={() => establecerModoVistaPrevia(!modoVistaPrevia)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors",
                modoVistaPrevia
                  ? "bg-[var(--color-claude-sidebar-hover)] text-[var(--color-claude-texto)]"
                  : "text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)] hover:bg-[var(--color-claude-sidebar-hover)]"
              )}
              title={modoVistaPrevia ? "Ver codigo" : "Vista previa"}
            >
              {modoVistaPrevia ? <Code2 className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{modoVistaPrevia ? "Codigo" : "Preview"}</span>
            </button>
          )}

          {/* Copiar */}
          <button
            onClick={() => copiar(contenido)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)] hover:bg-[var(--color-claude-sidebar-hover)] transition-colors"
            title="Copiar contenido"
          >
            {haCopiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{haCopiado ? "Copiado" : "Copiar"}</span>
          </button>

          {/* Descargar */}
          <button
            onClick={manejarDescarga}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)] hover:bg-[var(--color-claude-sidebar-hover)] transition-colors"
            title="Descargar archivo"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Descargar</span>
          </button>

          {/* Cerrar */}
          <button
            onClick={cerrarArtefacto}
            className="flex items-center justify-center h-7 w-7 rounded-md text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)] hover:bg-[var(--color-claude-sidebar-hover)] transition-colors"
            title="Cerrar panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className={cn(
        "flex-1 min-h-0 relative",
        !modoEdicion && !(tieneVistaPrevia && modoVistaPrevia) && "bg-[var(--color-claude-sidebar)]"
      )}>
        <div ref={contenedorRef} className="absolute inset-0 overflow-auto">
          {modoEdicion ? (
            /* Modo edición: textarea nativo monoespaciado */
            <textarea
              value={contenido}
              onChange={manejarCambioEdicion}
              className="w-full h-full p-4 bg-[var(--color-claude-sidebar)] text-[var(--color-claude-texto)] font-mono text-[0.85rem] leading-relaxed resize-none outline-none border-none"
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
            />
          ) : tieneVistaPrevia && modoVistaPrevia ? (
            tipo === "markdown" ? (
              <div className="p-6 prosa-markdown">
                <RenderizadorMarkdown contenido={contenido} />
              </div>
            ) : tipo === "latex" ? (
              /* LaTeX preview: convertir estructura a Markdown, preservar fórmulas */
              <div className="p-6 prosa-markdown">
                <RenderizadorMarkdown contenido={convertirLatexAMarkdown(contenido)} />
              </div>
            ) : (
              <VistaPreviaArtefacto contenido={contenido} tipo={tipo as "html" | "svg"} />
            )
          ) : (
            <CodigoConResaltado codigo={contenido} lenguaje={lenguaje ?? "text"} />
          )}
        </div>
      </div>
    </div>
  )
}
