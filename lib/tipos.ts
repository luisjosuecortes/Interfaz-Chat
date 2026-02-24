// Tipos principales del chat

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
  tieneReasoning?: boolean
}

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
