"use client"

import { useState, useRef, useCallback } from "react"
import { useAlmacenChat } from "@/lib/almacen-chat"
import { BarraLateral } from "@/components/chat/barra-lateral"
import { AreaChat } from "@/components/chat/area-chat"
import { PantallaInicio } from "@/components/chat/pantalla-inicio"
import { enviarMensajeConStreaming } from "@/lib/cliente-chat"
import type { Adjunto, DocumentoRAGUI } from "@/lib/tipos"
import { generarId } from "@/lib/utils"
import {
  debeUsarRAG,
  procesarDocumentoParaRAG,
  buscarContextoRelevante,
  construirContextoParaPrompt,
} from "@/lib/rag/procesador-rag"
import {
  tieneFragmentosListos,
  obtenerEstadisticas,
  obtenerDocumentos,
  transferirDocumentos,
  eliminarDocumento,
} from "@/lib/rag/almacen-vectores"

// Intervalo minimo entre actualizaciones de UI durante streaming (ms)
const INTERVALO_THROTTLE = 30

// Limite de caracteres para el historial enviado a la API
// ~150K chars ≈ 37K-50K tokens, deja margen para contexto RAG y output del modelo
const LIMITE_CARACTERES_HISTORIAL = 150_000

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
    iniciarNuevaConversacion,
    editarYRecortarMensajes,
    recortarMensajesDesde,
    actualizarBusquedaUltimoMensaje,
    agregarCitacionUltimoMensaje,
    actualizarPensamientoUltimoMensaje,
  } = useAlmacenChat()

  const [mensajeError, establecerMensajeError] = useState<string | null>(null)
  const referenciaControlador = useRef<AbortController | null>(null)

  // Estado RAG: documentos procesados/en proceso
  const [documentosRAG, establecerDocumentosRAG] = useState<DocumentoRAGUI[]>([])

  // ID temporal para almacenar vectores RAG antes de crear la conversacion
  const idRAGTemporal = useRef<string | null>(null)

  // Derivado: hay documentos RAG indexandose actualmente
  const estaIndexandoRAG = documentosRAG.some(
    (d) => d.estado !== "listo" && d.estado !== "error"
  )

  // Obtener estadisticas RAG actuales (usa ID real o temporal)
  const idRAGActual = conversacionActiva ?? idRAGTemporal.current
  const estadisticasRAG = idRAGActual
    ? obtenerEstadisticas(idRAGActual)
    : { totalDocumentos: 0, documentosListos: 0, totalFragmentos: 0 }

  // Sincronizar documentos RAG al cambiar de conversacion
  const actualizarDocumentosRAGUI = useCallback((convId: string | null) => {
    if (!convId) {
      establecerDocumentosRAG([])
      return
    }
    const docs = obtenerDocumentos(convId)
    establecerDocumentosRAG(
      docs.map((d) => ({
        id: d.id,
        nombre: d.nombre,
        estado: d.estado,
        error: d.mensajeError,
      }))
    )
  }, [])

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

  // Obtener ID de conversacion para RAG (real o temporal)
  function obtenerIdRAG(): string {
    if (conversacionActiva) return conversacionActiva
    if (!idRAGTemporal.current) idRAGTemporal.current = generarId()
    return idRAGTemporal.current
  }

  // Procesar un adjunto con RAG inmediatamente al adjuntarlo (no al enviar)
  const manejarAdjuntoRAG = useCallback(async (adjunto: Adjunto) => {
    if (!debeUsarRAG(adjunto)) return

    const idConv = obtenerIdRAG()
    const placeholderId = "temp-" + adjunto.id

    establecerDocumentosRAG((prev) => [
      ...prev,
      { id: placeholderId, nombre: adjunto.nombre, estado: "pendiente" as const, adjuntoId: adjunto.id },
    ])

    await procesarDocumentoParaRAG(
      idConv,
      adjunto,
      (idDoc, estado, progreso, error) => {
        establecerDocumentosRAG((prev) => {
          const idx = prev.findIndex((d) => d.id === placeholderId || d.id === idDoc)
          if (idx === -1) return prev
          const nuevo = [...prev]
          nuevo[idx] = { id: idDoc, nombre: adjunto.nombre, estado, progreso, error, adjuntoId: adjunto.id }
          return nuevo
        })
      }
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversacionActiva])

  // Eliminar un documento RAG al quitar el adjunto
  const manejarEliminarDocumentoRAG = useCallback((adjuntoId: string) => {
    const idConv = conversacionActiva ?? idRAGTemporal.current
    if (!idConv) return

    const docRAG = documentosRAG.find((d) => d.adjuntoId === adjuntoId)
    if (docRAG) {
      eliminarDocumento(idConv, docRAG.id)
    }

    establecerDocumentosRAG((prev) => prev.filter((d) => d.adjuntoId !== adjuntoId))
  }, [conversacionActiva, documentosRAG])

  // Obtener contexto RAG para una consulta y retornar contenido aumentado
  async function obtenerContenidoConContextoRAG(
    idConversacion: string,
    contenidoOriginal: string
  ): Promise<string> {
    if (!tieneFragmentosListos(idConversacion)) return contenidoOriginal

    const resultados = await buscarContextoRelevante(idConversacion, contenidoOriginal)
    if (resultados.length === 0) return contenidoOriginal

    const contexto = construirContextoParaPrompt(resultados)
    return contexto + contenidoOriginal
  }

  // Truncar historial para conversaciones largas que exceden el contexto del modelo
  function truncarHistorial(
    mensajes: Array<{ rol: "usuario" | "asistente"; contenido: string }>
  ): Array<{ rol: "usuario" | "asistente"; contenido: string }> {
    let totalCaracteres = mensajes.reduce((acc, m) => acc + m.contenido.length, 0)
    if (totalCaracteres <= LIMITE_CARACTERES_HISTORIAL) return mensajes

    // Recortar desde el inicio conservando al menos los ultimos 4 mensajes (2 intercambios)
    let inicio = 0
    while (totalCaracteres > LIMITE_CARACTERES_HISTORIAL && inicio < mensajes.length - 4) {
      totalCaracteres -= mensajes[inicio].contenido.length
      inicio++
    }

    return mensajes.slice(inicio)
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

    // Truncar historial si excede el limite del modelo
    const historialFinal = truncarHistorial(historialMensajes)

    const controlador = new AbortController()
    referenciaControlador.current = controlador

    establecerEscribiendo(true)
    agregarMensaje(idConversacion, { rol: "asistente", contenido: "", modelo: modeloSeleccionado })

    // Throttle para limitar re-renders durante streaming
    let ultimaActualizacionUI = 0
    let textoRespuestaFinal = ""
    let resumenPensamientoAcumulado = ""

    await enviarMensajeConStreaming({
      mensajes: historialFinal,
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
      alBusquedaIniciada: () => {
        actualizarBusquedaUltimoMensaje(idConversacion, {
          estado: "iniciada",
          consultas: [],
          fuentes: [],
        })
      },
      alBusquedaBuscando: () => {
        actualizarBusquedaUltimoMensaje(idConversacion, {
          estado: "buscando",
          consultas: [],
          fuentes: [],
        })
      },
      alBusquedaResultado: (consultas, fuentes) => {
        actualizarBusquedaUltimoMensaje(idConversacion, {
          estado: "completada",
          consultas,
          fuentes,
        })
      },
      alCitacion: (citacion) => {
        agregarCitacionUltimoMensaje(idConversacion, citacion)
      },
      alPensamientoIniciado: () => {
        resumenPensamientoAcumulado = ""
        actualizarPensamientoUltimoMensaje(idConversacion, {
          estado: "pensando",
          resumen: "",
        })
      },
      alPensamientoDelta: (delta) => {
        resumenPensamientoAcumulado += delta
        actualizarPensamientoUltimoMensaje(idConversacion, {
          estado: "pensando",
          resumen: resumenPensamientoAcumulado,
        })
      },
      alPensamientoCompletado: () => {
        actualizarPensamientoUltimoMensaje(idConversacion, {
          estado: "completado",
          resumen: resumenPensamientoAcumulado,
        })
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
      // Si habia un ID temporal de RAG, transferir documentos a la conversacion real
      if (idRAGTemporal.current) {
        transferirDocumentos(idRAGTemporal.current, idConversacion)
        idRAGTemporal.current = null
      }
    }

    // Separar imagenes (para API) de documentos (ya indexados por RAG al adjuntar)
    let adjuntosParaAPI: Adjunto[] | undefined
    if (adjuntos && adjuntos.length > 0) {
      const soloImagenes = adjuntos.filter((a) => !debeUsarRAG(a))
      adjuntosParaAPI = soloImagenes.length > 0 ? soloImagenes : undefined
    }

    // Agregar mensaje del usuario al store (con adjuntos originales para mostrar en UI)
    agregarMensaje(idConversacion, { rol: "usuario", contenido, adjuntos })

    // Obtener contenido aumentado con contexto RAG si hay documentos indexados
    const contenidoConContexto = await obtenerContenidoConContextoRAG(idConversacion, contenido)

    const historialMensajes = [
      ...mensajesPrevios.map((m) => ({
        rol: m.rol,
        contenido: m.contenido,
      })),
      { rol: "usuario" as const, contenido: contenidoConContexto },
    ]

    await enviarConsultaAlModelo(
      idConversacion,
      historialMensajes,
      adjuntosParaAPI,
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

    // Obtener contenido aumentado con contexto RAG
    const contenidoConContexto = await obtenerContenidoConContextoRAG(conversacionActiva, nuevoContenido)

    // Construir historial hasta este mensaje con contenido editado
    const historialMensajes = conversacionActual.mensajes.slice(0, indiceMensaje).map((m) => ({
      rol: m.rol,
      contenido: m.contenido,
    }))
    historialMensajes.push({ rol: "usuario", contenido: contenidoConContexto })

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

    // Obtener contenido aumentado con contexto RAG
    const contenidoConContexto = await obtenerContenidoConContextoRAG(conversacionActiva, mensaje.contenido)

    // Construir historial hasta e incluyendo este mensaje
    const historialMensajes = conversacionActual.mensajes.slice(0, indiceMensaje).map((m) => ({
      rol: m.rol,
      contenido: m.contenido,
    }))
    historialMensajes.push({ rol: "usuario", contenido: contenidoConContexto })

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

    // Obtener contenido aumentado con contexto RAG
    const contenidoConContexto = await obtenerContenidoConContextoRAG(conversacionActiva, mensajeUsuario.contenido)

    // Construir historial hasta e incluyendo el mensaje del usuario
    const historialMensajes = conversacionActual.mensajes.slice(0, indiceUsuario).map((m) => ({
      rol: m.rol,
      contenido: m.contenido,
    }))
    historialMensajes.push({ rol: "usuario", contenido: contenidoConContexto })

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

  // Seleccionar conversacion y sincronizar estado RAG
  function manejarSeleccionarConversacion(id: string) {
    seleccionarConversacion(id)
    actualizarDocumentosRAGUI(id)
    idRAGTemporal.current = null
  }

  // Nueva conversacion y limpiar estado RAG
  function manejarNuevaConversacion() {
    iniciarNuevaConversacion()
    establecerDocumentosRAG([])
    idRAGTemporal.current = null
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--color-claude-bg)]">
      {/* Barra lateral */}
      <BarraLateral
        estaAbierta={estaBarraLateralAbierta}
        conversaciones={conversaciones}
        conversacionActiva={conversacionActiva}
        alAlternar={alternarBarraLateral}
        alNuevaConversacion={manejarNuevaConversacion}
        alSeleccionarConversacion={manejarSeleccionarConversacion}
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
            alRenombrarConversacion={renombrarConversacion}
            documentosRAG={documentosRAG}
            totalFragmentosRAG={estadisticasRAG.totalFragmentos}
            alProcesarAdjuntoRAG={manejarAdjuntoRAG}
            estaIndexandoRAG={estaIndexandoRAG}
            alEliminarDocumentoRAG={manejarEliminarDocumentoRAG}
          />
        ) : (
          <PantallaInicio
            estaBarraLateralAbierta={estaBarraLateralAbierta}
            modeloSeleccionado={modeloSeleccionado}
            alAlternarBarraLateral={alternarBarraLateral}
            alEnviar={manejarEnvio}
            alSeleccionarModelo={seleccionarModelo}
            documentosRAG={documentosRAG}
            totalFragmentosRAG={estadisticasRAG.totalFragmentos}
            alProcesarAdjuntoRAG={manejarAdjuntoRAG}
            estaIndexandoRAG={estaIndexandoRAG}
            alEliminarDocumentoRAG={manejarEliminarDocumentoRAG}
          />
        )}
      </main>
    </div>
  )
}
