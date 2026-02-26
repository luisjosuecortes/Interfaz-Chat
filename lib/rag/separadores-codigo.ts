// Registro centralizado de extensiones soportadas, prohibidas y separadores por lenguaje
// Usado por: worker-embeddings, fragmentador-texto, extractor-texto, procesador-rag, entrada-mensaje
// Patron: LangChain RecursiveCharacterTextSplitter adaptado al pipeline streaming

// === EXTENSIONES SOPORTADAS POR CATEGORIA ===

const WEB_FRONTEND = [
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".vue", ".svelte", ".astro",
  ".css", ".scss", ".sass", ".less",
  ".html", ".htm", ".svg",
]

const BACKEND_SISTEMAS = [
  ".c", ".cpp", ".h", ".hpp", ".cc",
  ".java", ".cs",
  ".go", ".rs", ".swift", ".kt",
  ".php", ".rb", ".dart",
]

const SCRIPTS_DATOS = [
  ".py", ".pyw",
  ".sh", ".bash", ".zsh", ".bat", ".ps1",
  ".r",
  ".csv", ".tsv",
  ".ipynb",
]

const CONFIGURACION = [
  ".json", ".yaml", ".yml", ".xml", ".toml",
  ".env", ".ini", ".cfg", ".conf",
  ".gitignore", ".dockerignore", ".editorconfig",
]

const DOCUMENTACION = [
  ".md", ".mdx", ".txt", ".rst", ".tex", ".log",
]

const BASES_DATOS = [
  ".sql", ".graphql", ".gql", ".prisma",
]

// Set unificado de TODAS las extensiones soportadas (incluye .pdf que se maneja aparte)
export const EXTENSIONES_SOPORTADAS = new Set([
  ...WEB_FRONTEND,
  ...BACKEND_SISTEMAS,
  ...SCRIPTS_DATOS,
  ...CONFIGURACION,
  ...DOCUMENTACION,
  ...BASES_DATOS,
  ".pdf",
])

// === ARCHIVOS CONOCIDOS SIN EXTENSION ===

export const NOMBRES_ARCHIVO_CONOCIDOS = new Set([
  "dockerfile",
  "makefile",
  "gemfile",
  "rakefile",
  "procfile",
  "vagrantfile",
  "jenkinsfile",
  "cmakelists.txt",
])

// === EXTENSIONES PROHIBIDAS (lista negra) ===

export const EXTENSIONES_PROHIBIDAS = new Set([
  // Minificados / compilados
  ".min.js", ".min.css", ".map",
  // Binarios / ejecutables
  ".exe", ".dll", ".so", ".class", ".o", ".pyc", ".wasm",
  ".jar", ".war", ".aar",
  // Bases de datos crudas
  ".sqlite", ".db", ".sqlite3",
  // Multimedia (las imagenes se manejan por separado como multimodal)
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".ico",
  ".mp4", ".mp3", ".wav", ".avi", ".mov", ".flac", ".ogg",
  ".zip", ".tar", ".gz", ".rar", ".7z",
])

// Nombres de archivos prohibidos (lockfiles y generados)
const NOMBRES_PROHIBIDOS = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "gemfile.lock",
  "composer.lock",
  "poetry.lock",
  "cargo.lock",
  "bun.lockb",
])

// === SEPARADORES POR LENGUAJE ===
// Jerarquia: separadores de lenguaje (mas especificos) → genericos (parrafo, linea, espacio)
// Los separadores estan ordenados del mas especifico al menos especifico

const separadoresTypeScript = [
  "\nexport default function ", "\nexport function ", "\nexport class ",
  "\nexport interface ", "\nexport type ", "\nexport const ", "\nexport enum ",
  "\nfunction ", "\nclass ", "\ninterface ", "\ntype ",
  "\nconst ", "\nlet ", "\nvar ",
  "\nif ", "\nfor ", "\nwhile ", "\nswitch ",
  "\n\n", "\n",
]

const separadoresJavaScript = [
  "\nexport default function ", "\nexport function ", "\nexport class ",
  "\nfunction ", "\nclass ",
  "\nconst ", "\nlet ", "\nvar ",
  "\nif ", "\nfor ", "\nwhile ", "\nswitch ",
  "\n\n", "\n",
]

const separadoresPython = [
  "\nclass ", "\ndef ", "\nasync def ",
  "\n\tdef ", "\n\tasync def ",
  "\n    def ", "\n    async def ",
  "\nif ", "\nfor ", "\nwhile ", "\ntry ", "\nwith ",
  "\n\n", "\n",
]

const separadoresGo = [
  "\nfunc ", "\ntype ", "\nvar ", "\nconst ",
  "\nif ", "\nfor ", "\nswitch ", "\nselect ",
  "\n\n", "\n",
]

const separadoresRust = [
  "\npub fn ", "\npub async fn ", "\nfn ", "\nasync fn ",
  "\npub struct ", "\nstruct ", "\npub enum ", "\nenum ",
  "\nimpl ", "\npub trait ", "\ntrait ",
  "\npub mod ", "\nmod ", "\npub use ", "\nuse ",
  "\nif ", "\nfor ", "\nwhile ", "\nmatch ", "\nloop ",
  "\n\n", "\n",
]

const separadoresJava = [
  "\npublic class ", "\nprivate class ", "\nprotected class ", "\nclass ",
  "\npublic interface ", "\ninterface ",
  "\npublic static ", "\npublic ", "\nprivate ", "\nprotected ",
  "\n@Override", "\n@",
  "\nif ", "\nfor ", "\nwhile ", "\nswitch ", "\ntry ",
  "\n\n", "\n",
]

const separadoresCSharp = [
  "\npublic class ", "\nprivate class ", "\ninternal class ", "\nclass ",
  "\npublic interface ", "\ninterface ",
  "\npublic static ", "\npublic ", "\nprivate ", "\nprotected ", "\ninternal ",
  "\nnamespace ",
  "\nif ", "\nfor ", "\nwhile ", "\nswitch ", "\ntry ",
  "\n\n", "\n",
]

const separadoresC = [
  "\nvoid ", "\nint ", "\nchar ", "\nfloat ", "\ndouble ", "\nlong ",
  "\nstatic ", "\nextern ", "\ntypedef ", "\nstruct ", "\nenum ",
  "\n#include ", "\n#define ", "\n#ifdef ", "\n#ifndef ",
  "\nif ", "\nfor ", "\nwhile ", "\nswitch ",
  "\n\n", "\n",
]

const separadoresCpp = [
  "\nclass ", "\nnamespace ", "\ntemplate ",
  "\nvoid ", "\nint ", "\nauto ",
  "\nstatic ", "\nvirtual ", "\nextern ",
  "\n#include ", "\n#define ",
  "\npublic:", "\nprivate:", "\nprotected:",
  "\nif ", "\nfor ", "\nwhile ", "\nswitch ",
  "\n\n", "\n",
]

const separadoresPhp = [
  "\nfunction ", "\nclass ", "\ninterface ", "\ntrait ", "\nnamespace ",
  "\npublic function ", "\nprivate function ", "\nprotected function ",
  "\npublic static ", "\npublic ", "\nprivate ", "\nprotected ",
  "\nif ", "\nfor ", "\nwhile ", "\nswitch ", "\ntry ",
  "\n\n", "\n",
]

const separadoresRuby = [
  "\nclass ", "\nmodule ", "\ndef ", "\nself.",
  "\nif ", "\nunless ", "\nwhile ", "\nuntil ", "\ndo ",
  "\nbegin ", "\nrescue ",
  "\n\n", "\n",
]

const separadoresSwift = [
  "\nfunc ", "\nclass ", "\nstruct ", "\nenum ", "\nprotocol ",
  "\nextension ", "\nimport ",
  "\npublic ", "\nprivate ", "\ninternal ", "\nopen ",
  "\nif ", "\nfor ", "\nwhile ", "\nswitch ", "\nguard ",
  "\n\n", "\n",
]

const separadoresKotlin = [
  "\nfun ", "\nclass ", "\ndata class ", "\nsealed class ",
  "\nobject ", "\ninterface ", "\nenum class ",
  "\nprivate fun ", "\ninternal fun ", "\noverride fun ",
  "\nif ", "\nfor ", "\nwhile ", "\nwhen ",
  "\n\n", "\n",
]

const separadoresDart = [
  "\nclass ", "\nabstract class ", "\nmixin ",
  "\nvoid ", "\nFuture ", "\nStream ",
  "\nfinal ", "\nconst ", "\nvar ", "\nlate ",
  "\nif ", "\nfor ", "\nwhile ", "\nswitch ",
  "\n\n", "\n",
]

const separadoresShell = [
  "\nfunction ", "\n# ---",
  "\nif ", "\nfor ", "\nwhile ", "\ncase ",
  "\n\n", "\n",
]

const separadoresSQL = [
  "\nCREATE TABLE ", "\nCREATE INDEX ", "\nCREATE VIEW ",
  "\nCREATE FUNCTION ", "\nCREATE PROCEDURE ",
  "\nALTER TABLE ", "\nDROP TABLE ",
  "\nSELECT ", "\nINSERT ", "\nUPDATE ", "\nDELETE ",
  "\nWITH ",
  "\n\n", "\n",
]

const separadoresCSS = [
  "\n@media ", "\n@keyframes ", "\n@import ", "\n@font-face ",
  "\n.", "\n#", "\n:",
  "\n\n", "\n",
]

const separadoresHTML = [
  "\n<template", "\n<script", "\n<style",
  "\n<div", "\n<section", "\n<article", "\n<header", "\n<footer",
  "\n<nav", "\n<main", "\n<form",
  "\n<h1", "\n<h2", "\n<h3",
  "\n\n", "\n",
]

const separadoresMarkdown = [
  "\n## ", "\n### ", "\n#### ", "\n# ",
  "\n```", "\n---", "\n***",
  "\n- ", "\n* ", "\n1. ",
  "\n\n", "\n",
]

const separadoresYAML = [
  "\n---",
  "\n\n", "\n",
]

const separadoresGraphQL = [
  "\ntype ", "\ninput ", "\nenum ", "\ninterface ",
  "\nquery ", "\nmutation ", "\nsubscription ",
  "\nfragment ", "\nscalar ",
  "\n\n", "\n",
]

const separadoresPrisma = [
  "\nmodel ", "\nenum ", "\ntype ", "\ndatasource ", "\ngenerator ",
  "\n\n", "\n",
]

const separadoresR = [
  "\n<- function",
  "\nif ", "\nfor ", "\nwhile ", "\nrepeat ",
  "\nlibrary(", "\nrequire(",
  "\n\n", "\n",
]

const separadoresNotebook = [
  "\n## ", "\n### ", "\n# ",
  "\n```",
  "\n---",
  "\nclass ", "\ndef ", "\nasync def ",
  "\n\n", "\n",
]

// Separadores genericos para archivos sin separadores especificos
const separadoresGenericos = ["\n\n", "\n"]

// Mapa de extension → separadores de lenguaje
const MAPA_SEPARADORES: Record<string, string[]> = {
  // TypeScript / JavaScript
  ".ts": separadoresTypeScript,
  ".tsx": separadoresTypeScript,
  ".mjs": separadoresJavaScript,
  ".cjs": separadoresJavaScript,
  ".js": separadoresJavaScript,
  ".jsx": separadoresJavaScript,

  // Frameworks web (usan separadores HTML + script)
  ".vue": separadoresHTML,
  ".svelte": separadoresHTML,
  ".astro": separadoresHTML,

  // Estilos
  ".css": separadoresCSS,
  ".scss": separadoresCSS,
  ".sass": separadoresCSS,
  ".less": separadoresCSS,

  // Marcado
  ".html": separadoresHTML,
  ".htm": separadoresHTML,
  ".svg": separadoresHTML,

  // Backend / Sistemas
  ".c": separadoresC,
  ".h": separadoresC,
  ".cpp": separadoresCpp,
  ".hpp": separadoresCpp,
  ".cc": separadoresCpp,
  ".java": separadoresJava,
  ".cs": separadoresCSharp,
  ".go": separadoresGo,
  ".rs": separadoresRust,
  ".swift": separadoresSwift,
  ".kt": separadoresKotlin,
  ".php": separadoresPhp,
  ".rb": separadoresRuby,
  ".dart": separadoresDart,

  // Scripts
  ".py": separadoresPython,
  ".pyw": separadoresPython,
  ".sh": separadoresShell,
  ".bash": separadoresShell,
  ".zsh": separadoresShell,
  ".bat": separadoresShell,
  ".ps1": separadoresShell,
  ".r": separadoresR,

  // Notebooks
  ".ipynb": separadoresNotebook,

  // Config jerarquica
  ".yaml": separadoresYAML,
  ".yml": separadoresYAML,
  ".toml": separadoresYAML,

  // Documentacion
  ".md": separadoresMarkdown,
  ".mdx": separadoresMarkdown,
  ".rst": separadoresMarkdown,
  ".tex": separadoresMarkdown,

  // Bases de datos / consultas
  ".sql": separadoresSQL,
  ".graphql": separadoresGraphQL,
  ".gql": separadoresGraphQL,
  ".prisma": separadoresPrisma,
}

// === FUNCIONES PUBLICAS ===

/** Extrae la extension de un nombre de archivo (maneja dotfiles como .gitignore) */
export function extraerExtension(nombreArchivo: string): string {
  const nombre = nombreArchivo.toLowerCase()
  const ultimoPunto = nombre.lastIndexOf(".")
  if (ultimoPunto <= 0) return "" // Sin extension o dotfile sin extension
  return nombre.slice(ultimoPunto)
}

/** Obtiene los separadores de lenguaje para un archivo, o null si no tiene especificos */
export function obtenerSeparadores(nombreArchivo: string): string[] | null {
  const nombre = nombreArchivo.toLowerCase()

  // Verificar nombres de archivo conocidos sin extension
  if (NOMBRES_ARCHIVO_CONOCIDOS.has(nombre)) {
    // Dockerfile → shell-like, Makefile → shell-like
    if (nombre === "dockerfile" || nombre === "makefile" || nombre === "jenkinsfile")
      return separadoresShell
    return separadoresGenericos
  }

  const extension = extraerExtension(nombreArchivo)
  if (!extension) return null

  // Dotfiles especiales
  if (extension === ".gitignore" || extension === ".dockerignore" || extension === ".editorconfig")
    return separadoresGenericos

  return MAPA_SEPARADORES[extension] ?? null
}

/** Verifica si un archivo es soportado para procesamiento RAG */
export function esArchivoSoportado(nombreArchivo: string): boolean {
  if (esArchivoProhibido(nombreArchivo)) return false

  const nombre = nombreArchivo.toLowerCase()
  if (NOMBRES_ARCHIVO_CONOCIDOS.has(nombre)) return true

  const extension = extraerExtension(nombreArchivo)
  return extension ? EXTENSIONES_SOPORTADAS.has(extension) : false
}

/** Verifica si un archivo esta en la lista negra */
export function esArchivoProhibido(nombreArchivo: string): boolean {
  const nombre = nombreArchivo.toLowerCase()

  // Verificar nombres de archivo prohibidos (lockfiles)
  if (NOMBRES_PROHIBIDOS.has(nombre)) return true

  // Verificar extension prohibida
  const extension = extraerExtension(nombreArchivo)
  if (extension && EXTENSIONES_PROHIBIDAS.has(extension)) return true

  // Verificar patron .min.js / .min.css (pueden tener path)
  if (nombre.endsWith(".min.js") || nombre.endsWith(".min.css")) return true

  return false
}

/** Genera la cadena de extensiones aceptadas para el input de archivos HTML */
export function generarAceptarExtensiones(): string {
  const extensiones = Array.from(EXTENSIONES_SOPORTADAS)
  return extensiones.join(",")
}
