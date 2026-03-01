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
    /**
     * El texto completo y crudo del mensaje.
     * Utilizado para inspeccionar el estado de los bloques de codigo durante el streaming.
     */
    contenidoMensaje: string
}

const ContextoMensaje = createContext<ValorContextoMensaje>({
    estaGenerandose: false,
    contenidoMensaje: "",
})

interface PropiedadesProveedorMensaje {
    children: ReactNode
    estaGenerandose: boolean
    contenidoMensaje: string
}

export function ProveedorMensaje({ children, estaGenerandose, contenidoMensaje }: PropiedadesProveedorMensaje) {
    const valor = useMemo(() => ({ estaGenerandose, contenidoMensaje }), [estaGenerandose, contenidoMensaje])
    return (
        <ContextoMensaje.Provider value={valor}>
            {children}
        </ContextoMensaje.Provider>
    )
}

export function useMensaje() {
    return useContext(ContextoMensaje)
}
