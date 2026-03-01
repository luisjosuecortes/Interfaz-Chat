// Worker dedicado para ejecucion de Python via Pyodide (WASM).
// Corre en su propio hilo para que bucles infinitos (while True) no congelen la UI.
// Incluye: carga lazy con Cache API, try/except/finally para matplotlib, captura stdout/stderr.

// === Tipos internos del Worker ===

/** Interfaz minima de Pyodide (evita dependencia de tipos completos) */
interface InstanciaPyodide {
  runPythonAsync: (codigo: string) => Promise<unknown>
  setStdout: (opciones: { batched: (texto: string) => void }) => void
  setStderr: (opciones: { batched: (texto: string) => void }) => void
  loadPackagesFromImports: (codigo: string) => Promise<void>
  globals: { get: (nombre: string) => unknown }
}

/** Mensaje entrante desde el hilo principal */
interface MensajeEntrante {
  tipo: "ejecutar"
  id: string
  codigo: string
}

// === Constantes ===

const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.27.5/full/"
const NOMBRE_CACHE_PYODIDE = "pyodide-v0.27.5"
const MARCADOR_IMAGEN_BASE64 = "__IMG_BASE64__:"

/** Paquetes disponibles en Pyodide 0.27.5 (top-level import names).
 *  Se usa para pre-validar imports y dar errores claros. */
const PAQUETES_PYODIDE_DISPONIBLES: Set<string> = new Set([
  // Stdlib
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

// === Cache API para Pyodide ===

/** Fetch con Cache API persistente (cache-first).
 *  Cachea WASM (~11MB), scripts JS y paquetes Python (.whl). */
async function fetchConCache(url: string, opciones?: RequestInit): Promise<Response> {
  if (typeof caches === "undefined") return fetch(url, opciones)

  try {
    const cache = await caches.open(NOMBRE_CACHE_PYODIDE)
    const enCache = await cache.match(url)
    if (enCache) return enCache

    const respuesta = await fetch(url, opciones)
    if (respuesta.ok) {
      await cache.put(url, respuesta.clone())
    }
    return respuesta
  } catch {
    return fetch(url, opciones)
  }
}

// === Singleton Pyodide dentro del Worker ===

let instanciaPyodide: InstanciaPyodide | null = null
let promesaCarga: Promise<InstanciaPyodide> | null = null

async function cargarPyodideEnWorker(): Promise<InstanciaPyodide> {
  if (instanciaPyodide) return instanciaPyodide
  if (promesaCarga) return promesaCarga

  self.postMessage({ tipo: "estado", estado: "cargando" })

  promesaCarga = (async () => {
    try {
      const { loadPyodide } = await import(/* webpackIgnore: true */ `${PYODIDE_CDN}pyodide.mjs`)
      const pyodide = await loadPyodide({
        indexURL: PYODIDE_CDN,
        fetch: fetchConCache,
      }) as InstanciaPyodide

      // Deshabilitar input() y sys.stdin (no disponible en WASM)
      await pyodide.runPythonAsync(`
import builtins, sys, io
sys.stdin = io.StringIO('')
def _no_input(prompt=''):
    raise EOFError('input() no disponible: el codigo se ejecuta en WebAssembly sin stdin interactivo.')
builtins.input = _no_input
`)

      instanciaPyodide = pyodide
      self.postMessage({ tipo: "estado", estado: "listo" })
      return pyodide
    } catch (error) {
      promesaCarga = null
      self.postMessage({ tipo: "estado", estado: "error" })
      throw error
    }
  })()

  return promesaCarga
}

// === Construccion del codigo Python con try/except/finally ===

/** Construye el codigo Python envuelto en try/except/finally para:
 *  1. Capturar excepciones del usuario sin perder figuras matplotlib
 *  2. Garantizar que el epilogue de matplotlib SIEMPRE se ejecute (incluso con error)
 *  3. Reportar la excepcion via traceback.print_exc()
 *  4. Auto-display de la ultima expresion (como REPL/Jupyter) si el usuario no uso print() */
function construirCodigoPython(codigoUsuario: string): string {
  // Indentar cada linea del codigo del usuario con 4 espacios
  const codigoIndentado = codigoUsuario
    .split("\n")
    .map(linea => linea.length === 0 ? "" : "    " + linea)
    .join("\n")

  // Hex-encode del source original para auto-display via ast (sin problemas de escaping)
  const hexCodigo = Array.from(
    new TextEncoder().encode(codigoUsuario),
    b => b.toString(16).padStart(2, "0"),
  ).join("")

  return `
import sys as __sys__
__tiene_matplotlib__ = False
try:
    import matplotlib
    matplotlib.use('agg')
    __tiene_matplotlib__ = True
except ImportError:
    pass

__excepcion_usuario__ = None
try:
${codigoIndentado}
    # Auto-display: si la ultima sentencia es una expresion desnuda (como REPL/Jupyter),
    # evaluar y mostrar su valor. Esto permite que codigo sin print() produzca output.
    try:
        import ast as __ast__
        __src__ = bytes.fromhex('${hexCodigo}').decode()
        __tree__ = __ast__.parse(__src__)
        if __tree__.body and isinstance(__tree__.body[-1], __ast__.Expr):
            __last__ = __tree__.body[-1]
            # No auto-display si ya es una llamada a print/pprint/display
            __skip__ = (isinstance(__last__.value, __ast__.Call) and
                        isinstance(getattr(__last__.value, 'func', None), __ast__.Name) and
                        getattr(__last__.value.func, 'id', '') in ('print', 'pprint', 'display'))
            if not __skip__:
                __auto_val__ = eval(compile(__ast__.Expression(body=__last__.value), '<auto>', 'eval'))
                if __auto_val__ is not None:
                    print(repr(__auto_val__))
    except:
        pass
except Exception as __e__:
    __excepcion_usuario__ = __e__
    import traceback as __tb__
    __tb__.print_exc()
finally:
    __sys__.stdout.flush()
    __sys__.stderr.flush()
    if __tiene_matplotlib__:
        import matplotlib.pyplot as __plt__
        import io as __io__
        import base64 as __b64__
        for __fig_num__ in __plt__.get_fignums():
            __buf__ = __io__.BytesIO()
            __plt__.figure(__fig_num__).savefig(__buf__, format='png', dpi=150, bbox_inches='tight', facecolor='white')
            __buf__.seek(0)
            __datos__ = __b64__.b64encode(__buf__.read()).decode('ascii')
            print(f'${MARCADOR_IMAGEN_BASE64}{__datos__}')
            __buf__.close()
        __plt__.close('all')
`
}

// === Validacion de imports ===

/** Extrae top-level imports del codigo Python */
function extraerImportsPython(codigo: string): string[] {
  const imports: string[] = []
  const regex = /^\s*(?:import|from)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm
  let match
  while ((match = regex.exec(codigo)) !== null) {
    imports.push(match[1])
  }
  return [...new Set(imports)]
}

/** Valida que todos los imports esten disponibles en Pyodide */
function validarImportsPython(codigo: string): string[] {
  const imports = extraerImportsPython(codigo)
  return imports.filter(pkg => !PAQUETES_PYODIDE_DISPONIBLES.has(pkg))
}

// === Handler principal del Worker ===

// Empezar a cargar Pyodide inmediatamente al instanciar el Worker
// Esto evita el deadlock donde el hilo principal espera "listo" para enviar "ejecutar"
cargarPyodideEnWorker().catch(err => {
  // El error ya se notifica dentro de la funcion, pero evitamos un unhandled promise rejection
  console.error("Fallo al precargar Pyodide en el worker", err)
})

self.onmessage = async (evento: MessageEvent<MensajeEntrante>) => {
  const { tipo, id, codigo } = evento.data

  if (tipo !== "ejecutar") return

  try {
    // 1. Cargar Pyodide si no esta listo
    const pyodide = await cargarPyodideEnWorker()

    // 2. Pre-validar imports
    const importsNoDisponibles = validarImportsPython(codigo)
    if (importsNoDisponibles.length > 0) {
      self.postMessage({
        tipo: "resultado",
        id,
        exito: false,
        error: `Paquete(s) no disponible(s) en Pyodide: ${importsNoDisponibles.join(", ")}. ` +
          `Solo se pueden usar paquetes incluidos en Pyodide 0.27.5 (numpy, scipy, pandas, sympy, sklearn, etc).`,
      })
      return
    }

    // 3. Cargar paquetes que el codigo importa
    try {
      await pyodide.loadPackagesFromImports(codigo)
    } catch (errorPaquete) {
      const msg = errorPaquete instanceof Error ? errorPaquete.message : String(errorPaquete)
      self.postMessage({
        tipo: "resultado",
        id,
        exito: false,
        error: `Error cargando paquetes: ${msg}`,
      })
      return
    }

    // 4. Redirigir stdout/stderr al hilo principal
    pyodide.setStdout({
      batched: (texto: string) => {
        self.postMessage({ tipo: "stdout", id, texto })
      },
    })
    pyodide.setStderr({
      batched: (texto: string) => {
        self.postMessage({ tipo: "stderr", id, texto })
      },
    })

    // 5. Ejecutar codigo envuelto en try/except/finally
    const codigoEnvuelto = construirCodigoPython(codigo)
    await pyodide.runPythonAsync(codigoEnvuelto)

    // 6. Verificar si hubo excepcion del usuario
    const excepcionUsuario = pyodide.globals.get("__excepcion_usuario__")
    const huboError = excepcionUsuario !== null && excepcionUsuario !== undefined

    self.postMessage({
      tipo: "resultado",
      id,
      exito: !huboError,
      // Si no hubo error, no enviamos valor extra (el output ya fue via stdout)
    })
  } catch (error) {
    // Error inesperado (carga de Pyodide, error interno, etc.)
    const mensaje = error instanceof Error ? error.message : String(error)
    self.postMessage({
      tipo: "resultado",
      id,
      exito: false,
      error: mensaje,
    })
  }
}
