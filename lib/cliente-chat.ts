// Cliente para la API de chat con streaming
import type { Adjunto, CitacionWeb, FuenteWeb } from "./tipos"

interface MensajeApi {
  rol: "usuario" | "asistente"
  contenido: string
}

interface OpcionesEnvio {
  mensajes: MensajeApi[]
  modelo: string
  adjuntos?: Adjunto[]
  senalAborto?: AbortSignal
  alActualizar: (textoActual: string) => void
  alFinalizar: () => void
  alError: (error: string) => void
  alBusquedaIniciada?: () => void
  alBusquedaBuscando?: () => void
  alBusquedaResultado?: (consultas: string[], fuentes: FuenteWeb[]) => void
  alCitacion?: (citacion: CitacionWeb) => void
  alPensamientoIniciado?: () => void
  alPensamientoDelta?: (delta: string) => void
  alPensamientoCompletado?: () => void
}

export async function enviarMensajeConStreaming({
  mensajes,
  modelo,
  adjuntos,
  senalAborto,
  alActualizar,
  alFinalizar,
  alError,
  alBusquedaIniciada,
  alBusquedaBuscando,
  alBusquedaResultado,
  alCitacion,
  alPensamientoIniciado,
  alPensamientoDelta,
  alPensamientoCompletado,
}: OpcionesEnvio): Promise<void> {
  try {
    const respuesta = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensajes, modelo, adjuntos }),
      signal: senalAborto,
    })

    if (!respuesta.ok) {
      const datosError = await respuesta.json()
      alError(datosError.error || "Error al conectar con el servidor")
      alFinalizar()
      return
    }

    const lector = respuesta.body?.getReader()
    if (!lector) {
      alError("No se pudo leer la respuesta del servidor")
      alFinalizar()
      return
    }

    const decodificador = new TextDecoder()
    let textoAcumulado = ""
    let bufferIncompleto = ""

    while (true) {
      const { done, value } = await lector.read()
      if (done) break

      bufferIncompleto += decodificador.decode(value, { stream: true })
      const lineas = bufferIncompleto.split("\n")

      // Conservar la ultima linea potencialmente incompleta en el buffer
      bufferIncompleto = lineas.pop() || ""

      for (const linea of lineas) {
        if (linea.startsWith("data: ")) {
          const datos = linea.slice(6).trim()

          if (datos === "[FIN]") {
            alFinalizar()
            return
          }

          try {
            const parseado = JSON.parse(datos)

            // Evento de contenido de texto (flujo principal)
            if (parseado.contenido) {
              textoAcumulado += parseado.contenido
              alActualizar(textoAcumulado)
              continue
            }

            // Eventos tipados
            switch (parseado.tipo) {
              // Búsqueda web
              case "busqueda_iniciada":
                alBusquedaIniciada?.()
                break
              case "busqueda_buscando":
                alBusquedaBuscando?.()
                break
              case "busqueda_resultado":
                alBusquedaResultado?.(
                  parseado.consultas ?? [],
                  parseado.fuentes ?? []
                )
                break
              case "busqueda_completada":
                break
              case "citacion":
                if (parseado.citacion) {
                  alCitacion?.(parseado.citacion as CitacionWeb)
                }
                break

              // Pensamiento/Reasoning
              case "pensamiento_iniciado":
                alPensamientoIniciado?.()
                break
              case "pensamiento_delta":
                if (parseado.delta) {
                  alPensamientoDelta?.(parseado.delta as string)
                }
                break
              case "pensamiento_completado":
                alPensamientoCompletado?.()
                break
            }
          } catch {
            // Ignorar lineas que no son JSON valido
          }
        }
      }
    }

    alFinalizar()
  } catch (error) {
    // Si fue cancelacion intencional, no mostrar error
    if (error instanceof DOMException && error.name === "AbortError") {
      alFinalizar()
      return
    }
    alError("Error de conexion. Verifica tu conexion a internet.")
    alFinalizar()
  }
}
