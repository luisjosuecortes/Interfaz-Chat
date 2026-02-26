// Fragmentador de texto para RAG
// Divide texto largo en fragmentos con solapamiento para indexacion
// Soporta fragmentacion generica (texto/PDF) y fragmentacion inteligente por lenguaje (codigo)

import { obtenerSeparadores } from "./separadores-codigo"

interface OpcionesFragmentacion {
  tamanoFragmento?: number
  solapamiento?: number
}

export interface Fragmento {
  texto: string
  indice: number
  inicio: number
  fin: number
}

const TAMANO_FRAGMENTO_DEFAULT = 2000
const SOLAPAMIENTO_DEFAULT = 200

/** Fragmenta texto en chunks con solapamiento respetando limites naturales */
export function fragmentarTexto(
  texto: string,
  opciones: OpcionesFragmentacion = {}
): Fragmento[] {
  return fragmentarConSeparadores(texto, null, opciones)
}

/** Fragmenta codigo fuente usando separadores especificos del lenguaje.
 *  Detecta el lenguaje por la extension del archivo y usa separadores jerarquicos
 *  (patron LangChain) para cortar en limites semanticos: funciones, clases, exports.
 *  Si no hay separadores para la extension, cae al fragmentador generico. */
export function fragmentarCodigo(
  texto: string,
  nombreArchivo: string,
  opciones: OpcionesFragmentacion = {}
): Fragmento[] {
  const separadores = obtenerSeparadores(nombreArchivo)
  return fragmentarConSeparadores(texto, separadores, opciones)
}

/** Fragmenta texto con separadores opcionales de lenguaje */
function fragmentarConSeparadores(
  texto: string,
  separadoresLenguaje: string[] | null,
  opciones: OpcionesFragmentacion = {}
): Fragmento[] {
  const tamanoFragmento = opciones.tamanoFragmento ?? TAMANO_FRAGMENTO_DEFAULT
  const solapamiento = opciones.solapamiento ?? SOLAPAMIENTO_DEFAULT

  const textoLimpio = limpiarTexto(texto)

  // Si el texto cabe en un solo fragmento, retornarlo completo
  if (textoLimpio.length <= tamanoFragmento) {
    if (!textoLimpio.trim()) return []
    return [{ texto: textoLimpio, indice: 0, inicio: 0, fin: textoLimpio.length }]
  }

  const fragmentos: Fragmento[] = []
  let posicion = 0
  let indice = 0

  while (posicion < textoLimpio.length) {
    let fin = posicion + tamanoFragmento

    // Si no es el final del texto, buscar un punto de corte natural
    if (fin < textoLimpio.length) {
      fin = buscarPuntoDeCorte(textoLimpio, posicion, fin, separadoresLenguaje)
    }

    fin = Math.min(fin, textoLimpio.length)

    const fragmento = textoLimpio.slice(posicion, fin).trim()

    if (fragmento.length > 0) {
      fragmentos.push({ texto: fragmento, indice, inicio: posicion, fin })
      indice++
    }

    // Avanzar con solapamiento
    const siguientePosicion = fin - solapamiento

    // Evitar loop infinito: asegurar avance minimo
    if (siguientePosicion <= posicion) {
      posicion = fin
    } else {
      posicion = siguientePosicion
    }
  }

  return fragmentos
}

/** Limpia texto removiendo espacios y saltos de linea excesivos */
function limpiarTexto(texto: string): string {
  return texto
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim()
}

/** Busca un punto natural para cortar el texto.
 *  Si se pasan separadores de lenguaje, intenta cortar en limites semanticos del codigo
 *  (funciones, clases, exports) con un umbral agresivo de 0.3 para mantener bloques completos.
 *  Fallback a separadores genericos: parrafo > oracion > linea > espacio */
function buscarPuntoDeCorte(
  texto: string,
  inicio: number,
  finIdeal: number,
  separadoresLenguaje?: string[] | null
): number {
  const posRelativa = finIdeal - inicio

  // Buscar en una ventana alrededor del punto ideal
  const ventana = texto.slice(inicio, finIdeal + 100)

  // Prioridad 0: Separadores de lenguaje (umbral agresivo 0.3)
  if (separadoresLenguaje) {
    for (const sep of separadoresLenguaje) {
      const pos = ventana.lastIndexOf(sep, posRelativa)
      if (pos > posRelativa * 0.3) return inicio + pos
    }
  }

  // Prioridad 1: Fin de parrafo (doble salto de linea)
  const posParrafo = ventana.lastIndexOf("\n\n", posRelativa)
  if (posParrafo > posRelativa * 0.7) return inicio + posParrafo + 2

  // Prioridad 2: Fin de oracion
  const marcasOracion = [". ", "! ", "? ", ".\n", "!\n", "?\n"]
  for (const marca of marcasOracion) {
    const pos = ventana.lastIndexOf(marca, posRelativa)
    if (pos > posRelativa * 0.7) return inicio + pos + marca.length
  }

  // Prioridad 3: Salto de linea simple
  const posLinea = ventana.lastIndexOf("\n", posRelativa)
  if (posLinea > posRelativa * 0.8) return inicio + posLinea + 1

  // Prioridad 4: Espacio
  const posEspacio = ventana.lastIndexOf(" ", posRelativa)
  if (posEspacio > posRelativa * 0.9) return inicio + posEspacio + 1

  // Sin punto natural, cortar en el punto ideal
  return finIdeal
}
