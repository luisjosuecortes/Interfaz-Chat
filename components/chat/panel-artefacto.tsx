"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { X, Copy, Check, Download, Eye, Code2, Pencil, Play, Loader2, ChevronDown, ChevronUp } from "lucide-react"
import { useArtefacto } from "@/lib/contexto-artefacto"
import { useCopiarAlPortapapeles } from "@/lib/hooks"
import { CodigoConResaltado, NOMBRES_LENGUAJE, EXTENSIONES_DESCARGA } from "./bloque-codigo"
import { cn } from "@/lib/utils"
import { RenderizadorMarkdown } from "./renderizador-markdown"
import { esLenguajeEjecutable, validarImportsPython, detectarUsoInput } from "@/lib/ejecutor-codigo"
import type { ResultadoEjecucion, EstadoEjecucion } from "@/lib/tipos"

// Estilos sincronizados con oneLight de react-syntax-highlighter + estiloCodigoPanel
// para que el textarea transparente se alinee pixel a pixel con el codigo resaltado
const ESTILOS_EDITOR: React.CSSProperties = {
  fontFamily: '"Fira Code","Fira Mono",Menlo,Consolas,"DejaVu Sans Mono",monospace',
  fontSize: "0.85rem",
  lineHeight: "1.5",
  padding: "1rem",
  whiteSpace: "pre",
  overflowWrap: "normal",
  wordBreak: "normal",
  tabSize: 2,
  color: "transparent",
  WebkitTextFillColor: "transparent",
  caretColor: "var(--color-claude-texto)",
  overflow: "hidden",
}

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

/** Script inyectado en iframes para detectar bloqueos por bucle infinito.
 *  Responde a pings del padre via postMessage. Si el event loop esta bloqueado,
 *  el listener no puede ejecutarse y el padre detecta la falta de respuesta. */
const SCRIPT_HEARTBEAT = `<script>window.addEventListener('message',function(e){if(e.data==='__ping__')e.source.postMessage('__pong__','*');});<\/script>`

/** Inyecta el script de heartbeat en contenido HTML */
function inyectarHeartbeat(html: string): string {
  if (html.includes("<head>")) {
    return html.replace("<head>", "<head>" + SCRIPT_HEARTBEAT)
  }
  if (/<html[\s>]/i.test(html)) {
    return html.replace(/<html[^>]*>/, "$&<head>" + SCRIPT_HEARTBEAT + "</head>")
  }
  return SCRIPT_HEARTBEAT + html
}

/** Colores por tipo de salida en la consola (tema claro, consistente con el panel) */
const COLORES_CONSOLA: Record<string, string> = {
  stdout: "text-[var(--color-claude-texto)]",
  stderr: "text-amber-600",
  resultado: "text-emerald-600",
  error: "text-red-600",
}

/** Panel de resultados de ejecucion de codigo (tema claro) con resize vertical */
function ConsolaResultados({
  resultado,
  estado,
  estaAbierta,
  alAlternar,
}: {
  resultado: ResultadoEjecucion | null
  estado: EstadoEjecucion
  estaAbierta: boolean
  alAlternar: () => void
}) {
  const consolaRef = useRef<HTMLDivElement>(null)
  const contenedorRef = useRef<HTMLDivElement>(null)
  const estaActiva = estado === "cargando" || estado === "ejecutando"
  const tieneSalida = resultado && resultado.salidas.length > 0

  // Altura de la consola controlada por drag (px). null = altura automatica (max-h-64)
  const [alturaConsola, establecerAlturaConsola] = useState<number | null>(null)
  const estaDragRef = useRef(false)
  const yInicialRef = useRef(0)
  const alturaInicialRef = useRef(0)

  // Auto-scroll al fondo cuando hay nueva salida
  useEffect(() => {
    if (consolaRef.current && estaAbierta) {
      consolaRef.current.scrollTop = consolaRef.current.scrollHeight
    }
  }, [resultado?.salidas.length, estaAbierta])

  /** Inicia el drag de resize de la consola */
  const iniciarDragConsola = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    estaDragRef.current = true
    yInicialRef.current = e.clientY
    // Capturar la altura actual del contenido de la consola
    alturaInicialRef.current = consolaRef.current?.offsetHeight ?? 256

    const moverDrag = (ev: MouseEvent) => {
      if (!estaDragRef.current) return
      // Mover hacia arriba = aumenta la altura (delta negativo)
      const delta = yInicialRef.current - ev.clientY
      const panelAltura = contenedorRef.current?.closest(".flex.flex-col.h-full")?.clientHeight ?? 800
      const maxAltura = Math.floor(panelAltura * 0.6) // max 60% del panel
      const nuevaAltura = Math.max(60, Math.min(maxAltura, alturaInicialRef.current + delta))
      establecerAlturaConsola(nuevaAltura)
    }

    const finDrag = () => {
      estaDragRef.current = false
      document.removeEventListener("mousemove", moverDrag)
      document.removeEventListener("mouseup", finDrag)
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
    }

    document.body.style.userSelect = "none"
    document.body.style.cursor = "ns-resize"
    document.addEventListener("mousemove", moverDrag)
    document.addEventListener("mouseup", finDrag)
  }, [])

  if (!estaActiva && !tieneSalida) return null

  return (
    <div ref={contenedorRef} className="shrink min-h-0 flex flex-col">
      {/* Handle de drag resize — borde superior, arrastrar hacia arriba para agrandar */}
      <div
        onMouseDown={iniciarDragConsola}
        className="h-1 cursor-ns-resize bg-[var(--color-claude-input-border)] hover:bg-[var(--color-claude-texto-secundario)]/30 transition-colors shrink-0"
        title="Arrastra para redimensionar"
      />
      {/* Barra de estado/toggle */}
      <button
        onClick={alAlternar}
        className="flex items-center justify-between w-full px-4 py-1.5 bg-[var(--color-claude-sidebar)] hover:bg-[var(--color-claude-sidebar-hover)] transition-colors text-xs shrink-0"
      >
        <span className="flex items-center gap-1.5 text-[var(--color-claude-texto-secundario)]">
          {estaActiva ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              {estado === "cargando" ? "Cargando Python..." : "Ejecutando..."}
            </>
          ) : (
            <>
              <span className={resultado?.exito ? "text-emerald-600" : "text-red-600"}>●</span>
              {resultado?.interrumpido
                ? "Timeout"
                : resultado?.exito ? "Completado" : "Error"}
              <span className="text-[var(--color-claude-texto-secundario)] ml-1">
                {resultado?.duracionMs !== undefined && `${Math.round(resultado.duracionMs)}ms`}
              </span>
            </>
          )}
        </span>
        {tieneSalida && (
          estaAbierta
            ? <ChevronDown className="h-3 w-3 text-[var(--color-claude-texto-secundario)]" />
            : <ChevronUp className="h-3 w-3 text-[var(--color-claude-texto-secundario)]" />
        )}
      </button>

      {/* Contenido de la consola */}
      {estaAbierta && (tieneSalida || estaActiva) && (
        <div
          ref={consolaRef}
          className="px-4 py-1.5 bg-[var(--color-claude-sidebar)] overflow-y-auto font-mono text-xs leading-snug scrollbar-oculto"
          style={alturaConsola !== null ? { height: `${alturaConsola}px` } : { maxHeight: "16rem" }}
        >
          {resultado?.salidas.map((salida, i) => (
            <div key={i} className={COLORES_CONSOLA[salida.tipo] ?? "text-[var(--color-claude-texto)]"}>
              {salida.tipo === "imagen" ? (
                <img
                  src={salida.contenido}
                  alt={`Grafico ${i + 1}`}
                  className="max-w-full rounded my-1"
                  style={{ maxHeight: "400px" }}
                />
              ) : (
                <>
                  {salida.tipo === "resultado" && <span className="text-[var(--color-claude-texto-secundario)]">{"=> "}</span>}
                  {salida.tipo === "stderr" && <span className="text-amber-700">stderr: </span>}
                  {salida.contenido}
                </>
              )}
            </div>
          ))}
          {estaActiva && !tieneSalida && (
            <div className="text-[var(--color-claude-texto-secundario)] animate-pulse">Esperando salida...</div>
          )}
        </div>
      )}
    </div>
  )
}

/** Vista previa sandboxed para HTML y SVG con deteccion de bloqueos */
function VistaPreviaArtefacto({ contenido, tipo }: { contenido: string; tipo: "html" | "svg" }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [noResponde, establecerNoResponde] = useState(false)
  const [clave, establecerClave] = useState(0)

  const srcDoc = tipo === "svg"
    ? `<!DOCTYPE html><html><head>${SCRIPT_HEARTBEAT}<style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f9f9f9;}</style></head><body>${contenido}</body></html>`
    : inyectarHeartbeat(contenido)

  // Heartbeat: detectar si el iframe deja de responder
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    let ultimoPong = Date.now()

    function manejarMensaje(e: MessageEvent) {
      if (e.data === "__pong__") {
        ultimoPong = Date.now()
        establecerNoResponde(false)
      }
    }

    window.addEventListener("message", manejarMensaje)

    const intervalo = setInterval(() => {
      try {
        iframe.contentWindow?.postMessage("__ping__", "*")
      } catch {
        // iframe destruido o no accesible
      }

      if (Date.now() - ultimoPong > 5000) {
        establecerNoResponde(true)
      }
    }, 2000)

    return () => {
      window.removeEventListener("message", manejarMensaje)
      clearInterval(intervalo)
    }
  }, [clave])

  function recargar() {
    establecerNoResponde(false)
    establecerClave(k => k + 1)
  }

  return (
    <div className="relative w-full h-full">
      <iframe
        key={clave}
        ref={iframeRef}
        srcDoc={srcDoc}
        sandbox="allow-scripts"
        className="w-full h-full border-0 bg-white"
        title="Vista previa del artefacto"
      />
      {noResponde && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm gap-3">
          <p className="text-sm text-[var(--color-claude-texto-secundario)]">
            Este artefacto dejo de responder
          </p>
          <button
            onClick={recargar}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--color-claude-sidebar)] hover:bg-[var(--color-claude-sidebar-hover)] text-[var(--color-claude-texto)] border border-[var(--color-claude-input-border)] transition-colors"
          >
            Recargar
          </button>
        </div>
      )}
    </div>
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

/** Panel lateral para visualizar y editar artefactos (codigo, HTML, SVG, LaTeX).
 *  El modo edicion usa un patron "overlay": textarea transparente superpuesto sobre
 *  el codigo resaltado, manteniendo syntax highlighting mientras el usuario escribe. */
export function PanelArtefacto() {
  // === Todos los hooks primero (antes de cualquier return condicional) ===
  const { artefactoActivo, cerrarArtefacto, guardarEdicionUsuario, estadoEjecucion, resultadoEjecucion, ejecutarArtefacto } = useArtefacto()
  const { haCopiado, copiar } = useCopiarAlPortapapeles()
  const [modoVistaPrevia, establecerModoVistaPrevia] = useState(false)
  const [modoEdicion, establecerModoEdicion] = useState(false)
  const [consolaAbierta, establecerConsolaAbierta] = useState(true)
  // Buffer local de edicion: desacoplado del contexto para evitar que el sync effect
  // de BloqueCodigoConResaltado revierta las ediciones del usuario (patron react-simple-code-editor)
  const [contenidoEditado, establecerContenidoEditado] = useState<string | null>(null)
  const contenedorRef = useRef<HTMLDivElement>(null)

  // Manejar edicion del contenido — escribe solo al estado local, no al contexto
  const manejarCambioEdicion = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    establecerContenidoEditado(e.target.value)
  }, [])

  // Scroll al inicio al cambiar de artefacto (no al fondo como antes)
  useEffect(() => {
    if (contenedorRef.current) contenedorRef.current.scrollTop = 0
  }, [artefactoActivo?.id])

  // Auto-abrir consola cuando llegan resultados nuevos
  useEffect(() => {
    if (resultadoEjecucion && resultadoEjecucion.salidas.length > 0) {
      establecerConsolaAbierta(true)
    }
  }, [resultadoEjecucion])

  // Restablecer modos al cambiar de artefacto (patron "ajustar estado durante render"):
  // markdown, svg, html, latex: preview por defecto; codigo: codigo por defecto
  const [prevIdArtefacto, establecerPrevIdArtefacto] = useState<string | undefined>(undefined)
  if (prevIdArtefacto !== artefactoActivo?.id) {
    establecerPrevIdArtefacto(artefactoActivo?.id)
    if (artefactoActivo) {
      establecerModoVistaPrevia(["markdown", "svg", "html", "latex"].includes(artefactoActivo.tipo))
      establecerModoEdicion(false)
      establecerContenidoEditado(null)
    }
  }

  // === Early return (todos los hooks ya fueron llamados) ===
  if (!artefactoActivo) return null

  const { tipo, titulo, contenido, lenguaje, totalLineas } = artefactoActivo
  // En modo edicion, usar el buffer local; fuera de edicion, el contenido del contexto
  const contenidoActual = contenidoEditado ?? contenido
  const nombreLenguaje = lenguaje ? (NOMBRES_LENGUAJE[lenguaje] ?? lenguaje) : tipo
  const tieneVistaPrevia = tipo === "html" || tipo === "svg" || tipo === "markdown" || tipo === "latex"
  const esPythonLenguaje = !!lenguaje && (lenguaje === "python" || lenguaje === "py")
  const tieneImportsInvalidos = esPythonLenguaje && validarImportsPython(contenidoActual).length > 0
  const tieneInput = esPythonLenguaje && detectarUsoInput(contenidoActual)
  // Ocultar boton Ejecutar completamente si: imports invalidos o usa input()
  const esEjecutable = !!lenguaje && esLenguajeEjecutable(lenguaje) && !tieneImportsInvalidos && !tieneInput
  const estaEjecutando = estadoEjecucion === "ejecutando" || estadoEjecucion === "cargando"

  function manejarDescarga() {
    const extension = lenguaje
      ? (EXTENSIONES_DESCARGA[lenguaje] ?? "txt")
      : tipo === "markdown" ? "md" : tipo === "svg" ? "svg" : tipo === "html" ? "html" : "txt"
    const nombreBase = titulo.includes(".") ? titulo : `${titulo}.${extension}`
    descargarArchivo(contenidoActual, nombreBase)
  }

  function alternarEdicion() {
    if (modoEdicion) {
      // Salir de edicion: persistir cambios al contexto y limpiar buffer local
      if (contenidoEditado !== null && contenidoEditado !== contenido) {
        const lineasEditadas = contenidoEditado.split("\n").length
        guardarEdicionUsuario(contenidoEditado, lineasEditadas)
      }
      establecerModoEdicion(false)
      establecerContenidoEditado(null)
      establecerModoVistaPrevia(tieneVistaPrevia)
    } else {
      // Entrar en edicion: inicializar buffer local desde contenido actual del contexto
      establecerModoEdicion(true)
      establecerContenidoEditado(contenido)
      establecerModoVistaPrevia(false)
    }
  }

  /** Maneja Tab (inserta 2 espacios) para edicion fluida sin perder foco */
  function manejarTeclaEdicion(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab") {
      e.preventDefault()
      const ta = e.currentTarget
      const inicio = ta.selectionStart
      const fin = ta.selectionEnd
      const nuevo = contenidoActual.slice(0, inicio) + "  " + contenidoActual.slice(fin)
      establecerContenidoEditado(nuevo)
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = inicio + 2
      })
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
            {nombreLenguaje} · {contenidoEditado ? contenidoActual.split("\n").length : totalLineas} lineas
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Botón Ejecutar (solo lenguajes ejecutables) */}
          {esEjecutable && (
            <button
              onClick={ejecutarArtefacto}
              disabled={estaEjecutando || artefactoActivo.estaCerrado === false}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors",
                estaEjecutando || artefactoActivo.estaCerrado === false
                  ? "text-[var(--color-claude-texto-secundario)] opacity-60"
                  : "text-emerald-600 hover:text-emerald-700 hover:bg-[var(--color-claude-sidebar-hover)]"
              )}
              title={estaEjecutando ? "Ejecutando..." : (artefactoActivo.estaCerrado === false ? "Esperando texto..." : "Ejecutar código")}
            >
              {estaEjecutando ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="hidden sm:inline">{estadoEjecucion === "cargando" ? "Cargando..." : "Ejecutando..."}</span>
                </>
              ) : artefactoActivo.estaCerrado === false ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="hidden sm:inline">Escribiendo...</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Ejecutar</span>
                </>
              )}
            </button>
          )}

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
            onClick={() => copiar(contenidoActual)}
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
        !(tieneVistaPrevia && modoVistaPrevia) && "bg-[var(--color-claude-sidebar)]"
      )}>
        <div ref={contenedorRef} className="absolute inset-0 overflow-auto">
          {modoEdicion ? (
            /* Modo edicion: patron overlay — textarea transparente sobre codigo resaltado.
               El usuario ve syntax highlighting y escribe en el textarea invisible.
               Los estilos (font, size, line-height, padding) estan sincronizados con
               oneLight + estiloCodigoPanel para alineacion pixel a pixel. */
            <div className="relative min-h-full">
              {/* Capa visual: codigo resaltado (solo presentacion) */}
              <div className="pointer-events-none select-none" aria-hidden="true">
                <CodigoConResaltado codigo={contenidoActual + "\n"} lenguaje={lenguaje ?? "text"} />
              </div>
              {/* Capa de input: textarea transparente superpuesto */}
              <textarea
                value={contenidoActual}
                onChange={manejarCambioEdicion}
                onKeyDown={manejarTeclaEdicion}
                className="absolute top-0 left-0 w-full h-full resize-none outline-none border-none bg-transparent selection:bg-blue-300/30"
                style={ESTILOS_EDITOR}
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
              />
            </div>
          ) : tieneVistaPrevia && modoVistaPrevia ? (
            tipo === "markdown" ? (
              <div className="p-6 prosa-markdown">
                <RenderizadorMarkdown contenido={contenidoActual} />
              </div>
            ) : tipo === "latex" ? (
              /* LaTeX preview: convertir estructura a Markdown, preservar fórmulas */
              <div className="p-6 prosa-markdown">
                <RenderizadorMarkdown contenido={convertirLatexAMarkdown(contenidoActual)} />
              </div>
            ) : (
              <VistaPreviaArtefacto contenido={contenidoActual} tipo={tipo as "html" | "svg"} />
            )
          ) : (
            <CodigoConResaltado codigo={contenidoActual} lenguaje={lenguaje ?? "text"} />
          )}
        </div>
      </div>

      {/* Consola de resultados de ejecucion (tema claro, solo si hay resultado o esta activo) */}
      {esEjecutable && (
        <ConsolaResultados
          resultado={resultadoEjecucion}
          estado={estadoEjecucion}
          estaAbierta={consolaAbierta}
          alAlternar={() => establecerConsolaAbierta(!consolaAbierta)}
        />
      )}
    </div>
  )
}
