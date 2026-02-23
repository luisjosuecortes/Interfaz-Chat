"use client"

import { useState, useRef } from "react"
import { useAlmacenChat } from "@/lib/almacen-chat"
import { BarraLateral } from "@/components/chat/barra-lateral"
import { AreaChat } from "@/components/chat/area-chat"
import { PantallaInicio } from "@/components/chat/pantalla-inicio"
import { enviarMensajeConStreaming } from "@/lib/cliente-chat"
import type { Adjunto } from "@/lib/tipos"

export function ContenedorChat() {
  const {
    conversacionActual,
    estaBarraLateralAbierta,
    conversaciones,
    estaEscribiendo,
    modeloSeleccionado,
    crearConversacion,
    eliminarConversacion,
    seleccionarConversacion,
    agregarMensaje,
    actualizarUltimoMensaje,
    alternarBarraLateral,
    establecerEscribiendo,
    renombrarConversacion,
    seleccionarModelo,
    conversacionActiva,
  } = useAlmacenChat()

  const [mensajeError, establecerMensajeError] = useState<string | null>(null)
  const referenciaControlador = useRef<AbortController | null>(null)

  // Generar titulo con IA despues del primer intercambio
  async function generarTituloConversacion(idConversacion: string, mensajeUsuario: string) {
    try {
      const conversacion = conversaciones.find((c) => c.id === idConversacion)
      const respuestaAsistente =
        conversacion?.mensajes[conversacion.mensajes.length - 1]?.contenido || ""

      const respuesta = await fetch("/api/titulo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensajeUsuario, respuestaAsistente }),
      })

      if (respuesta.ok) {
        const { titulo } = await respuesta.json()
        if (titulo) {
          renombrarConversacion(idConversacion, titulo)
        }
      }
    } catch {
      // Fallo silencioso: conservar titulo por substring
    }
  }

  // Detener generacion en curso
  function detenerGeneracion() {
    referenciaControlador.current?.abort()
    referenciaControlador.current = null
  }

  // Logica centralizada de envio de mensajes
  async function manejarEnvio(contenido: string, adjuntos?: Adjunto[]) {
    establecerMensajeError(null)

    // Si no hay conversacion activa, crear una nueva
    let idConversacion = conversacionActiva
    const mensajesPrevios = conversacionActual?.mensajes ?? []
    const esPrimerMensaje = mensajesPrevios.length === 0

    if (!idConversacion) {
      idConversacion = crearConversacion()
    }

    // Agregar mensaje del usuario (con adjuntos si los hay)
    agregarMensaje(idConversacion, { rol: "usuario", contenido, adjuntos })

    // Preparar historial para la API (solo texto, adjuntos van por separado)
    const historialMensajes = [
      ...mensajesPrevios.map((m) => ({
        rol: m.rol,
        contenido: m.contenido,
      })),
      { rol: "usuario" as const, contenido },
    ]

    // Crear controlador de cancelacion para esta solicitud
    const controlador = new AbortController()
    referenciaControlador.current = controlador

    // Iniciar respuesta del asistente
    establecerEscribiendo(true)
    agregarMensaje(idConversacion, { rol: "asistente", contenido: "" })

    await enviarMensajeConStreaming({
      mensajes: historialMensajes,
      modelo: modeloSeleccionado,
      adjuntos,
      senalAborto: controlador.signal,
      alActualizar: (textoActual) => {
        actualizarUltimoMensaje(idConversacion!, textoActual)
      },
      alFinalizar: () => {
        establecerEscribiendo(false)
        referenciaControlador.current = null

        // Generar titulo con IA despues del primer intercambio
        if (esPrimerMensaje && idConversacion) {
          generarTituloConversacion(idConversacion, contenido)
        }
      },
      alError: (error) => {
        establecerMensajeError(error)
        establecerEscribiendo(false)
        referenciaControlador.current = null
      },
    })
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--color-claude-bg)]">
      {/* Barra lateral */}
      <BarraLateral
        estaAbierta={estaBarraLateralAbierta}
        conversaciones={conversaciones}
        conversacionActiva={conversacionActiva}
        alAlternar={alternarBarraLateral}
        alNuevaConversacion={crearConversacion}
        alSeleccionarConversacion={seleccionarConversacion}
        alEliminarConversacion={eliminarConversacion}
        alRenombrarConversacion={renombrarConversacion}
      />

      {/* Area principal */}
      <main className="flex flex-1 flex-col min-w-0">
        {conversacionActual && conversacionActual.mensajes.length > 0 ? (
          <AreaChat
            conversacion={conversacionActual}
            estaEscribiendo={estaEscribiendo}
            estaBarraLateralAbierta={estaBarraLateralAbierta}
            modeloSeleccionado={modeloSeleccionado}
            mensajeError={mensajeError}
            alEnviar={manejarEnvio}
            alAlternarBarraLateral={alternarBarraLateral}
            alSeleccionarModelo={seleccionarModelo}
            alDetener={detenerGeneracion}
          />
        ) : (
          <PantallaInicio
            estaBarraLateralAbierta={estaBarraLateralAbierta}
            modeloSeleccionado={modeloSeleccionado}
            alAlternarBarraLateral={alternarBarraLateral}
            alEnviar={manejarEnvio}
            alSeleccionarModelo={seleccionarModelo}
          />
        )}
      </main>
    </div>
  )
}
