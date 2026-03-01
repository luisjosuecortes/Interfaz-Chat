// Tipos principales del chat

// === TIPOS RAG ===

/** Estado del procesamiento de un documento RAG */
export type EstadoProcesamientoRAG =
  | "pendiente"
  | "extrayendo"
  | "fragmentando"
  | "vectorizando"
  | "listo"
  | "error"

/** Un fragmento de documento con embeddings para busqueda en dos fases:
 *  1. Hamming binario (embedding) → filtrado rapido de candidatos
 *  2. Cosine similarity Float32 (embeddingFloat) → re-ranking preciso */
export interface FragmentoDocumento {
  id: string
  documentoId: string
  texto: string
  embedding: Uint8Array           // Binario 32 bytes (Hamming rapido, fase 1)
  embeddingFloat?: Float32Array   // Matryoshka 256 dims (re-ranking preciso, fase 2)
  indice: number
  metadatos: {
    inicio: number
    fin: number
  }
}

/** Documento procesado para RAG */
export interface DocumentoRAG {
  id: string
  nombre: string
  tipoMime: string
  estado: EstadoProcesamientoRAG
  mensajeError?: string
  fragmentos: FragmentoDocumento[]
  fechaCreacion: Date
  fechaProcesamiento?: Date
}

/** Resultado de busqueda por similitud binaria (Hamming) */
export interface ResultadoBusqueda {
  fragmento: FragmentoDocumento
  similitud: number
  nombreDocumento: string
  totalFragmentosDocumento: number
}

/** Estado de un documento RAG en la UI */
export interface DocumentoRAGUI {
  id: string
  nombre: string
  estado: EstadoProcesamientoRAG
  progreso?: number
  error?: string
  adjuntoId?: string
}

// === TIPOS CHAT ===

export interface Adjunto {
  id: string
  tipo: "imagen" | "archivo"
  nombre: string
  contenido: string // data URL (base64) para imágenes y archivos
  tipoMime: string
}

export interface CitacionWeb {
  url: string
  titulo: string
  indiceInicio: number
  indiceFin: number
}

export interface FuenteWeb {
  url: string
}

export interface InfoBusquedaWeb {
  estado: "iniciada" | "buscando" | "completada"
  consultas: string[]
  fuentes: FuenteWeb[]
}

export interface InfoPensamiento {
  estado: "pensando" | "completado"
  resumen: string
}

export interface Mensaje {
  id: string
  rol: "usuario" | "asistente"
  contenido: string
  modelo?: string
  adjuntos?: Adjunto[]
  citaciones?: CitacionWeb[]
  busquedaWeb?: InfoBusquedaWeb
  pensamiento?: InfoPensamiento
  fechaCreacion: Date
}

export interface Conversacion {
  id: string
  titulo: string
  mensajes: Mensaje[]
  fechaCreacion: Date
  fechaActualizacion: Date
}

// Definición de un proveedor de IA (OpenAI, Anthropic, Google, etc.)
export interface ProveedorIA {
  id: string
  nombre: string
}

// Definición de un modelo disponible
export interface ModeloDisponible {
  id: string
  nombre: string
  descripcion: string
  proveedor: string  // ID del proveedor (e.g. "openai", "anthropic")
  categoria: string  // Familia del modelo (e.g. "gpt-5.2", "claude-4")
  ventanaContexto: number   // Tokens max de contexto (ej: 128_000 para GPT-4o)
  maxTokensSalida: number   // Tokens max de respuesta (ej: 16_384 para GPT-4o)
  tieneReasoning?: boolean
}

// === TIPOS ARTEFACTOS ===

/** Tipo de artefacto detectado en la respuesta del modelo */
export type TipoArtefacto = "codigo" | "html" | "svg" | "markdown" | "latex"

/** Artefacto: contenido grande extraído del chat para visualizar en panel lateral */
export interface Artefacto {
  id: string
  tipo: TipoArtefacto
  titulo: string
  contenido: string
  lenguaje?: string
  totalLineas: number
}

// === TIPOS ESTADO GLOBAL ===

export interface EstadoChat {
  conversaciones: Conversacion[]
  conversacionActiva: string | null
  estaBarraLateralAbierta: boolean
  estaEscribiendo: boolean
  modeloSeleccionado: string
}

// Acciones del store
export interface AccionesChat {
  crearConversacion: () => string
  iniciarNuevaConversacion: () => void
  eliminarConversacion: (id: string) => void
  seleccionarConversacion: (id: string) => void
  agregarMensaje: (conversacionId: string, mensaje: Omit<Mensaje, "id" | "fechaCreacion">) => void
  actualizarUltimoMensaje: (conversacionId: string, contenido: string) => void
  alternarBarraLateral: () => void
  establecerEscribiendo: (valor: boolean) => void
  renombrarConversacion: (id: string, titulo: string) => void
  seleccionarModelo: (idModelo: string) => void
  editarYRecortarMensajes: (conversacionId: string, idMensaje: string, nuevoContenido: string) => void
  recortarMensajesDesde: (conversacionId: string, indiceDesde: number) => void
  actualizarBusquedaUltimoMensaje: (conversacionId: string, busquedaWeb: InfoBusquedaWeb) => void
  agregarCitacionUltimoMensaje: (conversacionId: string, citacion: CitacionWeb) => void
  actualizarPensamientoUltimoMensaje: (conversacionId: string, pensamiento: InfoPensamiento) => void
}
