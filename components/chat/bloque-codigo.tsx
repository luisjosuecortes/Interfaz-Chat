"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { PrismLight as ResaltadorSintaxis } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"

// Importar lenguajes necesarios
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript"
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript"
import python from "react-syntax-highlighter/dist/esm/languages/prism/python"
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash"
import json from "react-syntax-highlighter/dist/esm/languages/prism/json"
import css from "react-syntax-highlighter/dist/esm/languages/prism/css"
import markup from "react-syntax-highlighter/dist/esm/languages/prism/markup"
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql"
import java from "react-syntax-highlighter/dist/esm/languages/prism/java"
import csharp from "react-syntax-highlighter/dist/esm/languages/prism/csharp"
import go from "react-syntax-highlighter/dist/esm/languages/prism/go"
import rust from "react-syntax-highlighter/dist/esm/languages/prism/rust"
import php from "react-syntax-highlighter/dist/esm/languages/prism/php"
import ruby from "react-syntax-highlighter/dist/esm/languages/prism/ruby"
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml"
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown"
import docker from "react-syntax-highlighter/dist/esm/languages/prism/docker"
import jsx from "react-syntax-highlighter/dist/esm/languages/prism/jsx"
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx"
import c from "react-syntax-highlighter/dist/esm/languages/prism/c"
import cpp from "react-syntax-highlighter/dist/esm/languages/prism/cpp"
import swift from "react-syntax-highlighter/dist/esm/languages/prism/swift"
import kotlin from "react-syntax-highlighter/dist/esm/languages/prism/kotlin"
import dart from "react-syntax-highlighter/dist/esm/languages/prism/dart"
import objectivec from "react-syntax-highlighter/dist/esm/languages/prism/objectivec"
import scala from "react-syntax-highlighter/dist/esm/languages/prism/scala"
import r from "react-syntax-highlighter/dist/esm/languages/prism/r"

// Registrar lenguajes
ResaltadorSintaxis.registerLanguage("javascript", javascript)
ResaltadorSintaxis.registerLanguage("js", javascript)
ResaltadorSintaxis.registerLanguage("typescript", typescript)
ResaltadorSintaxis.registerLanguage("ts", typescript)
ResaltadorSintaxis.registerLanguage("python", python)
ResaltadorSintaxis.registerLanguage("py", python)
ResaltadorSintaxis.registerLanguage("bash", bash)
ResaltadorSintaxis.registerLanguage("sh", bash)
ResaltadorSintaxis.registerLanguage("shell", bash)
ResaltadorSintaxis.registerLanguage("json", json)
ResaltadorSintaxis.registerLanguage("css", css)
ResaltadorSintaxis.registerLanguage("html", markup)
ResaltadorSintaxis.registerLanguage("xml", markup)
ResaltadorSintaxis.registerLanguage("markup", markup)
ResaltadorSintaxis.registerLanguage("sql", sql)
ResaltadorSintaxis.registerLanguage("java", java)
ResaltadorSintaxis.registerLanguage("csharp", csharp)
ResaltadorSintaxis.registerLanguage("cs", csharp)
ResaltadorSintaxis.registerLanguage("go", go)
ResaltadorSintaxis.registerLanguage("rust", rust)
ResaltadorSintaxis.registerLanguage("rs", rust)
ResaltadorSintaxis.registerLanguage("php", php)
ResaltadorSintaxis.registerLanguage("ruby", ruby)
ResaltadorSintaxis.registerLanguage("rb", ruby)
ResaltadorSintaxis.registerLanguage("yaml", yaml)
ResaltadorSintaxis.registerLanguage("yml", yaml)
ResaltadorSintaxis.registerLanguage("markdown", markdown)
ResaltadorSintaxis.registerLanguage("md", markdown)
ResaltadorSintaxis.registerLanguage("dockerfile", docker)
ResaltadorSintaxis.registerLanguage("docker", docker)
ResaltadorSintaxis.registerLanguage("jsx", jsx)
ResaltadorSintaxis.registerLanguage("tsx", tsx)
ResaltadorSintaxis.registerLanguage("c", c)
ResaltadorSintaxis.registerLanguage("cpp", cpp)
ResaltadorSintaxis.registerLanguage("c++", cpp)
ResaltadorSintaxis.registerLanguage("swift", swift)
ResaltadorSintaxis.registerLanguage("kotlin", kotlin)
ResaltadorSintaxis.registerLanguage("kt", kotlin)
ResaltadorSintaxis.registerLanguage("dart", dart)
ResaltadorSintaxis.registerLanguage("objectivec", objectivec)
ResaltadorSintaxis.registerLanguage("objc", objectivec)
ResaltadorSintaxis.registerLanguage("scala", scala)
ResaltadorSintaxis.registerLanguage("r", r)

// Mapa de nombres bonitos para mostrar en la etiqueta
const NOMBRES_LENGUAJE: Record<string, string> = {
  javascript: "JavaScript",
  js: "JavaScript",
  typescript: "TypeScript",
  ts: "TypeScript",
  python: "Python",
  py: "Python",
  bash: "Bash",
  sh: "Bash",
  shell: "Shell",
  json: "JSON",
  css: "CSS",
  html: "HTML",
  xml: "XML",
  sql: "SQL",
  java: "Java",
  csharp: "C#",
  cs: "C#",
  go: "Go",
  rust: "Rust",
  rs: "Rust",
  php: "PHP",
  ruby: "Ruby",
  rb: "Ruby",
  yaml: "YAML",
  yml: "YAML",
  markdown: "Markdown",
  md: "Markdown",
  dockerfile: "Dockerfile",
  docker: "Docker",
  jsx: "JSX",
  tsx: "TSX",
  c: "C",
  cpp: "C++",
  "c++": "C++",
  swift: "Swift",
  kotlin: "Kotlin",
  kt: "Kotlin",
  dart: "Dart",
  objectivec: "Objective-C",
  objc: "Objective-C",
  scala: "Scala",
  r: "R",
}

interface PropiedadesBloqueCodigo {
  codigo: string
  lenguaje: string
}

export function BloqueCodigoConResaltado({ codigo, lenguaje }: PropiedadesBloqueCodigo) {
  const [haCopiado, establecerHaCopiado] = useState(false)

  const nombreLenguaje = NOMBRES_LENGUAJE[lenguaje] ?? lenguaje

  async function copiarCodigo() {
    await navigator.clipboard.writeText(codigo)
    establecerHaCopiado(true)
    setTimeout(() => establecerHaCopiado(false), 2000)
  }

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-[#374151]">
      {/* Barra superior */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1e1e2e]">
        <span className="text-xs text-gray-400 font-mono">{nombreLenguaje}</span>
        <button
          onClick={copiarCodigo}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
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
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: "1rem",
          fontSize: "0.85rem",
          background: "#282c34",
          borderRadius: 0,
        }}
        PreTag="div"
      >
        {codigo}
      </ResaltadorSintaxis>
    </div>
  )
}
