"use client"

import { useState } from "react"
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

  // Lógica centralizada de envío de mensajes
  async function manejarEnvio(contenido: string, adjuntos?: Adjunto[]) {
    establecerMensajeError(null)

    // Si no hay conversación activa, crear una nueva
    let idConversacion = conversacionActiva
    const mensajesPrevios = conversacionActual?.mensajes ?? []

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

    // Iniciar respuesta del asistente
    establecerEscribiendo(true)
    agregarMensaje(idConversacion, { rol: "asistente", contenido: "" })

    await enviarMensajeConStreaming({
      mensajes: historialMensajes,
      modelo: modeloSeleccionado,
      adjuntos,
      alActualizar: (textoActual) => {
        actualizarUltimoMensaje(idConversacion!, textoActual)
      },
      alFinalizar: () => {
        establecerEscribiendo(false)
      },
      alError: (error) => {
        establecerMensajeError(error)
        establecerEscribiendo(false)
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

      {/* Área principal */}
      <main className="flex flex-1 flex-col min-w-0">
        {conversacionActual ? (
          <AreaChat
            conversacion={conversacionActual}
            estaEscribiendo={estaEscribiendo}
            estaBarraLateralAbierta={estaBarraLateralAbierta}
            modeloSeleccionado={modeloSeleccionado}
            mensajeError={mensajeError}
            alEnviar={manejarEnvio}
            alAlternarBarraLateral={alternarBarraLateral}
            alSeleccionarModelo={seleccionarModelo}
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
