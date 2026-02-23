import OpenAI from "openai"
import { NextResponse } from "next/server"

// Interfaz para adjuntos que llegan del cliente
interface AdjuntoEntrada {
  id: string
  tipo: "imagen" | "archivo"
  nombre: string
  contenido: string
  tipoMime: string
}

// Interfaz para los mensajes que llegan del cliente
interface MensajeEntrada {
  rol: "usuario" | "asistente"
  contenido: string
}

// Interfaz para el cuerpo de la solicitud
interface CuerpoSolicitud {
  mensajes: MensajeEntrada[]
  modelo: string
  adjuntos?: AdjuntoEntrada[]
}

// Mapeo de roles del español al formato de OpenAI
const MAPA_ROLES: Record<string, "user" | "assistant"> = {
  usuario: "user",
  asistente: "assistant",
}

// Tipo para el contenido multimodal de la Responses API
type ContenidoMultimodal = (
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "auto" | "low" | "high" }
  | { type: "input_file"; file_data: string; filename: string }
)

export async function POST(solicitud: Request) {
  const claveApi = process.env.OPENAI_API_KEY

  if (!claveApi) {
    return NextResponse.json(
      { error: "La clave de API de OpenAI no está configurada" },
      { status: 500 }
    )
  }

  const clienteOpenAI = new OpenAI({ apiKey: claveApi })

  try {
    const { mensajes, modelo, adjuntos } = (await solicitud.json()) as CuerpoSolicitud

    // Convertir mensajes al formato de la Responses API
    const entradaMensajes = mensajes.map((mensaje, indice) => {
      const rol = MAPA_ROLES[mensaje.rol] ?? ("user" as const)
      const esUltimoMensajeUsuario =
        indice === mensajes.length - 1 && mensaje.rol === "usuario"

      // Si es el último mensaje del usuario y hay adjuntos, usar formato multimodal
      if (esUltimoMensajeUsuario && adjuntos && adjuntos.length > 0) {
        const partes: ContenidoMultimodal[] = []

        // Agregar texto del mensaje
        if (mensaje.contenido) {
          partes.push({ type: "input_text", text: mensaje.contenido })
        }

        // Agregar adjuntos
        for (const adjunto of adjuntos) {
          if (adjunto.tipo === "imagen") {
            partes.push({
              type: "input_image",
              image_url: adjunto.contenido,
              detail: "auto",
            })
          } else {
            partes.push({
              type: "input_file",
              file_data: adjunto.contenido,
              filename: adjunto.nombre,
            })
          }
        }

        return { role: rol, content: partes }
      }

      return { role: rol, content: mensaje.contenido }
    })

    // Hacer la solicitud con streaming usando la Responses API
    const respuestaStream = await clienteOpenAI.responses.create({
      model: modelo || "gpt-4o-mini",
      input: entradaMensajes,
      stream: true,
      max_output_tokens: 4096,
    })

    // Crear un ReadableStream para enviar los chunks al cliente
    const flujoLectura = new ReadableStream({
      async start(controlador) {
        const codificador = new TextEncoder()

        try {
          for await (const evento of respuestaStream) {
            // Capturar los deltas de texto de la respuesta
            if (
              evento.type === "response.output_text.delta" &&
              "delta" in evento
            ) {
              const contenido = evento.delta as string
              if (contenido) {
                controlador.enqueue(
                  codificador.encode(`data: ${JSON.stringify({ contenido })}\n\n`)
                )
              }
            }

            // Cuando la respuesta se completa
            if (evento.type === "response.completed") {
              controlador.enqueue(codificador.encode("data: [FIN]\n\n"))
              controlador.close()
              return
            }
          }

          // Si el stream termina sin evento de completado
          controlador.enqueue(codificador.encode("data: [FIN]\n\n"))
          controlador.close()
        } catch (error) {
          controlador.error(error)
        }
      },
    })

    return new Response(flujoLectura, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("Error en la API de chat:", error)
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    )
  }
}
