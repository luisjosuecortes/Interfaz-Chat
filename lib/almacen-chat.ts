"use client"

import { useSyncExternalStore } from "react"
import type { EstadoChat, AccionesChat, Mensaje, Conversacion } from "./tipos"
import { MODELO_POR_DEFECTO } from "./modelos"

// Generador de IDs simple
function generarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9)
}

// Estado inicial
const estadoInicial: EstadoChat = {
  conversaciones: [],
  conversacionActiva: null,
  estaBarraLateralAbierta: true,
  estaEscribiendo: false,
  modeloSeleccionado: MODELO_POR_DEFECTO,
}

// Store global simple (sin dependencias externas)
let estado: EstadoChat = estadoInicial
const suscriptores = new Set<() => void>()

function obtenerEstado(): EstadoChat {
  return estado
}

function establecerEstado(actualizador: (previo: EstadoChat) => EstadoChat) {
  estado = actualizador(estado)
  suscriptores.forEach((suscriptor) => suscriptor())
}

function suscribirse(suscriptor: () => void): () => void {
  suscriptores.add(suscriptor)
  return () => suscriptores.delete(suscriptor)
}

// Acciones
const acciones: AccionesChat = {
  crearConversacion: () => {
    const id = generarId()
    const nuevaConversacion: Conversacion = {
      id,
      titulo: "Sin titulo",
      mensajes: [],
      fechaCreacion: new Date(),
      fechaActualizacion: new Date(),
    }
    establecerEstado((previo) => ({
      ...previo,
      conversaciones: [nuevaConversacion, ...previo.conversaciones],
      conversacionActiva: id,
    }))
    return id
  },

  eliminarConversacion: (id: string) => {
    establecerEstado((previo) => {
      const conversacionesFiltradas = previo.conversaciones.filter((c) => c.id !== id)
      const nuevaActiva =
        previo.conversacionActiva === id
          ? conversacionesFiltradas[0]?.id ?? null
          : previo.conversacionActiva
      return {
        ...previo,
        conversaciones: conversacionesFiltradas,
        conversacionActiva: nuevaActiva,
      }
    })
  },

  seleccionarConversacion: (id: string) => {
    establecerEstado((previo) => ({
      ...previo,
      conversacionActiva: id,
    }))
  },

  agregarMensaje: (conversacionId: string, mensaje: Omit<Mensaje, "id" | "fechaCreacion">) => {
    const nuevoMensaje: Mensaje = {
      ...mensaje,
      id: generarId(),
      fechaCreacion: new Date(),
    }
    establecerEstado((previo) => ({
      ...previo,
      conversaciones: previo.conversaciones.map((c) => {
        if (c.id !== conversacionId) return c
        return {
          ...c,
          mensajes: [...c.mensajes, nuevoMensaje],
          fechaActualizacion: new Date(),
        }
      }),
    }))
  },

  actualizarUltimoMensaje: (conversacionId: string, contenido: string) => {
    establecerEstado((previo) => ({
      ...previo,
      conversaciones: previo.conversaciones.map((c) => {
        if (c.id !== conversacionId) return c
        const mensajesActualizados = [...c.mensajes]
        const ultimo = mensajesActualizados[mensajesActualizados.length - 1]
        if (ultimo) {
          mensajesActualizados[mensajesActualizados.length - 1] = {
            ...ultimo,
            contenido,
          }
        }
        return {
          ...c,
          mensajes: mensajesActualizados,
          fechaActualizacion: new Date(),
        }
      }),
    }))
  },

  alternarBarraLateral: () => {
    establecerEstado((previo) => ({
      ...previo,
      estaBarraLateralAbierta: !previo.estaBarraLateralAbierta,
    }))
  },

  establecerEscribiendo: (valor: boolean) => {
    establecerEstado((previo) => ({
      ...previo,
      estaEscribiendo: valor,
    }))
  },

  renombrarConversacion: (id: string, titulo: string) => {
    establecerEstado((previo) => ({
      ...previo,
      conversaciones: previo.conversaciones.map((c) =>
        c.id === id ? { ...c, titulo } : c
      ),
    }))
  },

  seleccionarModelo: (idModelo: string) => {
    establecerEstado((previo) => ({
      ...previo,
      modeloSeleccionado: idModelo,
    }))
  },

  editarYRecortarMensajes: (conversacionId: string, idMensaje: string, nuevoContenido: string) => {
    establecerEstado((previo) => ({
      ...previo,
      conversaciones: previo.conversaciones.map((c) => {
        if (c.id !== conversacionId) return c
        const indiceMensaje = c.mensajes.findIndex((m) => m.id === idMensaje)
        if (indiceMensaje === -1) return c
        const mensajesRecortados = c.mensajes.slice(0, indiceMensaje + 1)
        mensajesRecortados[indiceMensaje] = {
          ...mensajesRecortados[indiceMensaje],
          contenido: nuevoContenido,
        }
        return {
          ...c,
          mensajes: mensajesRecortados,
          fechaActualizacion: new Date(),
        }
      }),
    }))
  },

  recortarMensajesDesde: (conversacionId: string, indiceDesde: number) => {
    establecerEstado((previo) => ({
      ...previo,
      conversaciones: previo.conversaciones.map((c) => {
        if (c.id !== conversacionId) return c
        if (indiceDesde >= c.mensajes.length) return c
        return {
          ...c,
          mensajes: c.mensajes.slice(0, indiceDesde),
          fechaActualizacion: new Date(),
        }
      }),
    }))
  },
}

// Hook personalizado para usar el store
export function useAlmacenChat() {
  const instantanea = useSyncExternalStore(suscribirse, obtenerEstado, obtenerEstado)

  const conversacionActual = instantanea.conversacionActiva
    ? instantanea.conversaciones.find((c) => c.id === instantanea.conversacionActiva) ?? null
    : null

  return {
    ...instantanea,
    ...acciones,
    conversacionActual,
  }
}
