"use client"

import { Copy, Check, FileCode2, FileText, Globe, Image, ChevronRight, Sigma } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useCopiarAlPortapapeles } from "@/lib/hooks"
import { useArtefacto } from "@/lib/contexto-artefacto"
import type { TipoArtefacto } from "@/lib/tipos"
import { PrismLight as ResaltadorSintaxis } from "react-syntax-highlighter"
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"
import { useMensaje } from "@/lib/contexto-mensaje"

// Importar lenguajes necesarios
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript"
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript"
import python from "react-syntax-highlighter/dist/esm/languages/prism/python"
import scala from "react-syntax-highlighter/dist/esm/languages/prism/scala"
import r from "react-syntax-highlighter/dist/esm/languages/prism/r"
import matlab from "react-syntax-highlighter/dist/esm/languages/prism/matlab"
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash"
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql"
import perl from "react-syntax-highlighter/dist/esm/languages/prism/perl"
import lua from "react-syntax-highlighter/dist/esm/languages/prism/lua"
import elixir from "react-syntax-highlighter/dist/esm/languages/prism/elixir"
import erlang from "react-syntax-highlighter/dist/esm/languages/prism/erlang"
import clojure from "react-syntax-highlighter/dist/esm/languages/prism/clojure"
import fsharp from "react-syntax-highlighter/dist/esm/languages/prism/fsharp"
import groovy from "react-syntax-highlighter/dist/esm/languages/prism/groovy"
import haskell from "react-syntax-highlighter/dist/esm/languages/prism/haskell"
import julia from "react-syntax-highlighter/dist/esm/languages/prism/julia"
import lisp from "react-syntax-highlighter/dist/esm/languages/prism/lisp"
import ocaml from "react-syntax-highlighter/dist/esm/languages/prism/ocaml"
import prolog from "react-syntax-highlighter/dist/esm/languages/prism/prolog"
import scheme from "react-syntax-highlighter/dist/esm/languages/prism/scheme"
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml"
import toml from "react-syntax-highlighter/dist/esm/languages/prism/toml"
import json from "react-syntax-highlighter/dist/esm/languages/prism/json"
import graphql from "react-syntax-highlighter/dist/esm/languages/prism/graphql"
import docker from "react-syntax-highlighter/dist/esm/languages/prism/docker"
import nginx from "react-syntax-highlighter/dist/esm/languages/prism/nginx"
import latex from "react-syntax-highlighter/dist/esm/languages/prism/latex"
import vim from "react-syntax-highlighter/dist/esm/languages/prism/vim"
import wasm from "react-syntax-highlighter/dist/esm/languages/prism/wasm"
import css from "react-syntax-highlighter/dist/esm/languages/prism/css"
import scss from "react-syntax-highlighter/dist/esm/languages/prism/scss"
import less from "react-syntax-highlighter/dist/esm/languages/prism/less"
import markup from "react-syntax-highlighter/dist/esm/languages/prism/markup"
import regex from "react-syntax-highlighter/dist/esm/languages/prism/regex"
import solidity from "react-syntax-highlighter/dist/esm/languages/prism/solidity"
import zig from "react-syntax-highlighter/dist/esm/languages/prism/zig"
import nim from "react-syntax-highlighter/dist/esm/languages/prism/nim"
import jsx from "react-syntax-highlighter/dist/esm/languages/prism/jsx"
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx"
import c from "react-syntax-highlighter/dist/esm/languages/prism/c"
import cpp from "react-syntax-highlighter/dist/esm/languages/prism/cpp"
import csharp from "react-syntax-highlighter/dist/esm/languages/prism/csharp"
import java from "react-syntax-highlighter/dist/esm/languages/prism/java"
import go from "react-syntax-highlighter/dist/esm/languages/prism/go"
import rust from "react-syntax-highlighter/dist/esm/languages/prism/rust"
import php from "react-syntax-highlighter/dist/esm/languages/prism/php"
import ruby from "react-syntax-highlighter/dist/esm/languages/prism/ruby"
import swift from "react-syntax-highlighter/dist/esm/languages/prism/swift"
import kotlin from "react-syntax-highlighter/dist/esm/languages/prism/kotlin"
import dart from "react-syntax-highlighter/dist/esm/languages/prism/dart"
import objectivec from "react-syntax-highlighter/dist/esm/languages/prism/objectivec"
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown"

// Registrar lenguajes
ResaltadorSintaxis.registerLanguage("javascript", javascript)
ResaltadorSintaxis.registerLanguage("js", javascript)
ResaltadorSintaxis.registerLanguage("typescript", typescript)
ResaltadorSintaxis.registerLanguage("ts", typescript)
ResaltadorSintaxis.registerLanguage("jsx", jsx)
ResaltadorSintaxis.registerLanguage("tsx", tsx)
ResaltadorSintaxis.registerLanguage("python", python)
ResaltadorSintaxis.registerLanguage("py", python)
ResaltadorSintaxis.registerLanguage("c", c)
ResaltadorSintaxis.registerLanguage("cpp", cpp)
ResaltadorSintaxis.registerLanguage("c++", cpp)
ResaltadorSintaxis.registerLanguage("csharp", csharp)
ResaltadorSintaxis.registerLanguage("cs", csharp)
ResaltadorSintaxis.registerLanguage("java", java)
ResaltadorSintaxis.registerLanguage("go", go)
ResaltadorSintaxis.registerLanguage("rust", rust)
ResaltadorSintaxis.registerLanguage("rs", rust)
ResaltadorSintaxis.registerLanguage("php", php)
ResaltadorSintaxis.registerLanguage("ruby", ruby)
ResaltadorSintaxis.registerLanguage("rb", ruby)
ResaltadorSintaxis.registerLanguage("swift", swift)
ResaltadorSintaxis.registerLanguage("kotlin", kotlin)
ResaltadorSintaxis.registerLanguage("kt", kotlin)
ResaltadorSintaxis.registerLanguage("dart", dart)
ResaltadorSintaxis.registerLanguage("objectivec", objectivec)
ResaltadorSintaxis.registerLanguage("objc", objectivec)
ResaltadorSintaxis.registerLanguage("scala", scala)
ResaltadorSintaxis.registerLanguage("r", r)
ResaltadorSintaxis.registerLanguage("matlab", matlab)
ResaltadorSintaxis.registerLanguage("bash", bash)
ResaltadorSintaxis.registerLanguage("sh", bash)
ResaltadorSintaxis.registerLanguage("shell", bash)
ResaltadorSintaxis.registerLanguage("sql", sql)
ResaltadorSintaxis.registerLanguage("perl", perl)
ResaltadorSintaxis.registerLanguage("lua", lua)
ResaltadorSintaxis.registerLanguage("elixir", elixir)
ResaltadorSintaxis.registerLanguage("erlang", erlang)
ResaltadorSintaxis.registerLanguage("clojure", clojure)
ResaltadorSintaxis.registerLanguage("fsharp", fsharp)
ResaltadorSintaxis.registerLanguage("groovy", groovy)
ResaltadorSintaxis.registerLanguage("haskell", haskell)
ResaltadorSintaxis.registerLanguage("julia", julia)
ResaltadorSintaxis.registerLanguage("lisp", lisp)
ResaltadorSintaxis.registerLanguage("ocaml", ocaml)
ResaltadorSintaxis.registerLanguage("prolog", prolog)
ResaltadorSintaxis.registerLanguage("scheme", scheme)
ResaltadorSintaxis.registerLanguage("yaml", yaml)
ResaltadorSintaxis.registerLanguage("yml", yaml)
ResaltadorSintaxis.registerLanguage("toml", toml)
ResaltadorSintaxis.registerLanguage("json", json)
ResaltadorSintaxis.registerLanguage("graphql", graphql)
ResaltadorSintaxis.registerLanguage("dockerfile", docker)
ResaltadorSintaxis.registerLanguage("docker", docker)
ResaltadorSintaxis.registerLanguage("nginx", nginx)
ResaltadorSintaxis.registerLanguage("latex", latex)
ResaltadorSintaxis.registerLanguage("tex", latex)
ResaltadorSintaxis.registerLanguage("vim", vim)
ResaltadorSintaxis.registerLanguage("wasm", wasm)
ResaltadorSintaxis.registerLanguage("css", css)
ResaltadorSintaxis.registerLanguage("scss", scss)
ResaltadorSintaxis.registerLanguage("less", less)
ResaltadorSintaxis.registerLanguage("html", markup)
ResaltadorSintaxis.registerLanguage("xml", markup)
ResaltadorSintaxis.registerLanguage("markup", markup)
ResaltadorSintaxis.registerLanguage("regex", regex)
ResaltadorSintaxis.registerLanguage("solidity", solidity)
ResaltadorSintaxis.registerLanguage("zig", zig)
ResaltadorSintaxis.registerLanguage("nim", nim)
ResaltadorSintaxis.registerLanguage("markdown", markdown)
ResaltadorSintaxis.registerLanguage("md", markdown)

// Mapa de nombres bonitos para mostrar en la etiqueta
export const NOMBRES_LENGUAJE: Record<string, string> = {
  javascript: "JavaScript",
  js: "JavaScript",
  typescript: "TypeScript",
  ts: "TypeScript",
  jsx: "JSX",
  tsx: "TSX",
  python: "Python",
  py: "Python",
  c: "C",
  cpp: "C++",
  "c++": "C++",
  csharp: "C#",
  cs: "C#",
  java: "Java",
  go: "Go",
  rust: "Rust",
  rs: "Rust",
  php: "PHP",
  ruby: "Ruby",
  rb: "Ruby",
  swift: "Swift",
  kotlin: "Kotlin",
  kt: "Kotlin",
  dart: "Dart",
  objectivec: "Objective-C",
  objc: "Objective-C",
  scala: "Scala",
  r: "R",
  matlab: "MATLAB",
  bash: "Bash",
  sh: "Bash",
  shell: "Shell",
  sql: "SQL",
  perl: "Perl",
  lua: "Lua",
  elixir: "Elixir",
  erlang: "Erlang",
  clojure: "Clojure",
  fsharp: "F#",
  groovy: "Groovy",
  haskell: "Haskell",
  julia: "Julia",
  lisp: "Lisp",
  ocaml: "OCaml",
  prolog: "Prolog",
  scheme: "Scheme",
  yaml: "YAML",
  yml: "YAML",
  toml: "TOML",
  json: "JSON",
  graphql: "GraphQL",
  dockerfile: "Dockerfile",
  docker: "Docker",
  nginx: "Nginx",
  latex: "LaTeX",
  tex: "LaTeX",
  vim: "Vim script",
  wasm: "WebAssembly",
  css: "CSS",
  scss: "SCSS",
  less: "LESS",
  html: "HTML",
  xml: "XML",
  markup: "Markup",
  markdown: "Markdown",
  md: "Markdown",
  regex: "RegEx",
  solidity: "Solidity",
  zig: "Zig",
  nim: "Nim",
  svg: "SVG",
}

// === Artefactos: detección y configuración ===

/** Número mínimo de líneas para considerar un bloque de código como artefacto */
const UMBRAL_LINEAS_ARTEFACTO = 25

/** Extensiones de archivo para descarga según lenguaje */
export const EXTENSIONES_DESCARGA: Record<string, string> = {
  javascript: "js", js: "js",
  typescript: "ts", ts: "ts",
  jsx: "jsx", tsx: "tsx",
  python: "py", py: "py",
  c: "c", cpp: "cpp", "c++": "cpp",
  csharp: "cs", cs: "cs",
  java: "java", go: "go",
  rust: "rs", rs: "rs",
  php: "php", ruby: "rb", rb: "rb",
  swift: "swift", kotlin: "kt", kt: "kt",
  dart: "dart", scala: "scala",
  bash: "sh", sh: "sh", shell: "sh",
  sql: "sql", lua: "lua",
  html: "html", markup: "html", xml: "xml",
  css: "css", scss: "scss", less: "less",
  json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
  markdown: "md", md: "md",
  dockerfile: "Dockerfile", docker: "Dockerfile",
  svg: "svg", graphql: "graphql",
  latex: "tex", tex: "tex",
  r: "r", matlab: "m",
  haskell: "hs", elixir: "ex", erlang: "erl",
  clojure: "clj", fsharp: "fs",
  julia: "jl", ocaml: "ml",
  solidity: "sol", zig: "zig", nim: "nim",
}

/** Genera un ID determinista y estable durante streaming.
 *  Usa solo los primeros 100 chars para que el ID no cambie mientras se appendea codigo. */
function generarIdArtefacto(contenido: string): string {
  let hash = 0
  const muestra = contenido.slice(0, 100)
  for (let i = 0; i < muestra.length; i++) {
    hash = ((hash << 5) - hash + muestra.charCodeAt(i)) | 0
  }
  return `art-${Math.abs(hash).toString(36)}`
}

/** Determina si un bloque de código debe mostrarse como artefacto en panel lateral */
function debeSerArtefacto(codigo: string, lenguaje: string, totalLineas: number): boolean {
  // LaTeX: siempre artefacto (se puede previsualizar con KaTeX)
  if (lenguaje === "latex" || lenguaje === "tex") return true
  // SVG: siempre artefacto (se puede previsualizar)
  if (lenguaje === "svg" || codigo.trimStart().startsWith("<svg")) return true
  // HTML completo: artefacto con vista previa
  if (
    (lenguaje === "html" || lenguaje === "markup") &&
    (codigo.includes("<!DOCTYPE") || codigo.includes("<html"))
  ) return true
  // Código largo (>= umbral de líneas)
  return totalLineas >= UMBRAL_LINEAS_ARTEFACTO
}

/** Determina el tipo de artefacto según lenguaje y contenido */
function determinarTipo(lenguaje: string, codigo: string): TipoArtefacto {
  if (lenguaje === "latex" || lenguaje === "tex") return "latex"
  if (lenguaje === "svg" || codigo.trimStart().startsWith("<svg")) return "svg"
  if (
    (lenguaje === "html" || lenguaje === "markup") &&
    (codigo.includes("<!DOCTYPE") || codigo.includes("<html"))
  ) return "html"
  if (lenguaje === "markdown" || lenguaje === "md") return "markdown"
  return "codigo"
}

/** Intenta inferir un título del código (busca nombre de archivo en la primera línea) */
function inferirTitulo(codigo: string, lenguaje: string): string {
  const primeraLinea = codigo.split("\n")[0].trim()
  // Buscar patrones de nombre de archivo en comentarios: // app.tsx, # main.py, <!-- index.html -->
  const patronArchivo = /^(?:\/\/|#|<!--)\s*(\S+\.\w+)/
  const coincidencia = patronArchivo.exec(primeraLinea)
  if (coincidencia) return coincidencia[1]
  // Fallback: nombre del lenguaje o genérico
  if (!lenguaje || lenguaje === "text") return "Código"
  return NOMBRES_LENGUAJE[lenguaje] ?? lenguaje
}

// === Tarjeta de artefacto (sustituye al bloque en el chat) ===

/** Mapa de iconos por tipo de artefacto */
const ICONOS_ARTEFACTO: Record<TipoArtefacto, typeof FileCode2> = {
  codigo: FileCode2,
  html: Globe,
  svg: Image,
  markdown: FileText,
  latex: Sigma,
}

interface PropiedadesTarjeta {
  tipo: TipoArtefacto
  lenguaje: string
  totalLineas: number
  titulo: string
  alAbrir: () => void
}

function TarjetaArtefacto({ tipo, lenguaje, totalLineas, titulo, alAbrir }: PropiedadesTarjeta) {
  const nombreLenguaje = NOMBRES_LENGUAJE[lenguaje] ?? lenguaje
  const Icono = ICONOS_ARTEFACTO[tipo]

  return (
    <button
      onClick={alAbrir}
      className="my-3 flex items-center gap-3 w-full max-w-md rounded-xl border border-[var(--color-claude-input-border)] bg-[var(--color-claude-sidebar)] hover:bg-[var(--color-claude-sidebar-hover)] px-4 py-3 transition-colors cursor-pointer text-left group"
    >
      <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-[#1e1e1e] text-gray-300 shrink-0">
        <Icono className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-[var(--color-claude-texto)] truncate">
          {titulo}
        </div>
        <div className="text-xs text-[var(--color-claude-texto-secundario)]">
          {nombreLenguaje} · {totalLineas} líneas
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-[var(--color-claude-texto-secundario)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </button>
  )
}

// === Props y estilos ===

interface PropiedadesBloqueCodigo {
  codigo: string
  lenguaje: string
  /** Deshabilita la detección de artefactos (usado dentro del panel lateral) */
  deshabilitarArtefacto?: boolean
}

/** Estilo para el panel de artefactos (fondo delegado al contenedor, overflow delegado) */
const estiloCodigoPanel = {
  margin: 0,
  padding: "1rem",
  fontSize: "0.85rem",
  background: "transparent",
  borderRadius: 0,
  overflow: "visible",
}

/** Estilo para bloques inline en el chat (fondo del tema oneLight) */
const estiloCodigoInline = {
  margin: 0,
  padding: "1rem",
  fontSize: "0.85rem",
  borderRadius: 0,
}

// === Componente principal: bloque de código con resaltado ===

export function BloqueCodigoConResaltado({ codigo, lenguaje, deshabilitarArtefacto }: PropiedadesBloqueCodigo) {
  const { haCopiado, copiar } = useCopiarAlPortapapeles()
  const { estaDisponible, abrirArtefacto, artefactoActivo, actualizarContenidoArtefacto } = useArtefacto()
  const contextoMensaje = useMensaje()
  const estaGenerandose = contextoMensaje?.estaGenerandose ?? false
  const nombreLenguaje = NOMBRES_LENGUAJE[lenguaje] ?? lenguaje
  const totalLineas = codigo.split("\n").length

  // Generar ID solo una vez al montar el código. Si el código está incompleto (streaming < 100 chars),
  // el hash temprano servirá inmutablemente como ID único de este bloque durante todo su ciclo de vida.
  const [idArtefacto] = useState(() => generarIdArtefacto(codigo))

  const esArtefactoValido = !deshabilitarArtefacto && estaDisponible && debeSerArtefacto(codigo, lenguaje, totalLineas)
  const seHaAutoAbierto = useRef(false)

  // Auto-Apertura Inteligente: abrir el panel solo si este mensaje SE ESTÁ generando ahora mismo
  useEffect(() => {
    if (estaGenerandose && esArtefactoValido && !seHaAutoAbierto.current) {
      seHaAutoAbierto.current = true;
      const titulo = inferirTitulo(codigo, lenguaje)
      const tipo = determinarTipo(lenguaje, codigo)
      abrirArtefacto({
        id: idArtefacto,
        tipo,
        titulo,
        contenido: codigo,
        lenguaje,
        totalLineas,
      })
    }
  }, [estaGenerandose, esArtefactoValido, codigo, lenguaje, totalLineas, idArtefacto, abrirArtefacto])

  // Sync en tiempo real: si el panel muestra este artefacto y el código cambió (streaming), actualizar
  useEffect(() => {
    if (artefactoActivo?.id === idArtefacto && artefactoActivo.contenido !== codigo) {
      actualizarContenidoArtefacto(codigo, totalLineas)
    }
  }, [codigo, totalLineas, artefactoActivo?.id, artefactoActivo?.contenido, idArtefacto, actualizarContenidoArtefacto])

  // Si califica como artefacto y el sistema está habilitado, mostrar tarjeta
  if (esArtefactoValido) {
    const titulo = inferirTitulo(codigo, lenguaje)
    const tipo = determinarTipo(lenguaje, codigo)
    return (
      <TarjetaArtefacto
        tipo={tipo}
        lenguaje={lenguaje}
        totalLineas={totalLineas}
        titulo={titulo}
        alAbrir={() => abrirArtefacto({
          id: idArtefacto,
          tipo,
          titulo,
          contenido: codigo,
          lenguaje,
          totalLineas,
        })}
      />
    )
  }

  // Bloque de código normal (inline, con cabecera y botón copiar)
  return (
    <div className="my-3 rounded-lg overflow-hidden border border-[var(--color-claude-input-border)] [&_code]:!bg-transparent">
      {/* Barra superior */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--color-claude-sidebar)]">
        <span className="text-xs text-[var(--color-claude-texto-secundario)] font-mono">{nombreLenguaje}</span>
        <button
          onClick={() => copiar(codigo)}
          className="flex items-center gap-1.5 text-xs text-[var(--color-claude-texto-secundario)] hover:text-[var(--color-claude-texto)] transition-colors"
        >
          {haCopiado ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span>Copiado</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>

      {/* Bloque de codigo con resaltado */}
      <ResaltadorSintaxis
        language={lenguaje}
        style={oneLight}
        customStyle={estiloCodigoInline}
        PreTag="div"
      >
        {codigo}
      </ResaltadorSintaxis>
    </div>
  )
}

// === Componente de código para el panel de artefactos (sin cabecera, sin detección) ===

export function CodigoConResaltado({ codigo, lenguaje }: { codigo: string; lenguaje: string }) {
  return (
    <div className="[&_code]:!bg-transparent">
      <ResaltadorSintaxis
        language={lenguaje}
        style={oneLight}
        customStyle={estiloCodigoPanel}
        PreTag="div"
      >
        {codigo}
      </ResaltadorSintaxis>
    </div>
  )
}
