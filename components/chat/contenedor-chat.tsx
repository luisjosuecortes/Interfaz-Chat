"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useAlmacenChat, obtenerModeloSeleccionado } from "@/lib/almacen-chat"
import { BarraLateral } from "@/components/chat/barra-lateral"
import { AreaChat } from "@/components/chat/area-chat"
import { PantallaInicio } from "@/components/chat/pantalla-inicio"
import { PanelArtefacto } from "@/components/chat/panel-artefacto"
import { useArtefacto } from "@/lib/contexto-artefacto"
import { enviarMensajeConStreaming, enviarContinuacionConStreaming } from "@/lib/cliente-chat"
import type { Adjunto, DocumentoRAGUI } from "@/lib/tipos"
import { generarId, cn } from "@/lib/utils"
import { precargarPyodide, detenerEjecucionActiva } from "@/lib/ejecutor-codigo"
import { countTokens } from "gpt-tokenizer/model/gpt-4o"
import { obtenerModelo } from "@/lib/modelos"
import { INSTRUCCIONES_SISTEMA } from "@/lib/constantes"
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
  limpiarDatosConversacion,
} from "@/lib/rag/almacen-vectores"

// Intervalo minimo entre actualizaciones de UI durante streaming (ms).
// 50ms = 20fps de actualizaciones de texto: suficiente para streaming fluido,
// menor carga de renderizado que 30ms (33fps), especialmente con conversaciones largas.
const INTERVALO_THROTTLE = 50

// Margen de seguridad para evitar cortar exacto en el limite del modelo.
// Cubre: overhead per-message (~3 tokens/msg), tokens de herramientas (web_search), etc.
const MARGEN_SEGURIDAD_TOKENS = 512

// Cache de conteo de tokens por contenido de mensaje (evita recontar en cada envio)
const cacheConteoTokens = new Map<string, number>()
const TAMANO_MAX_CACHE = 500

// Cache del conteo de tokens del system prompt (es estatico, se cuenta una sola vez)
let tokensSystemPromptCache: number | null = null

function contarTokensMensaje(contenido: string): number {
  let tokens = cacheConteoTokens.get(contenido)
  if (tokens === undefined) {
    tokens = countTokens(contenido, { allowedSpecial: 'all' })
    if (cacheConteoTokens.size >= TAMANO_MAX_CACHE) {
      const primeraLlave = cacheConteoTokens.keys().next().value
      if (primeraLlave !== undefined) cacheConteoTokens.delete(primeraLlave)
    }
    cacheConteoTokens.set(contenido, tokens)
  }
  return tokens
}

/** Calcula el presupuesto de tokens disponible para el historial de mensajes.
 *  Formula: ventanaContexto - maxTokensSalida - tokensSystemPrompt - tokensRAG - margen
 *  Esto previene colision entre historial, contexto RAG, system prompt y respuesta. */
function calcularPresupuestoHistorial(idModelo: string, tokensRAG: number): number {
  const modelo = obtenerModelo(idModelo)
  const ventana = modelo?.ventanaContexto ?? 128_000
  const maxSalida = modelo?.maxTokensSalida ?? 16_384
  if (tokensSystemPromptCache === null) {
    tokensSystemPromptCache = contarTokensMensaje(INSTRUCCIONES_SISTEMA)
  }
  return ventana - maxSalida - tokensSystemPromptCache - tokensRAG - MARGEN_SEGURIDAD_TOKENS
}

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
  const { artefactoActivo, cerrarArtefacto, abrirYEjecutarArtefacto } = useArtefacto()

  // --- Precarga de dependencias pesadas ---
  useEffect(() => {
    // Retrasar 2 segundos para no afectar el renderizado inicial y el Time To Interactive
    const temporizador = setTimeout(() => {
      precargarPyodide()
    }, 2000)
    return () => clearTimeout(temporizador)
  }, [])

  // --- Resize horizontal del panel de artefactos ---
  const [anchoPanelPx, establecerAnchoPanelPx] = useState<number | null>(null)
  const estaDragPanelRef = useRef(false)
  const xInicialPanelRef = useRef(0)
  const anchoInicialPanelRef = useRef(0)
  const mainRef = useRef<HTMLElement>(null)

  /** Inicia el drag para redimensionar el ancho del panel de artefactos */
  const iniciarDragPanel = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    estaDragPanelRef.current = true
    xInicialPanelRef.current = e.clientX
    // Capturar el ancho actual del panel wrapper
    const panelEl = (e.currentTarget as HTMLElement).parentElement
    anchoInicialPanelRef.current = panelEl?.offsetWidth ?? 600

    const moverDrag = (ev: MouseEvent) => {
      if (!estaDragPanelRef.current) return
      // Mover hacia la izquierda = panel más ancho (delta negativo en X)
      const delta = xInicialPanelRef.current - ev.clientX
      const anchoMain = mainRef.current?.offsetWidth ?? window.innerWidth
      const maxAncho = Math.floor(anchoMain * 0.50) // max 50% del area principal
      const nuevoAncho = Math.max(350, Math.min(maxAncho, anchoInicialPanelRef.current + delta))
      establecerAnchoPanelPx(nuevoAncho)
    }

    const finDrag = () => {
      estaDragPanelRef.current = false
      document.removeEventListener("mousemove", moverDrag)
      document.removeEventListener("mouseup", finDrag)
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
    }

    document.body.style.userSelect = "none"
    document.body.style.cursor = "ew-resize"
    document.addEventListener("mousemove", moverDrag)
    document.addEventListener("mouseup", finDrag)
  }, [])

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

  // Detener generacion en curso (y ejecucion de codigo si hay un tool call activo)
  function detenerGeneracion() {
    referenciaControlador.current?.abort()
    referenciaControlador.current = null
    detenerEjecucionActiva()
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
  // idsDocumentosRecientes: IDs de documentos adjuntados en el mensaje actual (boost de priorizacion)
  async function obtenerContenidoConContextoRAG(
    idConversacion: string,
    contenidoOriginal: string,
    idsDocumentosRecientes?: Set<string>
  ): Promise<string> {
    if (!tieneFragmentosListos(idConversacion)) return contenidoOriginal

    const resultados = await buscarContextoRelevante(idConversacion, contenidoOriginal, 10, idsDocumentosRecientes)
    if (resultados.length === 0) return contenidoOriginal

    const contexto = construirContextoParaPrompt(resultados)
    return contexto + contenidoOriginal
  }

  // Truncar historial para conversaciones largas que exceden el contexto del modelo.
  // Usa conteo real de tokens (gpt-tokenizer) y recorta pares completos (usuario+asistente).
  // El presupuesto es dinamico: calculado descontando system prompt, RAG, y max_output_tokens.
  function truncarHistorial(
    mensajes: Array<{ rol: "usuario" | "asistente"; contenido: string }>,
    presupuesto: number
  ): Array<{ rol: "usuario" | "asistente"; contenido: string }> {
    let totalTokens = mensajes.reduce((acc, m) => acc + contarTokensMensaje(m.contenido), 0)
    if (totalTokens <= presupuesto) return mensajes

    // Recortar pares completos (usuario+asistente) desde el inicio
    // para evitar mensajes huerfanos
    let inicio = 0
    while (totalTokens > presupuesto && inicio < mensajes.length - 4) {
      totalTokens -= contarTokensMensaje(mensajes[inicio].contenido)
      inicio++
      // Si acabamos de quitar un mensaje de usuario, quitar tambien la respuesta del asistente
      if (inicio < mensajes.length - 4 &&
        mensajes[inicio - 1].rol === "usuario" &&
        mensajes[inicio]?.rol === "asistente") {
        totalTokens -= contarTokensMensaje(mensajes[inicio].contenido)
        inicio++
      }
    }

    // Asegurar que no empezamos con una respuesta huerfana
    if (inicio > 0 && inicio < mensajes.length && mensajes[inicio].rol === "asistente") {
      inicio++
    }

    return mensajes.slice(inicio)
  }

  // Helper compartido para enviar mensajes al modelo con streaming.
  // Recibe el historial YA con contexto RAG inyectado en el ultimo mensaje.
  // Calcula presupuesto dinamico considerando tokens RAG y trunca si es necesario.
  // Soporta tool calls: si el modelo invoca ejecutar_codigo, ejecuta localmente y continua.
  async function enviarConsultaAlModelo(
    idConversacion: string,
    historialMensajes: Array<{ rol: "usuario" | "asistente"; contenido: string }>,
    adjuntos?: Adjunto[],
    debeGenerarTitulo?: boolean,
    contenidoParaTitulo?: string,
    tokensContextoRAG?: number
  ) {
    establecerMensajeError(null)

    // Presupuesto dinamico: descontar system prompt, RAG, max_output y margen
    const idModelo = obtenerModeloSeleccionado()
    const presupuesto = calcularPresupuestoHistorial(idModelo, tokensContextoRAG ?? 0)
    const historialFinal = truncarHistorial(historialMensajes, presupuesto)

    const controlador = new AbortController()
    referenciaControlador.current = controlador

    // Throttle para limitar re-renders durante streaming
    let ultimaActualizacionUI = 0
    let textoRespuestaFinal = ""
    let resumenPensamientoAcumulado = ""

    /** Maneja un tool call del modelo: ejecuta codigo localmente y continua el streaming.
     *  Soporta encadenamiento: si el modelo hace otro tool call tras recibir el resultado,
     *  se ejecuta recursivamente hasta que el modelo termine de generar texto.
     *  Gestiona el ciclo de vida completo: typing indicator, texto final y titulo.
     *  Limite de profundidad para evitar loops infinitos de tool calls encadenados. */
    const MAX_TOOL_CALLS_ENCADENADOS = 5

    async function manejarToolCall(nombre: string, argumentos: string, callId: string, idRespuesta: string, profundidad: number = 0) {
      if (nombre !== "ejecutar_codigo") {
        establecerEscribiendo(false)
        referenciaControlador.current = null
        return
      }

      // Limite de recursion para evitar loops infinitos
      if (profundidad >= MAX_TOOL_CALLS_ENCADENADOS) {
        textoRespuestaFinal += "\n\n*Se alcanzo el limite de ejecuciones encadenadas.*\n\n"
        actualizarUltimoMensaje(idConversacion, textoRespuestaFinal)
        establecerEscribiendo(false)
        referenciaControlador.current = null
        return
      }

      // Indicador insertado: sirve para saber si el catch debe usar replace o append
      let indicadorInsertado = false

      try {
        const args = JSON.parse(argumentos) as { lenguaje: string; codigo: string }
        const esPython = args.lenguaje === "python" || args.lenguaje === "py"

        // 1. Indicador temporal en el chat (code fence con pseudo-lenguaje para UI premium)
        textoRespuestaFinal += `\n\n\`\`\`ejecutando:${args.lenguaje}\n\`\`\`\n\n`
        actualizarUltimoMensaje(idConversacion, textoRespuestaFinal)
        indicadorInsertado = true

        // 2. Abrir panel de artefactos + ejecutar (operacion atomica)
        const artefacto = {
          id: `ejecucion-${Date.now()}`,
          tipo: "codigo" as const,
          titulo: esPython ? "Python" : "JavaScript",
          contenido: args.codigo,
          lenguaje: args.lenguaje,
          totalLineas: args.codigo.split("\n").length,
        }
        const resultado = await abrirYEjecutarArtefacto(artefacto)

        // 3. Verificar si el usuario cancelo durante la ejecucion
        if (controlador.signal.aborted) {
          cerrarArtefacto()
          establecerEscribiendo(false)
          referenciaControlador.current = null
          return
        }

        // 4. Formatear resultado
        const salidasTexto = resultado?.salidas
          .map((s) => s.tipo === "error" ? `Error: ${s.contenido}` : s.contenido)
          .join("\n") ?? ""
        const textoResultado = resultado?.exito
          ? (salidasTexto || "(sin salida)")
          : `Error de ejecucion:\n${salidasTexto}`
        const estadoEjecucionTexto = resultado?.exito ? "exito" : "error"

        // 5. Reemplazar indicador temporal con: tarjeta ejecutada + resultado
        const marcador = esPython ? "# @ejecutado-por-modelo" : "// @ejecutado-por-modelo"
        const salidasJSON = JSON.stringify(resultado?.salidas ?? [])
        const duracion = Math.round(resultado?.duracionMs ?? 0)
        const bloqueCodigo = `\`\`\`${args.lenguaje}\n${marcador} ${estadoEjecucionTexto} ${duracion} ${salidasJSON}\n${args.codigo}\n\`\`\``
        // Resultados cortos (1-3 lineas) como inline markdown para que formulas/formato se rendericen.
        // Resultados largos (4+ lineas) en code fence para legibilidad. Errores siempre en code fence.
        const esMultilinea = salidasTexto.includes("\n") && salidasTexto.split("\n").length > 3
        const bloqueResultado = resultado?.exito
          ? esMultilinea
            ? `**Resultado:**\n\`\`\`\n${salidasTexto}\n\`\`\``
            : `**Resultado:** ${salidasTexto || "(sin salida)"}`
          : `**Error de ejecucion:**\n\`\`\`\n${salidasTexto}\n\`\`\``
        textoRespuestaFinal = textoRespuestaFinal.replace(
          /```ejecutando:[^\n]*\n```\n\n/,
          `${bloqueCodigo}\n\n${bloqueResultado}\n\n`
        )
        actualizarUltimoMensaje(idConversacion, textoRespuestaFinal)

        // 6. Cerrar panel despues de un breve delay (para que el usuario vea el resultado)
        await new Promise(r => setTimeout(r, 800))
        cerrarArtefacto()

        // 7. Continuar streaming con el resultado del tool call
        let ultimoTextoContinuacion = ""

        await enviarContinuacionConStreaming({
          idRespuesta,
          callId,
          resultado: textoResultado,
          modelo: obtenerModeloSeleccionado(),
          senalAborto: controlador.signal,
          alActualizar: (textoContinuacion) => {
            ultimoTextoContinuacion = textoContinuacion
            const textoTotal = textoRespuestaFinal + textoContinuacion
            const ahora = Date.now()
            if (ahora - ultimaActualizacionUI >= INTERVALO_THROTTLE) {
              actualizarUltimoMensaje(idConversacion, textoTotal)
              ultimaActualizacionUI = ahora
            }
          },
          alFinalizar: () => {
            textoRespuestaFinal += ultimoTextoContinuacion
            actualizarUltimoMensaje(idConversacion, textoRespuestaFinal)
            establecerEscribiendo(false)
            referenciaControlador.current = null

            if (debeGenerarTitulo && contenidoParaTitulo) {
              generarTituloConversacion(idConversacion, contenidoParaTitulo, textoRespuestaFinal)
            }
          },
          alError: (error) => {
            if (textoRespuestaFinal) actualizarUltimoMensaje(idConversacion, textoRespuestaFinal)
            establecerMensajeError(error)
            establecerEscribiendo(false)
            referenciaControlador.current = null
          },
          alToolCall: (n, a, c, r) => {
            textoRespuestaFinal += ultimoTextoContinuacion
            ultimoTextoContinuacion = ""
            return manejarToolCall(n, a, c, r, profundidad + 1)
          },
        })
      } catch (errorToolCall) {
        cerrarArtefacto()
        const msgError = errorToolCall instanceof Error ? errorToolCall.message : "Error desconocido"
        if (indicadorInsertado) {
          // Reemplazar indicador temporal con el error
          textoRespuestaFinal = textoRespuestaFinal.replace(
            /```ejecutando:[^\n]*\n```\n\n/,
            `**Error al ejecutar codigo:** ${msgError}\n\n`
          )
        } else {
          // Error antes de insertar indicador (ej: JSON.parse fallo): agregar al final
          textoRespuestaFinal += `\n\n**Error al ejecutar codigo:** ${msgError}\n\n`
        }
        actualizarUltimoMensaje(idConversacion, textoRespuestaFinal)
        establecerEscribiendo(false)
        referenciaControlador.current = null
      }
    }

    await enviarMensajeConStreaming({
      mensajes: historialFinal,
      modelo: obtenerModeloSeleccionado(),
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
      alToolCall: (n, a, c, r) => manejarToolCall(n, a, c, r, 0),
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

    // Recoger IDs de documentos RAG adjuntados en este mensaje (para boost de priorizacion)
    let idsDocumentosRecientes: Set<string> | undefined
    if (adjuntos && adjuntos.length > 0) {
      const idsRecientes = documentosRAG
        .filter((d) => d.adjuntoId && adjuntos.some((a) => a.id === d.adjuntoId) && d.estado === "listo")
        .map((d) => d.id)
      if (idsRecientes.length > 0) {
        idsDocumentosRecientes = new Set(idsRecientes)
      }
    }

    // Patron ChatGPT/Claude: reservar espacio del asistente ANTES del await RAG
    // El usuario ve ambas burbujas al instante, sin ventana de "nada pasa"
    establecerEscribiendo(true)
    agregarMensaje(idConversacion, { rol: "asistente", contenido: "", modelo: obtenerModeloSeleccionado() })

    // Obtener contenido aumentado con contexto RAG si hay documentos indexados
    const contenidoConContexto = await obtenerContenidoConContextoRAG(idConversacion, contenido, idsDocumentosRecientes)

    // Contar tokens del contexto RAG para presupuesto dinamico
    const tokensRAG = contenidoConContexto !== contenido
      ? contarTokensMensaje(contenidoConContexto) - contarTokensMensaje(contenido)
      : 0

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
      contenido,
      tokensRAG
    )
  }

  // Editar un mensaje del usuario y reenviar
  async function manejarEdicionMensaje(idMensaje: string, nuevoContenido: string) {
    if (!conversacionActiva || !conversacionActual) return
    if (estaEscribiendo) return

    const indiceMensaje = conversacionActual.mensajes.findIndex((m) => m.id === idMensaje)
    if (indiceMensaje === -1) return

    const mensajeOriginal = conversacionActual.mensajes[indiceMensaje]

    // Construir historial base sincrono (sin RAG aun, para tener el array listo)
    const historialBase = conversacionActual.mensajes.slice(0, indiceMensaje).map((m) => ({
      rol: m.rol,
      contenido: m.contenido,
    }))

    // Actualizar store: cambiar contenido y eliminar mensajes posteriores
    editarYRecortarMensajes(conversacionActiva, idMensaje, nuevoContenido)

    // Patron ChatGPT/Claude: reservar espacio del asistente ANTES del await RAG
    establecerEscribiendo(true)
    agregarMensaje(conversacionActiva, { rol: "asistente", contenido: "", modelo: obtenerModeloSeleccionado() })

    // Obtener contenido aumentado con contexto RAG (ahora con el indicador ya visible)
    const contenidoConContexto = await obtenerContenidoConContextoRAG(conversacionActiva, nuevoContenido)

    // Contar tokens del contexto RAG para presupuesto dinamico
    const tokensRAG = contenidoConContexto !== nuevoContenido
      ? contarTokensMensaje(contenidoConContexto) - contarTokensMensaje(nuevoContenido)
      : 0

    // Completar historial con el contenido aumentado
    const historialMensajes = [...historialBase, { rol: "usuario" as const, contenido: contenidoConContexto }]

    const esPrimerMensaje = indiceMensaje === 0

    await enviarConsultaAlModelo(
      conversacionActiva,
      historialMensajes,
      mensajeOriginal.adjuntos,
      esPrimerMensaje,
      nuevoContenido,
      tokensRAG
    )
  }

  // Reenviar un mensaje del usuario (mismo contenido, nueva respuesta)
  async function manejarReenvioMensaje(idMensaje: string) {
    if (!conversacionActiva || !conversacionActual) return
    if (estaEscribiendo) return

    const indiceMensaje = conversacionActual.mensajes.findIndex((m) => m.id === idMensaje)
    if (indiceMensaje === -1) return

    const mensaje = conversacionActual.mensajes[indiceMensaje]

    // Construir historial base sincrono (sin RAG aun)
    const historialBase = conversacionActual.mensajes.slice(0, indiceMensaje).map((m) => ({
      rol: m.rol,
      contenido: m.contenido,
    }))

    // Eliminar todo despues de este mensaje
    recortarMensajesDesde(conversacionActiva, indiceMensaje + 1)

    // Patron ChatGPT/Claude: reservar espacio del asistente ANTES del await RAG
    establecerEscribiendo(true)
    agregarMensaje(conversacionActiva, { rol: "asistente", contenido: "", modelo: obtenerModeloSeleccionado() })

    // Obtener contenido aumentado con contexto RAG (con indicador ya visible)
    const contenidoConContexto = await obtenerContenidoConContextoRAG(conversacionActiva, mensaje.contenido)

    // Contar tokens del contexto RAG para presupuesto dinamico
    const tokensRAG = contenidoConContexto !== mensaje.contenido
      ? contarTokensMensaje(contenidoConContexto) - contarTokensMensaje(mensaje.contenido)
      : 0

    const historialMensajes = [...historialBase, { rol: "usuario" as const, contenido: contenidoConContexto }]
    const esPrimerMensaje = indiceMensaje === 0

    await enviarConsultaAlModelo(
      conversacionActiva,
      historialMensajes,
      mensaje.adjuntos,
      esPrimerMensaje,
      mensaje.contenido,
      tokensRAG
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

    // Construir historial base sincrono (sin RAG aun)
    const historialBase = conversacionActual.mensajes.slice(0, indiceUsuario).map((m) => ({
      rol: m.rol,
      contenido: m.contenido,
    }))

    // Eliminar desde la respuesta del asistente en adelante
    recortarMensajesDesde(conversacionActiva, indiceMensaje)

    // Patron ChatGPT/Claude: reservar espacio del asistente ANTES del await RAG
    establecerEscribiendo(true)
    agregarMensaje(conversacionActiva, { rol: "asistente", contenido: "", modelo: obtenerModeloSeleccionado() })

    // Obtener contenido aumentado con contexto RAG (con indicador ya visible)
    const contenidoConContexto = await obtenerContenidoConContextoRAG(conversacionActiva, mensajeUsuario.contenido)

    // Contar tokens del contexto RAG para presupuesto dinamico
    const tokensRAG = contenidoConContexto !== mensajeUsuario.contenido
      ? contarTokensMensaje(contenidoConContexto) - contarTokensMensaje(mensajeUsuario.contenido)
      : 0

    const historialMensajes = [...historialBase, { rol: "usuario" as const, contenido: contenidoConContexto }]
    const esPrimerMensaje = indiceUsuario === 0

    await enviarConsultaAlModelo(
      conversacionActiva,
      historialMensajes,
      mensajeUsuario.adjuntos,
      esPrimerMensaje,
      mensajeUsuario.contenido,
      tokensRAG
    )
  }

  // Seleccionar conversacion y sincronizar estado RAG
  function manejarSeleccionarConversacion(id: string) {
    seleccionarConversacion(id)
    actualizarDocumentosRAGUI(id)
    idRAGTemporal.current = null
    cerrarArtefacto()
  }

  // Nueva conversacion y limpiar estado RAG
  function manejarNuevaConversacion() {
    iniciarNuevaConversacion()
    establecerDocumentosRAG([])
    idRAGTemporal.current = null
    cerrarArtefacto()
  }

  function manejarEliminarConversacion(id: string) {
    limpiarDatosConversacion(id)
    eliminarConversacion(id)
  }

  // === Drag-and-drop global (desde carpetas externas a cualquier parte de la pagina) ===
  const [estaArrastrandoGlobal, establecerEstaArrastrandoGlobal] = useState(false)
  const [archivosDropeados, establecerArchivosDropeados] = useState<File[] | null>(null)

  function manejarDragOverGlobal(evento: React.DragEvent) {
    evento.preventDefault()
    // Solo activar si hay archivos (no texto u otros tipos de drag)
    if (evento.dataTransfer?.types.includes("Files")) {
      establecerEstaArrastrandoGlobal(true)
    }
  }

  function manejarDragLeaveGlobal(evento: React.DragEvent) {
    // Solo desactivar si se salio del contenedor raiz (no de un hijo)
    if (!evento.currentTarget.contains(evento.relatedTarget as Node)) {
      establecerEstaArrastrandoGlobal(false)
    }
  }

  function manejarDropGlobal(evento: React.DragEvent) {
    evento.preventDefault()
    establecerEstaArrastrandoGlobal(false)
    const archivos = evento.dataTransfer?.files
    if (archivos && archivos.length > 0) {
      establecerArchivosDropeados(Array.from(archivos))
    }
  }

  const limpiarArchivosDropeados = useCallback(() => {
    establecerArchivosDropeados(null)
  }, [])

  return (
    <div
      className="flex h-screen w-full overflow-hidden bg-[var(--color-claude-bg)]"
      onDragOver={manejarDragOverGlobal}
      onDragLeave={manejarDragLeaveGlobal}
      onDrop={manejarDropGlobal}
    >
      {/* Overlay visual de drag-and-drop global */}
      {estaArrastrandoGlobal && (
        <div className="fixed inset-0 z-50 border-2 border-dashed border-[var(--color-claude-acento)] bg-[var(--color-claude-acento)]/5 pointer-events-none rounded-lg m-2" />
      )}

      {/* Barra lateral */}
      <BarraLateral
        estaAbierta={estaBarraLateralAbierta}
        conversaciones={conversaciones}
        conversacionActiva={conversacionActiva}
        alAlternar={alternarBarraLateral}
        alNuevaConversacion={manejarNuevaConversacion}
        alSeleccionarConversacion={manejarSeleccionarConversacion}
        alEliminarConversacion={manejarEliminarConversacion}
        alRenombrarConversacion={renombrarConversacion}
      />

      {/* Area principal: chat + panel artefacto */}
      <main ref={mainRef} className="flex flex-1 min-w-0">
        {/* Chat: se oculta en mobile cuando hay artefacto abierto */}
        <div className={cn(
          "flex flex-col min-w-0 transition-all duration-300",
          artefactoActivo ? "hidden lg:flex lg:flex-1" : "flex-1"
        )}>
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
              archivosExternos={archivosDropeados}
              alLimpiarArchivosExternos={limpiarArchivosDropeados}
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
              archivosExternos={archivosDropeados}
              alLimpiarArchivosExternos={limpiarArchivosDropeados}
            />
          )}
        </div>

        {/* Panel artefacto: redimensionable horizontalmente en desktop, 100% en mobile */}
        {artefactoActivo && (
          <div
            className={cn("shrink-0 h-full relative flex", !anchoPanelPx && "w-full lg:w-[45%] lg:max-w-[700px]")}
            style={anchoPanelPx ? { width: `${anchoPanelPx}px` } : undefined}
          >
            {/* Handle de drag horizontal — overlay interno en borde izquierdo, solo lg+ */}
            <div
              onMouseDown={iniciarDragPanel}
              className="hidden lg:block absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-[var(--color-claude-input-border)] transition-colors z-10"
              title="Arrastra para redimensionar"
            />
            <div className="flex-1 min-w-0 h-full">
              <PanelArtefacto />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
