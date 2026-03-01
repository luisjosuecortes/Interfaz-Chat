// Definición de modelos disponibles organizados por proveedor
// Fuente: https://platform.openai.com/docs/models
import type { ModeloDisponible, ProveedorIA } from "./tipos"

// Proveedores de IA disponibles
export const PROVEEDORES: ProveedorIA[] = [
  { id: "openai", nombre: "OpenAI" },
]

// Modelos disponibles — cada modelo pertenece a un proveedor
export const MODELOS_DISPONIBLES: ModeloDisponible[] = [
  // GPT-5.2 (diciembre 2025, última versión de la serie 5.x)
  {
    id: "gpt-5.2",
    nombre: "GPT-5.2",
    descripcion: "El modelo más reciente y capaz de OpenAI",
    proveedor: "openai",
    categoria: "gpt-5.2",
    ventanaContexto: 200_000,
    maxTokensSalida: 32_768,
    tieneReasoning: true,
  },

  // GPT-5.1 (noviembre 2025, recomendado para código y razonamiento)
  {
    id: "gpt-5.1",
    nombre: "GPT-5.1",
    descripcion: "Ideal para código, razonamiento y tareas agénticas",
    proveedor: "openai",
    categoria: "gpt-5.1",
    ventanaContexto: 200_000,
    maxTokensSalida: 32_768,
    tieneReasoning: true,
  },

  // GPT-5 (agosto 2025)
  {
    id: "gpt-5",
    nombre: "GPT-5",
    descripcion: "Modelo base de propósito general de la familia GPT-5",
    proveedor: "openai",
    categoria: "gpt-5",
    ventanaContexto: 200_000,
    maxTokensSalida: 32_768,
    tieneReasoning: true,
  },
  {
    id: "gpt-5-mini",
    nombre: "GPT-5 Mini",
    descripcion: "Versión rápida y eficiente de GPT-5",
    proveedor: "openai",
    categoria: "gpt-5",
    ventanaContexto: 128_000,
    maxTokensSalida: 16_384,
    tieneReasoning: true,
  },
  {
    id: "gpt-5-nano",
    nombre: "GPT-5 Nano",
    descripcion: "El modelo más rápido y ultra-económico de la familia GPT-5",
    proveedor: "openai",
    categoria: "gpt-5",
    ventanaContexto: 128_000,
    maxTokensSalida: 16_384,
    tieneReasoning: true,
  },

  // GPT-4.1 (2025, serie principal antes de GPT-5)
  {
    id: "gpt-4.1",
    nombre: "GPT-4.1",
    descripcion: "Modelo avanzado de la familia 4.1, versátil y preciso",
    proveedor: "openai",
    categoria: "gpt-4.1",
    ventanaContexto: 1_047_576,
    maxTokensSalida: 32_768,
  },
  {
    id: "gpt-4.1-mini",
    nombre: "GPT-4.1 Mini",
    descripcion: "Versión compacta y económica de GPT-4.1",
    proveedor: "openai",
    categoria: "gpt-4.1",
    ventanaContexto: 1_047_576,
    maxTokensSalida: 32_768,
  },

  // GPT-4o (multimodal, ampliamente soportado)
  {
    id: "gpt-4o",
    nombre: "GPT-4o",
    descripcion: "Modelo multimodal de propósito general",
    proveedor: "openai",
    categoria: "gpt-4o",
    ventanaContexto: 128_000,
    maxTokensSalida: 16_384,
  },
  {
    id: "gpt-4o-mini",
    nombre: "GPT-4o Mini",
    descripcion: "Versión compacta y económica de GPT-4o",
    proveedor: "openai",
    categoria: "gpt-4o",
    ventanaContexto: 128_000,
    maxTokensSalida: 16_384,
  },
]

// Categorías para agrupar modelos dentro de cada proveedor
export const CATEGORIAS_MODELOS = [
  { clave: "gpt-5.2", etiqueta: "GPT-5.2", proveedor: "openai" },
  { clave: "gpt-5.1", etiqueta: "GPT-5.1", proveedor: "openai" },
  { clave: "gpt-5", etiqueta: "GPT-5", proveedor: "openai" },
  { clave: "gpt-4.1", etiqueta: "GPT-4.1", proveedor: "openai" },
  { clave: "gpt-4o", etiqueta: "GPT-4o", proveedor: "openai" },
] as const

export const MODELO_POR_DEFECTO = "gpt-4o-mini"

export function obtenerModelo(idModelo: string): ModeloDisponible | undefined {
  return MODELOS_DISPONIBLES.find((modelo) => modelo.id === idModelo)
}

export function obtenerNombreModelo(idModelo: string): string {
  return obtenerModelo(idModelo)?.nombre ?? idModelo
}

export function obtenerProveedorDeModelo(idModelo: string): ProveedorIA | undefined {
  const modelo = obtenerModelo(idModelo)
  if (!modelo) return undefined
  return PROVEEDORES.find((p) => p.id === modelo.proveedor)
}
