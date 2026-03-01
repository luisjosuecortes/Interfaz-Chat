"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"
import type { Artefacto } from "./tipos"

// Valor que expone el contexto de artefactos a toda la aplicación
interface ValorContextoArtefacto {
  /** Indica si el proveedor está montado (evita renderizar tarjetas fuera del contexto) */
  estaDisponible: boolean
  /** Artefacto actualmente visible en el panel lateral (null = panel cerrado) */
  artefactoActivo: Artefacto | null
  /** Abre el panel lateral con el artefacto dado */
  abrirArtefacto: (artefacto: Artefacto) => void
  /** Cierra el panel lateral */
  cerrarArtefacto: () => void
  /** Actualiza el contenido del artefacto activo (para sync en tiempo real durante streaming) */
  actualizarContenidoArtefacto: (nuevoContenido: string, totalLineas: number) => void
}

const ContextoArtefacto = createContext<ValorContextoArtefacto>({
  estaDisponible: false,
  artefactoActivo: null,
  abrirArtefacto: () => {},
  cerrarArtefacto: () => {},
  actualizarContenidoArtefacto: () => {},
})

/**
 * Proveedor del sistema de artefactos.
 * Envuelve la app para permitir que BloqueCodigoConResaltado abra el panel lateral
 * y que ContenedorChat/PanelArtefacto reaccionen al artefacto activo.
 */
export function ProveedorArtefacto({ children }: { children: ReactNode }) {
  const [artefactoActivo, establecerArtefactoActivo] = useState<Artefacto | null>(null)

  const abrirArtefacto = useCallback((artefacto: Artefacto) => {
    establecerArtefactoActivo(artefacto)
  }, [])

  const cerrarArtefacto = useCallback(() => {
    establecerArtefactoActivo(null)
  }, [])

  /** Actualiza contenido del artefacto activo sin reemplazar el objeto completo.
   *  Usa setState funcional para evitar re-renders si el contenido no cambió. */
  const actualizarContenidoArtefacto = useCallback((nuevoContenido: string, totalLineas: number) => {
    establecerArtefactoActivo(prev => {
      if (!prev || prev.contenido === nuevoContenido) return prev
      return { ...prev, contenido: nuevoContenido, totalLineas }
    })
  }, [])

  return (
    <ContextoArtefacto.Provider
      value={{ estaDisponible: true, artefactoActivo, abrirArtefacto, cerrarArtefacto, actualizarContenidoArtefacto }}
    >
      {children}
    </ContextoArtefacto.Provider>
  )
}

/** Hook para acceder al contexto de artefactos */
export function useArtefacto() {
  return useContext(ContextoArtefacto)
}
