import OpenAI from "openai"
import { NextResponse } from "next/server"

interface CuerpoSolicitudTitulo {
  mensajeUsuario: string
  respuestaAsistente: string
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
    const { mensajeUsuario, respuestaAsistente } =
      (await solicitud.json()) as CuerpoSolicitudTitulo

    const respuesta = await clienteOpenAI.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: `Genera un titulo corto (maximo 6 palabras) para esta conversacion. Solo responde con el titulo, sin comillas ni puntuacion final.\n\nUsuario: ${mensajeUsuario.substring(0, 500)}\nAsistente: ${respuestaAsistente.substring(0, 500)}`,
        },
      ],
      max_output_tokens: 30,
    })

    const titulo =
      respuesta.output_text?.trim() ||
      mensajeUsuario.substring(0, 40)

    return NextResponse.json({ titulo })
  } catch (error) {
    console.error("Error al generar titulo:", error)
    return NextResponse.json(
      { error: "Error al generar el titulo" },
      { status: 500 }
    )
  }
}
