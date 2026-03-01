"use client"

import { createContext, useContext, useMemo, ReactNode } from "react"

// Contexto muy ligero que provee estado a nivel de mensaje (burbuja) individual.
// Esto permite que componentes profundamente anidados (como bloques de codigo markdown)
// sepan si el mensaje al que pertenecen se esta generando en este preciso momento (streaming)
// SIN causar re-renders costosos globales ni romper la memoizacion de ReactMarkdown.

interface ValorContextoMensaje {
    /** 
     * Verdadero unicamente durante el streaming en vivo de este mensaje en particular.
     * Falso en cuanto el modelo deja de generar tokens.
     */
    estaGenerandose: boolean
}

const ContextoMensaje = createContext<ValorContextoMensaje>({
    estaGenerandose: false,
})

interface PropiedadesProveedorMensaje {
    children: ReactNode
    estaGenerandose: boolean
}

export function ProveedorMensaje({ children, estaGenerandose }: PropiedadesProveedorMensaje) {
    const valor = useMemo(() => ({ estaGenerandose }), [estaGenerandose])
    return (
        <ContextoMensaje.Provider value={valor}>
            {children}
        </ContextoMensaje.Provider>
    )
}

export function useMensaje() {
    return useContext(ContextoMensaje)
}
