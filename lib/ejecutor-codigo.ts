// Motor de ejecucion de codigo local en el navegador
// JavaScript/TypeScript: iframe sandboxed aislado (nuevo por cada ejecucion)
// Python: Web Worker dedicado con Pyodide WASM (aislado del hilo principal)

import type { ResultadoEjecucion, EntradaConsola } from "./tipos"
import { MARCADOR_IMAGEN_BASE64, validarImportsPython } from "./constantes-python"

// Re-exportar para consumidores existentes (panel-artefacto.tsx, etc.)
export { validarImportsPython } from "./constantes-python"

// === Constantes ===

/** Lenguajes que se pueden ejecutar en el navegador */
const LENGUAJES_EJECUTABLES: Set<string> = new Set([
  "javascript", "js", "typescript", "ts", "jsx", "tsx", "python", "py",
])

/** Tiempo maximo de ejecucion antes de interrumpir (ms) */
const TIMEOUT_EJECUCION_MS = 30_000

/** Tiempo antes del hard timeout para intentar SIGINT graceful (ms) */
const MARGEN_SIGINT_MS = 5_000

/** Identificador de origen para filtrar postMessages del sandbox JS */
const ORIGEN_SANDBOX = "__ejecutor_penguin__"

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

/** SharedArrayBuffer para interrupcion graceful de Pyodide (SIGINT → KeyboardInterrupt).
 *  Solo disponible cuando crossOriginIsolated = true (requiere headers COOP/COEP).
 *  Se crea una vez y se envia al Worker al conectar. Es un Int32Array(SharedArrayBuffer(4)):
 *  escribir 2 en index 0 dispara KeyboardInterrupt en el siguiente bytecode boundary. */
let bufferInterrupcion: Int32Array | null = null

/** Funcion de cancelacion de la ejecucion activa (closure sobre el estado de la Promise).
 *  Se establece al iniciar cada ejecucion y se limpia al finalizar.
 *  Permite cancelar desde fuera (boton Detener, abort del streaming). */
let cancelarEjecucionActual: (() => void) | null = null

/** Indica si SharedArrayBuffer esta disponible (crossOriginIsolated) */
export function tieneInterrupcionGraceful(): boolean {
  return bufferInterrupcion !== null
}

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

/** Detiene la ejecucion de Python activa.
 *  Si SharedArrayBuffer esta disponible, envia SIGINT (graceful: preserva Worker + estado).
 *  Si no, termina el Worker inmediatamente (hard: pierde estado de Pyodide).
 *  Invocado por el boton "Detener" del panel y por el abort del streaming. */
export function detenerEjecucionActiva(): void {
  if (!ejecucionEnCurso || !cancelarEjecucionActual) return
  cancelarEjecucionActual()
  cancelarEjecucionActual = null
}

/** Inicializa el SharedArrayBuffer para interrupcion graceful.
 *  Se llama una vez en el modulo. Requiere crossOriginIsolated (headers COOP/COEP). */
function inicializarBufferInterrupcion() {
  if (typeof globalThis.crossOriginIsolated !== "undefined" && globalThis.crossOriginIsolated) {
    try {
      bufferInterrupcion = new Int32Array(new SharedArrayBuffer(4))
    } catch {
      // SharedArrayBuffer no disponible (navegador antiguo, headers incorrectos)
    }
  }
}

// Inicializar buffer al cargar el modulo
inicializarBufferInterrupcion()

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
          // Enviar buffer de interrupcion si esta disponible (SharedArrayBuffer)
          if (bufferInterrupcion) {
            worker.postMessage({ tipo: "configurar_interrupcion", buffer: bufferInterrupcion })
          }
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
 *  Interrupcion 2-tier: SIGINT graceful 5s antes del hard timeout (preserva Worker si funciona).
 *  Hard timeout: si el Worker no responde en 30s, se termina con worker.terminate().
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

    // Limpiar buffer de interrupcion antes de ejecutar (evita señal stale de ejecucion anterior)
    if (bufferInterrupcion) {
      Atomics.store(bufferInterrupcion, 0, 0)
    }

    // Pyodide esta listo: notificar a la UI para transicionar de "cargando" a "ejecutando"
    alIniciarEjecucion?.()

    return await new Promise<ResultadoEjecucion>((resolve) => {
      let resuelto = false

      /** Funcion auxiliar que resuelve la Promise y limpia todos los timers/listeners */
      function resolverConLimpieza(resultado: ResultadoEjecucion) {
        if (resuelto) return
        resuelto = true
        clearTimeout(temporizadorHard)
        if (temporizadorSigint) clearTimeout(temporizadorSigint)
        cancelarEjecucionActual = null
        worker.removeEventListener("message", manejarMensaje)
        resolve(resultado)
      }

      // Tier 1 (graceful): 5s antes del hard timeout, enviar SIGINT via SharedArrayBuffer.
      // Pyodide verifica el buffer en cada bytecode boundary de Python (~cada 100 instrucciones).
      // Si funciona, Python lanza KeyboardInterrupt → Worker envia resultado → Promise resuelve.
      // Si no funciona (tight C extension loop), el hard timeout los mata igualmente.
      const temporizadorSigint = bufferInterrupcion
        ? setTimeout(() => {
          if (!resuelto && bufferInterrupcion) {
            Atomics.store(bufferInterrupcion, 0, 2) // 2 = SIGINT
          }
        }, TIMEOUT_EJECUCION_MS - MARGEN_SIGINT_MS)
        : null

      // Tier 2 (hard): terminar Worker si no respondio al SIGINT (o si no hay SharedArrayBuffer)
      const temporizadorHard = setTimeout(() => {
        // Terminar Worker que no responde (loop infinito en C extension, etc.)
        worker.terminate()
        workerPyodide = null
        promesaWorkerListo = null
        estadoPyodide = "inactivo"

        salidas.push({
          tipo: "error",
          contenido: `Ejecucion interrumpida: excedio el limite de ${TIMEOUT_EJECUCION_MS / 1000}s`,
          marcaTiempo: performance.now() - inicio,
        })
        resolverConLimpieza({
          exito: false,
          salidas: postProcesarImagenes(salidas),
          duracionMs: performance.now() - inicio,
          interrumpido: true,
        })
      }, TIMEOUT_EJECUCION_MS)

      // Cancelacion externa (boton Detener del usuario, abort del streaming).
      // Intenta SIGINT primero; si no hay SharedArrayBuffer, hard terminate.
      cancelarEjecucionActual = () => {
        if (resuelto) return
        if (bufferInterrupcion) {
          // Graceful: enviar SIGINT. El Worker respondera con KeyboardInterrupt.
          // Si no responde en 3s, hard terminate como fallback.
          Atomics.store(bufferInterrupcion, 0, 2)
          setTimeout(() => {
            if (!resuelto) {
              worker.terminate()
              workerPyodide = null
              promesaWorkerListo = null
              estadoPyodide = "inactivo"
              salidas.push({
                tipo: "error",
                contenido: "Ejecucion interrumpida por el usuario",
                marcaTiempo: performance.now() - inicio,
              })
              resolverConLimpieza({
                exito: false,
                salidas: postProcesarImagenes(salidas),
                duracionMs: performance.now() - inicio,
                interrumpido: true,
              })
            }
          }, 3000)
        } else {
          // Sin SharedArrayBuffer: hard terminate inmediato
          worker.terminate()
          workerPyodide = null
          promesaWorkerListo = null
          estadoPyodide = "inactivo"
          salidas.push({
            tipo: "error",
            contenido: "Ejecucion interrumpida por el usuario",
            marcaTiempo: performance.now() - inicio,
          })
          resolverConLimpieza({
            exito: false,
            salidas: postProcesarImagenes(salidas),
            duracionMs: performance.now() - inicio,
            interrumpido: true,
          })
        }
      }

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
          // Si hubo error interno del Worker
          if (datos.error) {
            salidas.push({
              tipo: "error",
              contenido: datos.error,
              marcaTiempo: performance.now() - inicio,
            })
          }

          resolverConLimpieza({
            exito: datos.exito ?? false,
            salidas: postProcesarImagenes(salidas),
            duracionMs: performance.now() - inicio,
            interrumpido: datos.interrumpido ?? false,
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
    cancelarEjecucionActual = null
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
