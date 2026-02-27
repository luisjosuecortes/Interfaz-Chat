"use client"

import { useState, useCallback, useRef, useEffect } from "react"

/** Hook para copiar texto al portapapeles con retroalimentacion visual */
export function useCopiarAlPortapapeles(duracionMs = 2000) {
  const [haCopiado, establecerHaCopiado] = useState(false)

  const copiar = useCallback(async (texto: string) => {
    await navigator.clipboard.writeText(texto)
    establecerHaCopiado(true)
    setTimeout(() => establecerHaCopiado(false), duracionMs)
  }, [duracionMs])

  return { haCopiado, copiar }
}

/** Pixeles desde el fondo para considerar el scroll "en fondo" */
const UMBRAL_FONDO_PX = 100

/**
 * Hook para auto-scroll inteligente en contenedores de chat con streaming.
 *
 * Patron basado en Vercel AI Chatbot:
 * - MutationObserver detecta texto nuevo en streaming (characterData) y mensajes nuevos (childList)
 * - ResizeObserver detecta cambios de altura (tablas, imagenes cargando, markdown)
 * - "instant" durante auto-scroll de contenido para evitar jitter de animaciones simultaneas
 * - "smooth" reservado solo para la accion explicita del usuario (boton ir al fondo)
 * - Double ref pattern: ref sincronizado con estado para evitar closures viejos en observers
 * - estaUsuarioScrolleandoRef: previene auto-scroll cuando el usuario esta scrolleando activamente
 */
export function useScrollAlFondo() {
  const contenedorRef = useRef<HTMLDivElement>(null)
  const [estaEnFondo, setEstaEnFondo] = useState(true)
  const estaEnFondoRef = useRef(true)
  const estaUsuarioScrolleandoRef = useRef(false)
  const rafId = useRef<number | null>(null)

  // Sincronizar ref con estado para evitar closures viejos en los observers
  useEffect(() => {
    estaEnFondoRef.current = estaEnFondo
  }, [estaEnFondo])

  const verificarSiEstaEnFondo = useCallback(() => {
    if (!contenedorRef.current) return true
    const { scrollTop, scrollHeight, clientHeight } = contenedorRef.current
    return scrollTop + clientHeight >= scrollHeight - UMBRAL_FONDO_PX
  }, [])

  /**
   * Scroll al fondo del contenedor.
   * suave=true: animacion smooth para interaccion del usuario (boton)
   * suave=false: instant para cambio de conversacion o reset programatico
   */
  const irAlFondo = useCallback((suave = false) => {
    if (!contenedorRef.current) return
    contenedorRef.current.scrollTo({
      top: contenedorRef.current.scrollHeight,
      behavior: suave ? "smooth" : "instant",
    })
    estaEnFondoRef.current = true
    setEstaEnFondo(true)
  }, [])

  // Detectar scroll del usuario con { passive: true } para no bloquear el hilo principal
  useEffect(() => {
    const contenedor = contenedorRef.current
    if (!contenedor) return
    let timeoutId: ReturnType<typeof setTimeout>

    const manejarScroll = () => {
      estaUsuarioScrolleandoRef.current = true
      clearTimeout(timeoutId)
      const enFondo = verificarSiEstaEnFondo()
      estaEnFondoRef.current = enFondo
      setEstaEnFondo(enFondo)
      // Resetear flag despues de 150ms de inactividad de scroll
      timeoutId = setTimeout(() => {
        estaUsuarioScrolleandoRef.current = false
      }, 150)
    }

    contenedor.addEventListener("scroll", manejarScroll, { passive: true })
    return () => {
      contenedor.removeEventListener("scroll", manejarScroll)
      clearTimeout(timeoutId)
    }
  }, [verificarSiEstaEnFondo])

  // Auto-scroll reactivo a cambios del DOM real, no al ciclo de React
  useEffect(() => {
    const contenedor = contenedorRef.current
    if (!contenedor) return

    const scrollSiNecesario = () => {
      // Solo auto-scroll si estaba en fondo Y el usuario no esta scrolleando activamente
      if (!estaEnFondoRef.current || estaUsuarioScrolleandoRef.current) return
      // Un solo rAF por frame: evita acumular llamadas durante streaming intenso
      if (rafId.current !== null) return
      rafId.current = requestAnimationFrame(() => {
        contenedor.scrollTo({ top: contenedor.scrollHeight, behavior: "instant" })
        rafId.current = null
      })
    }

    // MutationObserver: texto nuevo en streaming (characterData) y mensajes nuevos (childList)
    const observadorMutacion = new MutationObserver(scrollSiNecesario)
    observadorMutacion.observe(contenedor, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    // ResizeObserver: cambios de altura por markdown renderizando, tablas, imagenes, etc.
    const observadorTamano = new ResizeObserver(scrollSiNecesario)
    observadorTamano.observe(contenedor)
    for (const hijo of contenedor.children) {
      observadorTamano.observe(hijo)
    }

    return () => {
      observadorMutacion.disconnect()
      observadorTamano.disconnect()
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current)
        rafId.current = null
      }
    }
  }, [])

  return { contenedorRef, estaEnFondo, irAlFondo }
}
