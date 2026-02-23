// Cliente para la API de chat con streaming
import type { Adjunto } from "./tipos"

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
}

export async function enviarMensajeConStreaming({
  mensajes,
  modelo,
  adjuntos,
  senalAborto,
  alActualizar,
  alFinalizar,
  alError,
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

    while (true) {
      const { done, value } = await lector.read()
      if (done) break

      const fragmento = decodificador.decode(value, { stream: true })
      const lineas = fragmento.split("\n")

      for (const linea of lineas) {
        if (linea.startsWith("data: ")) {
          const datos = linea.slice(6).trim()

          if (datos === "[FIN]") {
            alFinalizar()
            return
          }

          try {
            const parseado = JSON.parse(datos)
            if (parseado.contenido) {
              textoAcumulado += parseado.contenido
              alActualizar(textoAcumulado)
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
