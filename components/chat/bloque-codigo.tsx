"use client"

import { Copy, Check } from "lucide-react"
import { useCopiarAlPortapapeles } from "@/lib/hooks"
import { PrismLight as ResaltadorSintaxis } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"

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
// Mapa de nombres bonitos para mostrar en la etiqueta
const NOMBRES_LENGUAJE: Record<string, string> = {
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
  nim: "Nim"
}

interface PropiedadesBloqueCodigo {
  codigo: string
  lenguaje: string
}

const estiloCodigo = {
  margin: 0,
  padding: "1rem",
  fontSize: "0.85rem",
  background: "#1e1e1e",
  borderRadius: 0,
}

export function BloqueCodigoConResaltado({ codigo, lenguaje }: PropiedadesBloqueCodigo) {
  const { haCopiado, copiar } = useCopiarAlPortapapeles()
  const nombreLenguaje = NOMBRES_LENGUAJE[lenguaje] ?? lenguaje

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-[#2e2e2e] [&_code]:!bg-transparent">
      {/* Barra superior */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#171717]">
        <span className="text-xs text-gray-400 font-mono">{nombreLenguaje}</span>
        <button
          onClick={() => copiar(codigo)}
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
        customStyle={estiloCodigo}
        PreTag="div"
      >
        {codigo}
      </ResaltadorSintaxis>
    </div>
  )
}
