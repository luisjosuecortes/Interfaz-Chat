// Tipos principales del chat

export interface Mensaje {
  id: string
  rol: "usuario" | "asistente"
  contenido: string
  fechaCreacion: Date
}

export interface Conversacion {
  id: string
  titulo: string
  mensajes: Mensaje[]
  fechaCreacion: Date
  fechaActualizacion: Date
}

export interface EstadoChat {
  conversaciones: Conversacion[]
  conversacionActiva: string | null
  estaBarraLateralAbierta: boolean
  estaEscribiendo: boolean
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
}
