"use client"

import { useState, useRef } from "react"
import { useAlmacenChat } from "@/lib/almacen-chat"
import { BarraLateral } from "@/components/chat/barra-lateral"
import { AreaChat } from "@/components/chat/area-chat"
import { PantallaInicio } from "@/components/chat/pantalla-inicio"
import { enviarMensajeConStreaming } from "@/lib/cliente-chat"
import type { Adjunto } from "@/lib/tipos"

// Intervalo minimo entre actualizaciones de UI durante streaming (ms)
const INTERVALO_THROTTLE = 30

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
    editarYRecortarMensajes,
    recortarMensajesDesde,
  } = useAlmacenChat()

  const [mensajeError, establecerMensajeError] = useState<string | null>(null)
  const referenciaControlador = useRef<AbortController | null>(null)

  // Generar titulo con IA despues del primer intercambio
  async function generarTituloConversacion(
    idConversacion: string,
    mensajeUsuario: string,
    respuestaAsistente: string
  ) {
    try {
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
      // Fallo silencioso: conservar titulo existente
    }
  }

  // Detener generacion en curso
  function detenerGeneracion() {
    referenciaControlador.current?.abort()
    referenciaControlador.current = null
  }

  // Helper compartido para enviar mensajes al modelo con streaming
  async function enviarConsultaAlModelo(
    idConversacion: string,
    historialMensajes: Array<{ rol: "usuario" | "asistente"; contenido: string }>,
    adjuntos?: Adjunto[],
    debeGenerarTitulo?: boolean,
    contenidoParaTitulo?: string
  ) {
    establecerMensajeError(null)

    const controlador = new AbortController()
    referenciaControlador.current = controlador

    establecerEscribiendo(true)
    agregarMensaje(idConversacion, { rol: "asistente", contenido: "" })

    // Throttle para limitar re-renders durante streaming
    let ultimaActualizacionUI = 0
    let textoRespuestaFinal = ""

    await enviarMensajeConStreaming({
      mensajes: historialMensajes,
      modelo: modeloSeleccionado,
      adjuntos,
      senalAborto: controlador.signal,
      alActualizar: (textoActual) => {
        textoRespuestaFinal = textoActual
        const ahora = Date.now()
        if (ahora - ultimaActualizacionUI >= INTERVALO_THROTTLE) {
          actualizarUltimoMensaje(idConversacion, textoActual)
          ultimaActualizacionUI = ahora
        }
      },
      alFinalizar: () => {
        // Asegurar que el texto final completo se muestre
        actualizarUltimoMensaje(idConversacion, textoRespuestaFinal)
        establecerEscribiendo(false)
        referenciaControlador.current = null

        if (debeGenerarTitulo && contenidoParaTitulo) {
          generarTituloConversacion(idConversacion, contenidoParaTitulo, textoRespuestaFinal)
        }
      },
      alError: (error) => {
        // Asegurar que el texto parcial se muestre
        if (textoRespuestaFinal) {
          actualizarUltimoMensaje(idConversacion, textoRespuestaFinal)
        }
        establecerMensajeError(error)
        establecerEscribiendo(false)
        referenciaControlador.current = null
      },
    })
  }

  // Enviar un nuevo mensaje (flujo principal)
  async function manejarEnvio(contenido: string, adjuntos?: Adjunto[]) {
    let idConversacion = conversacionActiva
    const mensajesPrevios = conversacionActual?.mensajes ?? []
    const esPrimerMensaje = mensajesPrevios.length === 0

    if (!idConversacion) {
      idConversacion = crearConversacion()
    }

    agregarMensaje(idConversacion, { rol: "usuario", contenido, adjuntos })

    const historialMensajes = [
      ...mensajesPrevios.map((m) => ({
        rol: m.rol,
        contenido: m.contenido,
      })),
      { rol: "usuario" as const, contenido },
    ]

    await enviarConsultaAlModelo(
      idConversacion,
      historialMensajes,
      adjuntos,
      esPrimerMensaje,
      contenido
    )
  }

  // Editar un mensaje del usuario y reenviar
  async function manejarEdicionMensaje(idMensaje: string, nuevoContenido: string) {
    if (!conversacionActiva || !conversacionActual) return
    if (estaEscribiendo) return

    const indiceMensaje = conversacionActual.mensajes.findIndex((m) => m.id === idMensaje)
    if (indiceMensaje === -1) return

    const mensajeOriginal = conversacionActual.mensajes[indiceMensaje]

    // Construir historial hasta este mensaje con contenido editado
    const historialMensajes = conversacionActual.mensajes.slice(0, indiceMensaje).map((m) => ({
      rol: m.rol,
      contenido: m.contenido,
    }))
    historialMensajes.push({ rol: "usuario", contenido: nuevoContenido })

    // Actualizar store: cambiar contenido y eliminar mensajes posteriores
    editarYRecortarMensajes(conversacionActiva, idMensaje, nuevoContenido)

    const esPrimerMensaje = indiceMensaje === 0

    await enviarConsultaAlModelo(
      conversacionActiva,
      historialMensajes,
      mensajeOriginal.adjuntos,
      esPrimerMensaje,
      nuevoContenido
    )
  }

  // Reenviar un mensaje del usuario (mismo contenido, nueva respuesta)
  async function manejarReenvioMensaje(idMensaje: string) {
    if (!conversacionActiva || !conversacionActual) return
    if (estaEscribiendo) return

    const indiceMensaje = conversacionActual.mensajes.findIndex((m) => m.id === idMensaje)
    if (indiceMensaje === -1) return

    const mensaje = conversacionActual.mensajes[indiceMensaje]

    // Construir historial hasta e incluyendo este mensaje
    const historialMensajes = conversacionActual.mensajes.slice(0, indiceMensaje + 1).map((m) => ({
      rol: m.rol,
      contenido: m.contenido,
    }))

    // Eliminar todo despues de este mensaje
    recortarMensajesDesde(conversacionActiva, indiceMensaje + 1)

    const esPrimerMensaje = indiceMensaje === 0

    await enviarConsultaAlModelo(
      conversacionActiva,
      historialMensajes,
      mensaje.adjuntos,
      esPrimerMensaje,
      mensaje.contenido
    )
  }

  // Regenerar la respuesta del asistente
  async function manejarRegenerarRespuesta(idMensajeAsistente: string) {
    if (!conversacionActiva || !conversacionActual) return
    if (estaEscribiendo) return

    const indiceMensaje = conversacionActual.mensajes.findIndex((m) => m.id === idMensajeAsistente)
    if (indiceMensaje === -1) return

    // Encontrar el mensaje del usuario previo a esta respuesta
    let indiceUsuario = indiceMensaje - 1
    while (indiceUsuario >= 0 && conversacionActual.mensajes[indiceUsuario].rol !== "usuario") {
      indiceUsuario--
    }
    if (indiceUsuario < 0) return

    const mensajeUsuario = conversacionActual.mensajes[indiceUsuario]

    // Construir historial hasta e incluyendo el mensaje del usuario
    const historialMensajes = conversacionActual.mensajes.slice(0, indiceUsuario + 1).map((m) => ({
      rol: m.rol,
      contenido: m.contenido,
    }))

    // Eliminar desde la respuesta del asistente en adelante
    recortarMensajesDesde(conversacionActiva, indiceMensaje)

    const esPrimerMensaje = indiceUsuario === 0

    await enviarConsultaAlModelo(
      conversacionActiva,
      historialMensajes,
      mensajeUsuario.adjuntos,
      esPrimerMensaje,
      mensajeUsuario.contenido
    )
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
            alEditarMensaje={manejarEdicionMensaje}
            alReenviarMensaje={manejarReenvioMensaje}
            alRegenerarRespuesta={manejarRegenerarRespuesta}
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
