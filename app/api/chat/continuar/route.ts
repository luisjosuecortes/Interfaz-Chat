import OpenAI from "openai"
import { NextResponse } from "next/server"
import { INSTRUCCIONES_SISTEMA } from "@/lib/constantes"
import { obtenerModelo } from "@/lib/modelos"

// Endpoint para enviar resultado de tool call y continuar la respuesta del modelo.
// El modelo invoca ejecutar_codigo → frontend ejecuta localmente → envia resultado aqui
// → el modelo recibe el output y continua generando texto.

interface CuerpoContinuacion {
  idRespuesta: string
  callId: string
  resultado: string
  modelo: string
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
    const { idRespuesta, callId, resultado, modelo } = (await solicitud.json()) as CuerpoContinuacion

    if (!idRespuesta || !callId) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: idRespuesta, callId" },
        { status: 400 }
      )
    }

    const modeloFinal = modelo || "gpt-4o-mini"
    const infoModelo = obtenerModelo(modeloFinal)
    const soportaReasoning = infoModelo?.tieneReasoning ?? false
    const maxTokensSalida = infoModelo?.maxTokensSalida ?? 16_384

    // Continuar la conversacion enviando el resultado del tool call
    const respuestaStream = await clienteOpenAI.responses.create({
      model: modeloFinal,
      instructions: INSTRUCCIONES_SISTEMA,
      previous_response_id: idRespuesta,
      input: [{
        type: "function_call_output",
        call_id: callId,
        output: resultado,
      }],
      stream: true,
      max_output_tokens: maxTokensSalida,
      tools: [
        {
          type: "web_search" as const,
          search_context_size: "medium" as const,
        },
        {
          type: "function" as const,
          name: "ejecutar_codigo",
          description: "Ejecuta codigo Python o JavaScript en el navegador del usuario y retorna la salida. Usa esto para verificar calculos, probar logica, analizar datos o generar resultados. El codigo se ejecuta localmente via Pyodide (Python) o iframe sandboxed (JavaScript). Timeout: 10 segundos.",
          parameters: {
            type: "object" as const,
            properties: {
              lenguaje: { type: "string" as const, enum: ["python", "javascript"], description: "Lenguaje del codigo a ejecutar" },
              codigo: { type: "string" as const, description: "El codigo fuente a ejecutar" },
            },
            required: ["lenguaje", "codigo"],
            additionalProperties: false,
          },
          strict: true,
        },
      ],
      ...(soportaReasoning && {
        reasoning: {
          effort: "medium" as const,
          summary: "concise" as const,
        },
      }),
    })

    const flujoLectura = new ReadableStream({
      async start(controlador) {
        const codificador = new TextEncoder()
        let idRespuestaNueva = ""

        function enviarEvento(datos: Record<string, unknown>) {
          controlador.enqueue(
            codificador.encode(`data: ${JSON.stringify(datos)}\n\n`)
          )
        }

        try {
          for await (const evento of respuestaStream) {
            // Capturar ID de respuesta nueva
            if (evento.type === "response.created") {
              const resp = (evento as unknown as Record<string, { id?: string }>).response
              if (resp?.id) idRespuestaNueva = resp.id
            }

            // Deltas de texto
            if (
              evento.type === "response.output_text.delta" &&
              "delta" in evento
            ) {
              const contenido = evento.delta as string
              if (contenido) {
                enviarEvento({ contenido })
              }
            }

            // Item de output completado: function_call con name, call_id, arguments
            // NOTA: response.function_call_arguments.done NO tiene name ni call_id,
            // solo arguments e item_id. Los campos completos estan en el item aqui.
            if (evento.type === "response.output_item.done") {
              const item = evento.item as unknown as Record<string, unknown>
              if (item.type === "function_call") {
                enviarEvento({
                  tipo: "tool_call",
                  nombre: item.name ?? "",
                  argumentos: item.arguments ?? "{}",
                  callId: item.call_id ?? "",
                  idRespuesta: idRespuestaNueva,
                })
                controlador.enqueue(codificador.encode("data: [FIN]\n\n"))
                controlador.close()
                return
              }
            }

            // Respuesta completada
            if (evento.type === "response.completed") {
              controlador.enqueue(codificador.encode("data: [FIN]\n\n"))
              controlador.close()
              return
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
    console.error("Error en la API de continuacion:", error)
    return NextResponse.json(
      { error: "Error al continuar la respuesta" },
      { status: 500 }
    )
  }
}
