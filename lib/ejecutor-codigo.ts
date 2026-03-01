// Motor de ejecucion de codigo local en el navegador
// JavaScript/TypeScript: iframe sandboxed aislado (nuevo por cada ejecucion)
// Python: Pyodide WASM (singleton lazy, cacheado persistentemente via Cache API)

import type { ResultadoEjecucion, EntradaConsola } from "./tipos"

// === Constantes ===

/** Lenguajes que se pueden ejecutar en el navegador */
const LENGUAJES_EJECUTABLES: Set<string> = new Set([
  "javascript", "js", "typescript", "ts", "jsx", "tsx", "python", "py",
])

/** Tiempo maximo de ejecucion antes de interrumpir (ms) */
const TIMEOUT_EJECUCION_MS = 10_000

/** Paquetes disponibles en Pyodide 0.27.5 (top-level import names).
 *  Se usa para pre-validar imports y dar errores claros en vez de ModuleNotFoundError criptico. */
const PAQUETES_PYODIDE_DISPONIBLES: Set<string> = new Set([
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

/** URL del CDN de Pyodide (version estable) */
const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.27.5/full/"

/** Nombre del cache persistente para Pyodide y paquetes */
const NOMBRE_CACHE_PYODIDE = "pyodide-v0.27.5"

/** Identificador de origen para filtrar postMessages del sandbox */
const ORIGEN_SANDBOX = "__ejecutor_penguin__"

/** Marcador especial para imágenes base64 capturadas por matplotlib.
 *  Se usa como prefijo en stdout para identificar y convertir a entradas tipo "imagen". */
const MARCADOR_IMAGEN_BASE64 = "__IMG_BASE64__:"

/** Preamble Python: configura matplotlib con backend Agg (no-GUI) ANTES de cualquier import del usuario.
 *  Esto es necesario porque Pyodide corre en WASM sin servidor X11/display. */
const PREAMBLE_MATPLOTLIB = `
import sys as __sys__
__tiene_matplotlib__ = False
try:
    import matplotlib
    matplotlib.use('agg')
    __tiene_matplotlib__ = True
except ImportError:
    pass
`

/** Epilogue Python: captura todas las figuras matplotlib abiertas como PNG base64.
 *  Imprime cada imagen con el marcador especial para post-procesamiento. */
const EPILOGUE_MATPLOTLIB = `
if __tiene_matplotlib__:
    import matplotlib.pyplot as __plt__
    import io as __io__
    import base64 as __b64__
    for __fig__ in __plt__.get_fignums():
        __buf__ = __io__.BytesIO()
        __plt__.figure(__fig__).savefig(__buf__, format='png', dpi=150, bbox_inches='tight', facecolor='white')
        __buf__.seek(0)
        __datos__ = __b64__.b64encode(__buf__.read()).decode('ascii')
        print(f'__IMG_BASE64__:{__datos__}')
        __buf__.close()
    __plt__.close('all')
`

// === Utilidades ===

/** Verifica si un lenguaje soporta ejecucion */
export function esLenguajeEjecutable(lenguaje: string): boolean {
  return LENGUAJES_EJECUTABLES.has(lenguaje.toLowerCase())
}

/** Normaliza alias de lenguaje a la familia base */
function normalizarLenguaje(lenguaje: string): "javascript" | "python" {
  const l = lenguaje.toLowerCase()
  if (l === "python" || l === "py") return "python"
  return "javascript"
}

/** Extrae los nombres de top-level imports del codigo Python.
 *  Detecta `import foo`, `from foo import bar`, `import foo as bar`. */
function extraerImportsPython(codigo: string): string[] {
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

/** Detecta si el codigo Python usa input() (no disponible en WASM).
 *  Busca llamadas a input( precedidas por espacio, inicio de linea, = u otro operador. */
export function detectarUsoInput(codigo: string): boolean {
  return /(?:^|[\s=(,])input\s*\(/m.test(codigo)
}

// === Cache API para Pyodide ===

/** Fetch con Cache API persistente.
 *  Estrategia cache-first: si el recurso esta en Cache API, retornar sin red.
 *  Cachea automaticamente WASM, JS, y paquetes Python (.whl) de Pyodide.
 *  La Cache API persiste entre sesiones (no se borra al cerrar el navegador). */
async function fetchConCache(url: string, opciones?: RequestInit): Promise<Response> {
  // Si Cache API no esta disponible (SSR, workers sin cache), usar fetch normal
  if (typeof caches === "undefined") return fetch(url, opciones)

  try {
    const cache = await caches.open(NOMBRE_CACHE_PYODIDE)
    const enCache = await cache.match(url)
    if (enCache) return enCache

    const respuesta = await fetch(url, opciones)
    if (respuesta.ok) {
      // Clonar porque el body solo se puede consumir una vez
      await cache.put(url, respuesta.clone())
    }
    return respuesta
  } catch {
    // Si Cache API falla, intentar fetch normal
    return fetch(url, opciones)
  }
}

/** Solicita almacenamiento persistente para que el navegador no evicte el cache */
async function solicitarAlmacenamientoPersistente() {
  try {
    if (navigator.storage?.persist) {
      await navigator.storage.persist()
    }
  } catch {
    // Ignorar si no esta disponible
  }
}

// === Ejecutor JavaScript/TypeScript via iframe sandboxed ===

/** Ejecuta JavaScript/TypeScript en un iframe sandboxed aislado.
 *  Crea un iframe nuevo para cada ejecucion (no reutiliza) por seguridad.
 *  Captura console.log, console.error, console.warn y el valor de retorno.
 *  Incluye CSP para bloquear acceso a red desde el sandbox.
 *  Timeout via setTimeout en el padre + terminacion del iframe. */
function ejecutarJavaScript(codigo: string): Promise<ResultadoEjecucion> {
  return new Promise((resolve) => {
    const salidas: EntradaConsola[] = []
    const inicio = performance.now()
    let resuelto = false

    // Crear iframe aislado (nuevo por cada ejecucion)
    const iframe = document.createElement("iframe")
    iframe.sandbox.add("allow-scripts")
    iframe.style.display = "none"
    document.body.appendChild(iframe)

    function limpiar() {
      clearTimeout(temporizador)
      window.removeEventListener("message", manejarMensaje)
      setTimeout(() => {
        try { document.body.removeChild(iframe) } catch { /* ya eliminado */ }
      }, 100)
    }

    // Timeout: interrumpir ejecucion si excede el limite
    const temporizador = setTimeout(() => {
      if (resuelto) return
      resuelto = true
      limpiar()
      salidas.push({
        tipo: "error",
        contenido: `Ejecucion interrumpida: excedio el limite de ${TIMEOUT_EJECUCION_MS / 1000}s`,
        marcaTiempo: performance.now() - inicio,
      })
      resolve({
        exito: false,
        salidas,
        duracionMs: performance.now() - inicio,
        interrumpido: true,
      })
    }, TIMEOUT_EJECUCION_MS)

    function manejarMensaje(evento: MessageEvent) {
      // Solo aceptar mensajes del iframe que creamos
      if (evento.source !== iframe.contentWindow) return
      const datos = evento.data
      if (!datos || typeof datos !== "object" || datos.__origen !== ORIGEN_SANDBOX) return

      if (datos.tipo === "consola") {
        salidas.push({
          tipo: datos.nivel === "error" || datos.nivel === "warn" ? "stderr" : "stdout",
          contenido: datos.texto,
          marcaTiempo: performance.now() - inicio,
        })
      } else if (datos.tipo === "resultado") {
        if (datos.valor !== undefined && datos.valor !== "undefined") {
          salidas.push({
            tipo: "resultado",
            contenido: datos.valor,
            marcaTiempo: performance.now() - inicio,
          })
        }
        if (!resuelto) {
          resuelto = true
          limpiar()
          resolve({ exito: true, salidas, duracionMs: performance.now() - inicio })
        }
      } else if (datos.tipo === "error") {
        salidas.push({
          tipo: "error",
          contenido: datos.mensaje,
          marcaTiempo: performance.now() - inicio,
        })
        if (!resuelto) {
          resuelto = true
          limpiar()
          resolve({ exito: false, salidas, duracionMs: performance.now() - inicio })
        }
      }
    }

    window.addEventListener("message", manejarMensaje)

    // Escapar el codigo para inyectarlo de forma segura en el HTML del iframe
    const codigoEscapado = JSON.stringify(codigo)

    // HTML del sandbox: CSP bloquea red, intercepta console.*, ejecuta codigo, reporta resultado
    const htmlSandbox = `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval';"><script>
var ORIGEN = "${ORIGEN_SANDBOX}";
function enviar(msg) {
  try { parent.postMessage(Object.assign({}, msg, {__origen: ORIGEN}), "*"); } catch(e) {}
}
function serializar() {
  var args = Array.prototype.slice.call(arguments);
  return args.map(function(a) {
    if (a === null) return "null";
    if (a === undefined) return "undefined";
    if (typeof a === "object") {
      try { return JSON.stringify(a, null, 2); } catch(e) { return String(a); }
    }
    return String(a);
  }).join(" ");
}
console.log = function() { enviar({tipo:"consola",nivel:"log",texto:serializar.apply(null,arguments)}); };
console.error = function() { enviar({tipo:"consola",nivel:"error",texto:serializar.apply(null,arguments)}); };
console.warn = function() { enviar({tipo:"consola",nivel:"warn",texto:serializar.apply(null,arguments)}); };
console.info = function() { enviar({tipo:"consola",nivel:"log",texto:serializar.apply(null,arguments)}); };
try {
  var __resultado__ = eval(${codigoEscapado});
  setTimeout(function() {
    enviar({
      tipo:"resultado",
      valor: typeof __resultado__ === "object" && __resultado__ !== null
        ? JSON.stringify(__resultado__, null, 2)
        : String(__resultado__)
    });
  }, 0);
} catch(e) {
  enviar({tipo:"error",mensaje: e.name + ": " + e.message});
}
<\/script></head><body></body></html>`

    iframe.srcdoc = htmlSandbox
  })
}

// === Pyodide: Singleton lazy con cache persistente ===

/** Tipo minimo de la instancia Pyodide (evita dependencia de tipos completos) */
interface InstanciaPyodide {
  runPythonAsync: (codigo: string) => Promise<unknown>
  setStdout: (opciones: { batched: (texto: string) => void }) => void
  setStderr: (opciones: { batched: (texto: string) => void }) => void
  loadPackagesFromImports: (codigo: string) => Promise<void>
}

let instanciaPyodide: InstanciaPyodide | null = null
let promesaCargaPyodide: Promise<InstanciaPyodide> | null = null
let estadoPyodide: "inactivo" | "cargando" | "listo" | "error" = "inactivo"

/** Obtiene el estado actual de Pyodide */
export function obtenerEstadoPyodide(): "inactivo" | "cargando" | "listo" | "error" {
  return estadoPyodide
}

/** Carga Pyodide de forma lazy (solo al primer uso).
 *  Usa Cache API para persistir el WASM (~11MB) entre sesiones.
 *  Despues de la primera descarga, las siguientes cargas son instantaneas desde cache. */
async function cargarPyodide(): Promise<InstanciaPyodide> {
  if (instanciaPyodide) return instanciaPyodide
  if (promesaCargaPyodide) return promesaCargaPyodide

  estadoPyodide = "cargando"

  // Solicitar almacenamiento persistente la primera vez
  solicitarAlmacenamientoPersistente()

  promesaCargaPyodide = (async () => {
    try {
      // Cargar script de Pyodide via import dinamico del CDN
      const { loadPyodide } = await import(/* webpackIgnore: true */ `${PYODIDE_CDN}pyodide.mjs`)
      const pyodide = await loadPyodide({
        indexURL: PYODIDE_CDN,
        // Usar Cache API para persistir WASM y paquetes entre sesiones
        fetch: fetchConCache,
      }) as InstanciaPyodide

      // Deshabilitar input() y sys.stdin para evitar OSError: [Errno 29] I/O error.
      // Pyodide corre en WASM sin stdin interactivo; esto da un error claro en vez de críptico.
      await pyodide.runPythonAsync(`
import builtins, sys, io
sys.stdin = io.StringIO('')
def _no_input(prompt=''):
    raise EOFError('input() no disponible: el código se ejecuta en WebAssembly sin stdin interactivo.')
builtins.input = _no_input
`)

      instanciaPyodide = pyodide
      estadoPyodide = "listo"
      return pyodide
    } catch {
      estadoPyodide = "error"
      promesaCargaPyodide = null
      throw new Error("No se pudo cargar Pyodide. Verifica tu conexion a internet.")
    }
  })()

  return promesaCargaPyodide
}

/** Post-procesa salidas de Pyodide: convierte marcadores __IMG_BASE64__ en entradas tipo "imagen".
 *  Esto permite que matplotlib/savefig capture graficos como data URLs renderizables. */
function postProcesarImagenes(salidas: EntradaConsola[]): EntradaConsola[] {
  const salidasProcesadas: EntradaConsola[] = []
  for (const salida of salidas) {
    if (salida.tipo === "stdout" && salida.contenido.startsWith(MARCADOR_IMAGEN_BASE64)) {
      salidasProcesadas.push({
        tipo: "imagen",
        contenido: `data:image/png;base64,${salida.contenido.slice(MARCADOR_IMAGEN_BASE64.length)}`,
        marcaTiempo: salida.marcaTiempo,
      })
    } else {
      salidasProcesadas.push(salida)
    }
  }
  return salidasProcesadas
}

/** Ejecuta Python via Pyodide (WASM).
 *  Captura stdout/stderr via setStdout/setStderr.
 *  Soporta imports de paquetes incluidos en Pyodide (numpy, etc).
 *  Paquetes se cachean automaticamente via Cache API.
 *  Timeout via Promise.race. */
async function ejecutarPython(codigo: string): Promise<ResultadoEjecucion> {
  const salidas: EntradaConsola[] = []
  const inicio = performance.now()

  try {
    const pyodide = await cargarPyodide()

    // Redirigir stdout/stderr a nuestro capturador
    pyodide.setStdout({
      batched: (texto: string) => {
        salidas.push({
          tipo: "stdout",
          contenido: texto,
          marcaTiempo: performance.now() - inicio,
        })
      },
    })
    pyodide.setStderr({
      batched: (texto: string) => {
        salidas.push({
          tipo: "stderr",
          contenido: texto,
          marcaTiempo: performance.now() - inicio,
        })
      },
    })

    // Cargar paquetes que el codigo importa (numpy, pandas, etc.)
    // Pre-validar imports contra paquetes disponibles para dar errores claros
    const importsNoDisponibles = validarImportsPython(codigo)
    if (importsNoDisponibles.length > 0) {
      salidas.push({
        tipo: "error",
        contenido: `Paquete(s) no disponible(s) en Pyodide: ${importsNoDisponibles.join(", ")}. ` +
          `Solo se pueden usar paquetes incluidos en Pyodide 0.27.5 (numpy, scipy, pandas, sympy, sklearn, etc).`,
        marcaTiempo: performance.now() - inicio,
      })
      return { exito: false, salidas, duracionMs: performance.now() - inicio }
    }

    // Los paquetes descargados se cachean via fetchConCache automaticamente
    try {
      await pyodide.loadPackagesFromImports(codigo)
    } catch (errorPaquete) {
      const msgPaquete = errorPaquete instanceof Error ? errorPaquete.message : String(errorPaquete)
      salidas.push({
        tipo: "error",
        contenido: `Error cargando paquetes: ${msgPaquete}`,
        marcaTiempo: performance.now() - inicio,
      })
      return { exito: false, salidas, duracionMs: performance.now() - inicio }
    }

    // Ejecutar con timeout via Promise.race
    // Envolver codigo con preamble (matplotlib Agg) y epilogue (captura figuras como PNG base64)
    const codigoConMatplotlib = PREAMBLE_MATPLOTLIB + "\n" + codigo + "\n" + EPILOGUE_MATPLOTLIB
    const promesaEjecucion = pyodide.runPythonAsync(codigoConMatplotlib)
    const promesaTimeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("__timeout__")), TIMEOUT_EJECUCION_MS)
    })

    const resultado = await Promise.race([promesaEjecucion, promesaTimeout])

    // Si hay valor de retorno (ultima expresion), mostrarlo
    if (resultado !== undefined && resultado !== null) {
      salidas.push({
        tipo: "resultado",
        contenido: String(resultado),
        marcaTiempo: performance.now() - inicio,
      })
    }

    // Post-procesar salidas: convertir marcadores __IMG_BASE64__ en entradas tipo "imagen"
    const salidasProcesadas = postProcesarImagenes(salidas)

    return {
      exito: true,
      salidas: salidasProcesadas,
      duracionMs: performance.now() - inicio,
    }
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error)
    const esTimeout = mensaje === "__timeout__"

    salidas.push({
      tipo: "error",
      contenido: esTimeout
        ? `Ejecucion interrumpida: excedio el limite de ${TIMEOUT_EJECUCION_MS / 1000}s`
        : mensaje,
      marcaTiempo: performance.now() - inicio,
    })

    // Post-procesar incluso en error: el codigo pudo generar graficos antes de fallar
    const salidasProcesadas = postProcesarImagenes(salidas)

    return {
      exito: false,
      salidas: salidasProcesadas,
      duracionMs: performance.now() - inicio,
      interrumpido: esTimeout,
    }
  }
}

// === API publica ===

/** Ejecuta codigo en el lenguaje especificado.
 *  JavaScript/TypeScript: iframe sandboxed (sincrono, seguro, sin descargas)
 *  Python: Pyodide WASM (primer uso descarga ~11MB, despues cacheado via Cache API) */
export async function ejecutarCodigo(
  codigo: string,
  lenguaje: string
): Promise<ResultadoEjecucion> {
  const familia = normalizarLenguaje(lenguaje)
  if (familia === "python") return ejecutarPython(codigo)
  return ejecutarJavaScript(codigo)
}
