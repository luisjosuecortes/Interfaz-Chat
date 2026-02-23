"use client"

import { useState, useCallback } from "react"

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
