// Definición de modelos disponibles de OpenAI
// Fuente: https://platform.openai.com/docs/models
import type { ModeloDisponible } from "./tipos"

export const MODELOS_DISPONIBLES: ModeloDisponible[] = [
  // GPT-5.2 (diciembre 2025, última versión de la serie 5.x)
  {
    id: "gpt-5.2",
    nombre: "GPT-5.2",
    descripcion: "El modelo más reciente y capaz de OpenAI",
    categoria: "gpt-5.2",
  },

  // GPT-5.1 (noviembre 2025, recomendado para código y razonamiento)
  {
    id: "gpt-5.1",
    nombre: "GPT-5.1",
    descripcion: "Ideal para código, razonamiento y tareas agénticas",
    categoria: "gpt-5.1",
  },

  // GPT-5 (agosto 2025)
  {
    id: "gpt-5",
    nombre: "GPT-5",
    descripcion: "Modelo base de propósito general de la familia GPT-5",
    categoria: "gpt-5",
  },
  {
    id: "gpt-5-mini",
    nombre: "GPT-5 Mini",
    descripcion: "Versión rápida y eficiente de GPT-5",
    categoria: "gpt-5",
  },
  {
    id: "gpt-5-nano",
    nombre: "GPT-5 Nano",
    descripcion: "El modelo más rápido y ultra-económico de la familia GPT-5",
    categoria: "gpt-5",
  },

  // GPT-4.1 (2025, serie principal antes de GPT-5)
  {
    id: "gpt-4.1",
    nombre: "GPT-4.1",
    descripcion: "Modelo avanzado de la familia 4.1, versátil y preciso",
    categoria: "gpt-4.1",
  },
  {
    id: "gpt-4.1-mini",
    nombre: "GPT-4.1 Mini",
    descripcion: "Versión compacta y económica de GPT-4.1",
    categoria: "gpt-4.1",
  },

  // GPT-4o (multimodal, ampliamente soportado)
  {
    id: "gpt-4o",
    nombre: "GPT-4o",
    descripcion: "Modelo multimodal de propósito general",
    categoria: "gpt-4o",
  },
  {
    id: "gpt-4o-mini",
    nombre: "GPT-4o Mini",
    descripcion: "Versión compacta y económica de GPT-4o",
    categoria: "gpt-4o",
  },
]

export const MODELO_POR_DEFECTO = "gpt-4o-mini"

export function obtenerModelo(idModelo: string): ModeloDisponible | undefined {
  return MODELOS_DISPONIBLES.find((modelo) => modelo.id === idModelo)
}

export function obtenerNombreModelo(idModelo: string): string {
  return obtenerModelo(idModelo)?.nombre ?? idModelo
}
