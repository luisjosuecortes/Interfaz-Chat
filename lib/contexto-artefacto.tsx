"use client"

import { createContext, useContext, useState, useCallback, useRef, useMemo, type ReactNode } from "react"
import type { Artefacto, ResultadoEjecucion, EstadoEjecucion } from "./tipos"
import { ejecutarCodigo, esLenguajeEjecutable, obtenerEstadoPyodide, detenerEjecucionActiva } from "./ejecutor-codigo"

// Valor que expone el contexto de artefactos a toda la aplicación
interface ValorContextoArtefacto {
  /** Indica si el proveedor está montado (evita renderizar tarjetas fuera del contexto) */
  estaDisponible: boolean
  /** Artefacto actualmente visible en el panel lateral (null = panel cerrado) */
  artefactoActivo: Artefacto | null
  /** Indica si el contenido fue editado por el usuario (evita que el sync de streaming lo revierta) */
  editadoPorUsuario: boolean
  /** Abre el panel lateral con el artefacto dado */
  abrirArtefacto: (artefacto: Artefacto) => void
  /** Cierra el panel lateral */
  cerrarArtefacto: () => void
  /** Actualiza el contenido del artefacto activo (para sync en tiempo real durante streaming) */
  actualizarContenidoArtefacto: (nuevoContenido: string, totalLineas: number, estaCerrado?: boolean) => void
  /** Guarda ediciones del usuario y marca el artefacto como editado */
  guardarEdicionUsuario: (nuevoContenido: string, totalLineas: number) => void
  /** Estado de ejecucion del artefacto activo */
  estadoEjecucion: EstadoEjecucion
  /** Resultado de la ultima ejecucion del artefacto activo */
  resultadoEjecucion: ResultadoEjecucion | null
  /** Ejecuta el codigo del artefacto activo */
  ejecutarArtefacto: () => Promise<void>
  /** Abre el artefacto en el panel y ejecuta su codigo en una operacion atomica.
   *  Evita el bug de reset de estado que ocurre al llamar abrirArtefacto + ejecutarArtefacto por separado.
   *  Retorna el resultado de la ejecucion (o null si falla). */
  abrirYEjecutarArtefacto: (artefacto: Artefacto) => Promise<ResultadoEjecucion | null>
  /** Detiene la ejecucion de codigo en curso (SIGINT graceful o hard terminate) */
  detenerEjecucion: () => void
}

const ContextoArtefacto = createContext<ValorContextoArtefacto>({
  estaDisponible: false,
  artefactoActivo: null,
  editadoPorUsuario: false,
  abrirArtefacto: () => { },
  cerrarArtefacto: () => { },
  actualizarContenidoArtefacto: () => { },
  guardarEdicionUsuario: () => { },
  estadoEjecucion: "inactivo",
  resultadoEjecucion: null,
  ejecutarArtefacto: async () => { },
  abrirYEjecutarArtefacto: async () => null,
  detenerEjecucion: () => { },
})

/**
 * Proveedor del sistema de artefactos.
 * Envuelve la app para permitir que BloqueCodigoConResaltado abra el panel lateral
 * y que ContenedorChat/PanelArtefacto reaccionen al artefacto activo.
 * Tambien gestiona el estado de ejecucion de codigo del artefacto activo.
 */
export function ProveedorArtefacto({ children }: { children: ReactNode }) {
  const [artefactoActivo, establecerArtefactoActivo] = useState<Artefacto | null>(null)
  const [editadoPorUsuario, establecerEditadoPorUsuario] = useState(false)
  const [estadoEjecucion, establecerEstadoEjecucion] = useState<EstadoEjecucion>("inactivo")
  const [resultadoEjecucion, establecerResultadoEjecucion] = useState<ResultadoEjecucion | null>(null)

  // Ref para proteger la ejecucion externa (tool call del modelo) de interferencia.
  // Cuando es true, abrirArtefacto se convierte en no-op para evitar que el auto-open
  // de bloque-codigo.tsx resetee el estado de ejecucion en curso.
  const refEjecucionExterna = useRef(false)

  const abrirArtefacto = useCallback((artefacto: Artefacto) => {
    // No interrumpir ejecucion externa (tool call del modelo en curso)
    if (refEjecucionExterna.current) return
    // Solo actualizar si es un artefacto diferente (evita re-renders durante streaming
    // donde el mismo artefacto se abre repetidamente con contenido actualizado)
    establecerArtefactoActivo(prev => {
      if (prev?.id === artefacto.id) return prev
      return artefacto
    })
    establecerEditadoPorUsuario(false)
    // Restaurar resultado previo si el artefacto ya fue ejecutado (ej: TarjetaEjecucion)
    if (artefacto.resultadoPrevio) {
      establecerResultadoEjecucion(artefacto.resultadoPrevio)
      establecerEstadoEjecucion(artefacto.resultadoPrevio.exito ? "completado" : "error")
    } else {
      establecerEstadoEjecucion("inactivo")
      establecerResultadoEjecucion(null)
    }
  }, [])

  const cerrarArtefacto = useCallback(() => {
    establecerArtefactoActivo(null)
    establecerEditadoPorUsuario(false)
    establecerEstadoEjecucion("inactivo")
    establecerResultadoEjecucion(null)
  }, [])

  /** Actualiza contenido del artefacto activo sin reemplazar el objeto completo.
   *  Usa setState funcional para evitar re-renders si el contenido no cambió.
   *  NO marca como editado — es para sync de streaming. */
  const actualizarContenidoArtefacto = useCallback((nuevoContenido: string, totalLineas: number, estaCerrado?: boolean) => {
    establecerArtefactoActivo(prev => {
      // Si el contenido y el estado de cierre son iguales, no redibujar
      if (!prev || (prev.contenido === nuevoContenido && prev.estaCerrado === estaCerrado)) return prev
      return { ...prev, contenido: nuevoContenido, totalLineas, estaCerrado }
    })
  }, [])

  /** Guarda ediciones del usuario y marca como editado para que el sync
   *  de BloqueCodigoConResaltado no revierta los cambios. */
  const guardarEdicionUsuario = useCallback((nuevoContenido: string, totalLineas: number) => {
    establecerArtefactoActivo(prev => {
      if (!prev || prev.contenido === nuevoContenido) return prev
      return { ...prev, contenido: nuevoContenido, totalLineas }
    })
    establecerEditadoPorUsuario(true)
  }, [])

  /** Ejecuta el codigo del artefacto activo usando el motor de ejecucion local.
   *  Lee el contenido y lenguaje actuales del artefacto (incluyendo ediciones del usuario). */
  const ejecutarArtefacto = useCallback(async () => {
    // Leer el artefacto actual del estado al momento de la ejecucion
    const artefacto = artefactoActivo
    if (!artefacto || !artefacto.lenguaje || !esLenguajeEjecutable(artefacto.lenguaje)) return
    if (estadoEjecucion === "ejecutando" || estadoEjecucion === "cargando") return

    // Determinar estado inicial segun lenguaje
    const esPython = artefacto.lenguaje === "python" || artefacto.lenguaje === "py"
    const estadoPyodideActual = esPython ? obtenerEstadoPyodide() : "listo"
    establecerEstadoEjecucion(estadoPyodideActual !== "listo" && esPython ? "cargando" : "ejecutando")
    establecerResultadoEjecucion(null)

    try {
      const resultado = await ejecutarCodigo(artefacto.contenido, artefacto.lenguaje, () => {
        // Pyodide cargado: transicionar UI de "Cargando Python..." a "Ejecutando..."
        establecerEstadoEjecucion("ejecutando")
      })
      establecerResultadoEjecucion(resultado)
      establecerEstadoEjecucion(resultado.exito ? "completado" : "error")
    } catch {
      establecerEstadoEjecucion("error")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artefactoActivo?.contenido, artefactoActivo?.lenguaje, estadoEjecucion])

  /** Abre el artefacto en el panel y ejecuta su codigo en una operacion atomica.
   *  Usa refEjecucionExterna para evitar que el auto-open de bloque-codigo.tsx
   *  resetee el estado de ejecucion mientras el tool call esta en curso.
   *  Retorna el resultado de la ejecucion (o null si falla). */
  const abrirYEjecutarArtefacto = useCallback(async (artefacto: Artefacto): Promise<ResultadoEjecucion | null> => {
    if (!artefacto.lenguaje || !esLenguajeEjecutable(artefacto.lenguaje)) return null

    refEjecucionExterna.current = true

    // Abrir artefacto sin resetear ejecucion (refEjecucionExterna protege)
    establecerArtefactoActivo(artefacto)
    establecerEditadoPorUsuario(false)

    // Iniciar ejecucion
    const esPython = artefacto.lenguaje === "python" || artefacto.lenguaje === "py"
    const estadoInicial = esPython && obtenerEstadoPyodide() !== "listo" ? "cargando" : "ejecutando"
    establecerEstadoEjecucion(estadoInicial)
    establecerResultadoEjecucion(null)

    try {
      const resultado = await ejecutarCodigo(artefacto.contenido, artefacto.lenguaje, () => {
        // Pyodide cargado: transicionar UI de "Cargando Python..." a "Ejecutando..."
        establecerEstadoEjecucion("ejecutando")
      })
      establecerResultadoEjecucion(resultado)
      establecerEstadoEjecucion(resultado.exito ? "completado" : "error")
      return resultado
    } catch {
      establecerEstadoEjecucion("error")
      return null
    } finally {
      refEjecucionExterna.current = false
    }
  }, [])

  /** Detiene la ejecucion de codigo en curso.
   *  Delega a detenerEjecucionActiva del motor de ejecucion (SIGINT graceful → hard terminate). */
  const detenerEjecucion = useCallback(() => {
    detenerEjecucionActiva()
  }, [])

  const valorContexto = useMemo(() => ({
    estaDisponible: true,
    artefactoActivo,
    editadoPorUsuario,
    abrirArtefacto,
    cerrarArtefacto,
    actualizarContenidoArtefacto,
    guardarEdicionUsuario,
    estadoEjecucion,
    resultadoEjecucion,
    ejecutarArtefacto,
    abrirYEjecutarArtefacto,
    detenerEjecucion,
  }), [artefactoActivo, editadoPorUsuario, estadoEjecucion, resultadoEjecucion,
    abrirArtefacto, cerrarArtefacto, actualizarContenidoArtefacto,
    guardarEdicionUsuario, ejecutarArtefacto, abrirYEjecutarArtefacto, detenerEjecucion])

  return (
    <ContextoArtefacto.Provider value={valorContexto}>
      {children}
    </ContextoArtefacto.Provider>
  )
}

/** Hook para acceder al contexto de artefactos */
export function useArtefacto() {
  return useContext(ContextoArtefacto)
}
