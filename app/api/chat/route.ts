import OpenAI from "openai"
import { NextResponse } from "next/server"

// Interfaz para los mensajes que llegan del cliente
interface MensajeEntrada {
  rol: "usuario" | "asistente"
  contenido: string
}

// Mapeo de roles del español al formato de OpenAI
const MAPA_ROLES: Record<string, "user" | "assistant" | "system"> = {
  usuario: "user",
  asistente: "assistant",
}

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
    const { mensajes } = (await solicitud.json()) as { mensajes: MensajeEntrada[] }

    // Convertir mensajes al formato de OpenAI
    const mensajesFormateados = mensajes.map((mensaje) => ({
      role: MAPA_ROLES[mensaje.rol] ?? "user",
      content: mensaje.contenido,
    }))

    // Agregar mensaje de sistema
    const mensajesConSistema = [
      {
        role: "system" as const,
        content:
          "Eres ChatSLM, un asistente de inteligencia artificial amable, útil y preciso creado por el laboratorio LABSEMCO. Responde siempre en español de forma clara y concisa. Usa formato markdown cuando sea útil para estructurar tus respuestas.",
      },
      ...mensajesFormateados,
    ]

    // Hacer la solicitud con streaming
    const respuestaStream = await clienteOpenAI.chat.completions.create({
      model: "gpt-4o-mini",
      messages: mensajesConSistema,
      stream: true,
      temperature: 0.7,
      max_tokens: 4096,
    })

    // Crear un ReadableStream para enviar los chunks
    const flujoLectura = new ReadableStream({
      async start(controlador) {
        const codificador = new TextEncoder()

        try {
          for await (const fragmento of respuestaStream) {
            const contenido = fragmento.choices[0]?.delta?.content
            if (contenido) {
              controlador.enqueue(codificador.encode(`data: ${JSON.stringify({ contenido })}\n\n`))
            }
          }
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
