// Motor de ejecucion de codigo local en el navegador
// JavaScript/TypeScript: iframe sandboxed aislado (nuevo por cada ejecucion)
// Python: Web Worker dedicado con Pyodide WASM (aislado del hilo principal)

import type { ResultadoEjecucion, EntradaConsola } from "./tipos"

// === Constantes ===

/** Lenguajes que se pueden ejecutar en el navegador */
const LENGUAJES_EJECUTABLES: Set<string> = new Set([
  "javascript", "js", "typescript", "ts", "jsx", "tsx", "python", "py",
])

/** Tiempo maximo de ejecucion antes de interrumpir (ms) */
const TIMEOUT_EJECUCION_MS = 30_000

/** Paquetes disponibles en Pyodide 0.27.5 (top-level import names).
 *  Se usa para pre-validar imports en la UI (boton Ejecutar) y dar errores claros. */
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

/** Identificador de origen para filtrar postMessages del sandbox JS */
const ORIGEN_SANDBOX = "__ejecutor_penguin__"

/** Marcador especial para imagenes base64 capturadas por matplotlib.
 *  Se usa como prefijo en stdout para identificar y convertir a entradas tipo "imagen". */
const MARCADOR_IMAGEN_BASE64 = "__IMG_BASE64__:"

// === Utilidades publicas ===

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

// === Python: Web Worker dedicado con Pyodide ===

/** Estado del Worker de Pyodide en el hilo principal */
let workerPyodide: Worker | null = null
let promesaWorkerListo: Promise<Worker> | null = null
let estadoPyodide: "inactivo" | "cargando" | "listo" | "error" = "inactivo"

/** Mutex: cola de promesas para serializar ejecuciones de Python.
 *  Pyodide (runPythonAsync) NO es reentrante: si dos ejecuciones corren simultaneamente,
 *  los callbacks de stdout/stderr se sobreescriben y los globals se corrompen.
 *  La cola garantiza que solo una ejecucion este activa a la vez (FIFO). */
let colaEjecucion: Promise<void> = Promise.resolve()

/** Flag para consultar si hay una ejecucion de Python en curso */
let ejecucionEnCurso = false

/** Obtiene el estado actual de Pyodide */
export function obtenerEstadoPyodide(): "inactivo" | "cargando" | "listo" | "error" {
  return estadoPyodide
}

/** Indica si hay una ejecucion de Python activa (util para guards en la UI) */
export function estaEjecutandoCodigo(): boolean {
  return ejecucionEnCurso
}

/** Solicita almacenamiento persistente para que el navegador no evicte el cache de Pyodide */
function solicitarAlmacenamientoPersistente() {
  try {
    if (navigator.storage?.persist) {
      navigator.storage.persist().catch(() => { /* ignorar */ })
    }
  } catch {
    // Ignorar si no esta disponible
  }
}

/** Inicia la carga de Pyodide en segundo plano (para ejecutar cuando la app arranca).
 *  Mejora radicalmente el tiempo de la primera ejecucion de Python. */
export function precargarPyodide() {
  if (estadoPyodide === "inactivo") {
    obtenerWorker().catch(e => console.warn("Fallo precarga de Pyodide:", e))
  }
}

/** Obtiene o crea el Worker de Pyodide.
 *  La primera vez crea el Worker y espera a que Pyodide este listo.
 *  Las siguientes llamadas retornan el Worker existente inmediatamente. */
function obtenerWorker(): Promise<Worker> {
  if (workerPyodide && estadoPyodide === "listo") return Promise.resolve(workerPyodide)
  if (promesaWorkerListo) return promesaWorkerListo

  estadoPyodide = "cargando"
  solicitarAlmacenamientoPersistente()

  promesaWorkerListo = new Promise<Worker>((resolve, reject) => {
    const worker = new Worker(
      new URL("./worker-pyodide.ts", import.meta.url),
      { type: "module" }
    )

    function manejarEstado(e: MessageEvent) {
      const datos = e.data
      if (datos.tipo === "estado") {
        if (datos.estado === "listo") {
          workerPyodide = worker
          estadoPyodide = "listo"
          worker.removeEventListener("message", manejarEstado)
          resolve(worker)
        } else if (datos.estado === "error") {
          estadoPyodide = "error"
          promesaWorkerListo = null
          worker.removeEventListener("message", manejarEstado)
          reject(new Error("No se pudo cargar Pyodide. Verifica tu conexion a internet."))
        }
        // "cargando" es informativo, no necesitamos hacer nada
      }
    }

    worker.addEventListener("message", manejarEstado)

    // Si el Worker no puede cargar en absoluto (error de red, syntax error, etc.)
    worker.onerror = () => {
      estadoPyodide = "error"
      promesaWorkerListo = null
      reject(new Error("No se pudo iniciar el Worker de Python."))
    }
  })

  return promesaWorkerListo
}

/** Post-procesa salidas del Worker: convierte marcadores __IMG_BASE64__ en entradas tipo "imagen".
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

/** Ejecuta Python en un Web Worker dedicado con Pyodide.
 *  El Worker tiene su propio event loop — loops infinitos (while True) no congelan la UI.
 *  Timeout real: si el Worker no responde en 30s, se termina con worker.terminate()
 *  y se recrea en la siguiente ejecucion.
 *  Mutex via cola de promesas: solo una ejecucion activa a la vez (FIFO).
 *  @param alIniciarEjecucion - callback invocado cuando Pyodide esta listo y la ejecucion comienza
 *    (permite a la UI transicionar de "cargando" a "ejecutando") */
async function ejecutarPython(codigo: string, alIniciarEjecucion?: () => void): Promise<ResultadoEjecucion> {
  const salidas: EntradaConsola[] = []
  const inicio = performance.now()

  // Mutex: registrar mi turno y esperar al anterior
  let liberar: () => void
  const miTurno = new Promise<void>(r => { liberar = r })
  const turnoAnterior = colaEjecucion
  colaEjecucion = miTurno
  await turnoAnterior

  ejecucionEnCurso = true

  try {
    // Pre-validar imports en el hilo principal (error rapido sin crear Worker)
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

    const worker = await obtenerWorker()
    const idEjecucion = `exec-${Date.now()}-${Math.random().toString(36).slice(2)}`

    // Pyodide esta listo: notificar a la UI para transicionar de "cargando" a "ejecutando"
    alIniciarEjecucion?.()

    return await new Promise<ResultadoEjecucion>((resolve) => {
      let resuelto = false

      // Timeout REAL: el hilo principal no esta bloqueado por WASM,
      // asi que setTimeout funciona correctamente y puede terminar el Worker.
      const temporizador = setTimeout(() => {
        if (resuelto) return
        resuelto = true
        worker.removeEventListener("message", manejarMensaje)

        // Terminar Worker que no responde (loop infinito, etc.)
        worker.terminate()
        workerPyodide = null
        promesaWorkerListo = null
        estadoPyodide = "inactivo"

        salidas.push({
          tipo: "error",
          contenido: `Ejecucion interrumpida: excedio el limite de ${TIMEOUT_EJECUCION_MS / 1000}s`,
          marcaTiempo: performance.now() - inicio,
        })
        resolve({
          exito: false,
          salidas: postProcesarImagenes(salidas),
          duracionMs: performance.now() - inicio,
          interrumpido: true,
        })
      }, TIMEOUT_EJECUCION_MS)

      function manejarMensaje(e: MessageEvent) {
        const datos = e.data
        // Filtrar mensajes de otras ejecuciones (no deberia pasar con el mutex, pero por seguridad)
        if (datos.id !== idEjecucion) return

        if (datos.tipo === "stdout") {
          salidas.push({
            tipo: "stdout",
            contenido: datos.texto,
            marcaTiempo: performance.now() - inicio,
          })
        } else if (datos.tipo === "stderr") {
          salidas.push({
            tipo: "stderr",
            contenido: datos.texto,
            marcaTiempo: performance.now() - inicio,
          })
        } else if (datos.tipo === "resultado") {
          if (resuelto) return
          resuelto = true
          clearTimeout(temporizador)
          worker.removeEventListener("message", manejarMensaje)

          // Si hubo error interno del Worker
          if (datos.error) {
            salidas.push({
              tipo: "error",
              contenido: datos.error,
              marcaTiempo: performance.now() - inicio,
            })
          }

          resolve({
            exito: datos.exito ?? false,
            salidas: postProcesarImagenes(salidas),
            duracionMs: performance.now() - inicio,
          })
        }
      }

      worker.addEventListener("message", manejarMensaje)
      worker.postMessage({ tipo: "ejecutar", id: idEjecucion, codigo })
    })
  } catch (error) {
    // Error al obtener el Worker (carga fallida, etc.)
    const mensaje = error instanceof Error ? error.message : String(error)
    salidas.push({
      tipo: "error",
      contenido: mensaje,
      marcaTiempo: performance.now() - inicio,
    })
    return {
      exito: false,
      salidas: postProcesarImagenes(salidas),
      duracionMs: performance.now() - inicio,
    }
  } finally {
    ejecucionEnCurso = false
    liberar!() // Siempre liberar mutex, incluso en error/timeout
  }
}

// === API publica ===

/** Ejecuta codigo en el lenguaje especificado.
 *  JavaScript/TypeScript: iframe sandboxed (sincrono, seguro, sin descargas)
 *  Python: Web Worker con Pyodide WASM (primer uso descarga ~11MB, despues cacheado via Cache API)
 *  @param alIniciarEjecucion - callback invocado cuando el runtime esta listo y la ejecucion comienza
 *    (para Python: se invoca despues de cargar Pyodide; para JS: inmediatamente) */
export async function ejecutarCodigo(
  codigo: string,
  lenguaje: string,
  alIniciarEjecucion?: () => void
): Promise<ResultadoEjecucion> {
  const familia = normalizarLenguaje(lenguaje)
  if (familia === "python") return ejecutarPython(codigo, alIniciarEjecucion)
  alIniciarEjecucion?.()
  return ejecutarJavaScript(codigo)
}
