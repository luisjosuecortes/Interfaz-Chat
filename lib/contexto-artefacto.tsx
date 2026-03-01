"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import type { Artefacto } from "./tipos"

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
  actualizarContenidoArtefacto: (nuevoContenido: string, totalLineas: number) => void
  /** Guarda ediciones del usuario y marca el artefacto como editado */
  guardarEdicionUsuario: (nuevoContenido: string, totalLineas: number) => void
}

const ContextoArtefacto = createContext<ValorContextoArtefacto>({
  estaDisponible: false,
  artefactoActivo: null,
  editadoPorUsuario: false,
  abrirArtefacto: () => { },
  cerrarArtefacto: () => { },
  actualizarContenidoArtefacto: () => { },
  guardarEdicionUsuario: () => { },
})

/**
 * Proveedor del sistema de artefactos.
 * Envuelve la app para permitir que BloqueCodigoConResaltado abra el panel lateral
 * y que ContenedorChat/PanelArtefacto reaccionen al artefacto activo.
 */
export function ProveedorArtefacto({ children }: { children: ReactNode }) {
  const [artefactoActivo, establecerArtefactoActivo] = useState<Artefacto | null>(null)
  const [editadoPorUsuario, establecerEditadoPorUsuario] = useState(false)

  const abrirArtefacto = useCallback((artefacto: Artefacto) => {
    establecerArtefactoActivo(artefacto)
    establecerEditadoPorUsuario(false)
  }, [])

  const cerrarArtefacto = useCallback(() => {
    establecerArtefactoActivo(null)
    establecerEditadoPorUsuario(false)
  }, [])

  /** Actualiza contenido del artefacto activo sin reemplazar el objeto completo.
   *  Usa setState funcional para evitar re-renders si el contenido no cambió.
   *  NO marca como editado — es para sync de streaming. */
  const actualizarContenidoArtefacto = useCallback((nuevoContenido: string, totalLineas: number) => {
    establecerArtefactoActivo(prev => {
      if (!prev || prev.contenido === nuevoContenido) return prev
      return { ...prev, contenido: nuevoContenido, totalLineas }
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

  return (
    <ContextoArtefacto.Provider
      value={{ estaDisponible: true, artefactoActivo, editadoPorUsuario, abrirArtefacto, cerrarArtefacto, actualizarContenidoArtefacto, guardarEdicionUsuario }}
    >
      {children}
    </ContextoArtefacto.Provider>
  )
}

/** Hook para acceder al contexto de artefactos */
export function useArtefacto() {
  return useContext(ContextoArtefacto)
}
