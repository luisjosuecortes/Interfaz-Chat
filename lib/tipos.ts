// Tipos principales del chat

export interface Adjunto {
  id: string
  tipo: "imagen" | "archivo"
  nombre: string
  contenido: string // data URL (base64) para imágenes y archivos
  tipoMime: string
}

export interface Mensaje {
  id: string
  rol: "usuario" | "asistente"
  contenido: string
  adjuntos?: Adjunto[]
  fechaCreacion: Date
}

export interface Conversacion {
  id: string
  titulo: string
  mensajes: Mensaje[]
  fechaCreacion: Date
  fechaActualizacion: Date
}

// Definición de un modelo disponible
export interface ModeloDisponible {
  id: string
  nombre: string
  descripcion: string
  categoria: "gpt-5.2" | "gpt-5.1" | "gpt-5" | "gpt-4.1" | "gpt-4o"
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
}
