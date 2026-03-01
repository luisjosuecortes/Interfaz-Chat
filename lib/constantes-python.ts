// Constantes y validadores compartidos entre el hilo principal (ejecutor-codigo.ts)
// y el Web Worker de Pyodide (worker-pyodide.ts).
// Extraidos aqui para evitar duplicacion: el Worker importa este modulo
// y webpack/turbopack lo incluye en su bundle separado automaticamente.

/** Marcador especial para imagenes base64 capturadas por matplotlib.
 *  Se usa como prefijo en stdout para identificar y convertir a entradas tipo "imagen". */
export const MARCADOR_IMAGEN_BASE64 = "__IMG_BASE64__:"

/** Paquetes disponibles en Pyodide 0.27.5 (top-level import names).
 *  Se usa para pre-validar imports en la UI (boton Ejecutar) y dar errores claros. */
export const PAQUETES_PYODIDE_DISPONIBLES: Set<string> = new Set([
  // Stdlib (siempre disponible)
  "json", "math", "statistics", "re", "datetime", "collections", "itertools",
  "functools", "operator", "string", "textwrap", "decimal", "fractions",
  "random", "hashlib", "base64", "urllib", "html", "xml", "csv", "io",
  "os", "sys", "copy", "pprint", "bisect", "heapq", "array", "struct",
  "cmath", "typing", "abc", "enum", "dataclasses", "contextlib", "warnings",
  "traceback", "inspect", "dis", "ast", "token", "tokenize", "numbers",
  "time", "calendar", "zlib", "gzip", "bz2", "lzma", "zipfile", "tarfile",
  "pathlib", "tempfile", "glob", "fnmatch", "shutil", "pickle", "shelve",
  "sqlite3", "unicodedata", "locale", "codecs", "difflib",
  "unittest", "doctest", "pdb", "logging", "argparse", "configparser",
  "secrets", "hmac", "uuid", "socket", "builtins", "types",
  // Paquetes cientificos de Pyodide
  "numpy", "scipy", "pandas", "sympy", "sklearn", "micropip", "matplotlib",
  "mpmath", "statsmodels", "pytz", "six", "packaging", "pyparsing",
  "dateutil", "regex", "pyyaml", "yaml", "jsonschema",
  "lxml", "parso", "jedi", "pygments",
])

/** Extrae los nombres de top-level imports del codigo Python.
 *  Detecta `import foo`, `from foo import bar`, `import foo as bar`. */
export function extraerImportsPython(codigo: string): string[] {
  const imports: string[] = []
  const regex = /^\s*(?:import|from)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm
  let match
  while ((match = regex.exec(codigo)) !== null) {
    imports.push(match[1])
  }
  return [...new Set(imports)]
}

/** Valida que todos los imports del codigo Python esten disponibles en Pyodide.
 *  Retorna lista de paquetes no disponibles (vacia si todo OK). */
export function validarImportsPython(codigo: string): string[] {
  const imports = extraerImportsPython(codigo)
  return imports.filter(pkg => !PAQUETES_PYODIDE_DISPONIBLES.has(pkg))
}
