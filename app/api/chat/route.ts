import OpenAI from "openai"
import { NextResponse } from "next/server"
import { obtenerModelo } from "@/lib/modelos"

// TODO: Cuando se añadan más proveedores (Anthropic, Google, etc.),
// usar obtenerProveedorDeModelo() para enrutar al cliente correcto.

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

// Instrucciones del sistema para formateo consistente y respuestas bien estructuradas
const INSTRUCCIONES_SISTEMA = [
  // Formato matematico
  "MATH FORMATTING:",
  "- Always use LaTeX delimiters for ALL mathematical expressions.",
  "- Inline math: $...$ (e.g., $h_t = \\sigma(W_x x_t + W_h h_{t-1} + b)$)",
  "- Display math: $$...$$ on its OWN line for important/key equations.",
  "- Wrap ALL subscripts/superscripts in LaTeX: $h_t$, $x^2$, $W_{in}$, $C_{out}$, $W^{(l)}$",
  "- Use LaTeX commands inside delimiters: $\\to$ not →, $\\times$ not ×, $\\sigma$ not σ",
  "- Never leave math undelimited: no bare h_t, W^{(l)}, C_out, x^2 outside of $",
  "",
  // Estructura de respuesta
  "RESPONSE STRUCTURE:",
  "- When using numbered lists (1. 2. 3.), put the topic title in **bold**, then leave a blank line before the explanation text.",
  "- Separate sections clearly with blank lines for visual breathing room.",
  "- Use display math ($$...$$) centered on its own line for key formulas, definitions, and important results.",
  "- Keep inline math ($...$) for variables and short expressions within sentences.",
  "- Use headers (##, ###) for major sections in long answers.",
].join("\n")

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

    const modeloFinal = modelo || "gpt-4o-mini"

    // Convertir mensajes al formato de la Responses API
    const entradaMensajes = mensajes.map((mensaje, indice) => {
      const rol = MAPA_ROLES[mensaje.rol] ?? ("user" as const)
      const esUltimoMensajeUsuario =
        indice === mensajes.length - 1 && mensaje.rol === "usuario"

      // Si es el último mensaje del usuario y hay adjuntos, usar formato multimodal
      if (esUltimoMensajeUsuario && adjuntos && adjuntos.length > 0) {
        const partes: ContenidoMultimodal[] = []

        if (mensaje.contenido) {
          partes.push({ type: "input_text", text: mensaje.contenido })
        }

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

    // Configurar reasoning para modelos que lo soportan
    const soportaReasoning = obtenerModelo(modeloFinal)?.tieneReasoning ?? false

    const respuestaStream = await clienteOpenAI.responses.create({
      model: modeloFinal,
      instructions: INSTRUCCIONES_SISTEMA,
      input: entradaMensajes,
      stream: true,
      max_output_tokens: 4096,
      tools: [{
        type: "web_search" as const,
        search_context_size: "medium" as const,
      }],
      include: ["web_search_call.action.sources"],
      ...(soportaReasoning && {
        reasoning: {
          effort: "medium" as const,
          summary: "concise" as const,
        },
      }),
    })

    // Crear un ReadableStream para enviar los chunks al cliente
    const flujoLectura = new ReadableStream({
      async start(controlador) {
        const codificador = new TextEncoder()

        function enviarEvento(datos: Record<string, unknown>) {
          controlador.enqueue(
            codificador.encode(`data: ${JSON.stringify(datos)}\n\n`)
          )
        }

        try {
          for await (const evento of respuestaStream) {
            // === Eventos de Reasoning/Pensamiento ===

            // Inicio de resumen de razonamiento
            if (evento.type === "response.reasoning_summary_part.added") {
              enviarEvento({ tipo: "pensamiento_iniciado" })
            }

            // Delta de texto de razonamiento (streaming del resumen)
            if (evento.type === "response.reasoning_summary_text.delta") {
              const delta = (evento as unknown as Record<string, unknown>).delta as string
              if (delta) {
                enviarEvento({ tipo: "pensamiento_delta", delta })
              }
            }

            // Resumen de razonamiento completado
            if (evento.type === "response.reasoning_summary_text.done") {
              enviarEvento({ tipo: "pensamiento_completado" })
            }

            // === Eventos de Búsqueda Web ===

            if (evento.type === "response.web_search_call.in_progress") {
              enviarEvento({ tipo: "busqueda_iniciada" })
            }

            if (evento.type === "response.web_search_call.searching") {
              enviarEvento({ tipo: "busqueda_buscando" })
            }

            if (evento.type === "response.web_search_call.completed") {
              enviarEvento({ tipo: "busqueda_completada" })
            }

            // Item de output completado (puede ser web_search_call con resultados)
            if (evento.type === "response.output_item.done") {
              const item = evento.item as unknown as Record<string, unknown>
              if (item.type === "web_search_call") {
                const accion = item.action as Record<string, unknown> | undefined
                const consultas: string[] = []
                const fuentes: Array<{ url: string }> = []

                if (accion) {
                  if (Array.isArray(accion.queries)) {
                    consultas.push(...(accion.queries as string[]))
                  }
                  if (typeof accion.query === "string") {
                    consultas.push(accion.query)
                  }
                  if (Array.isArray(accion.sources)) {
                    for (const fuente of accion.sources) {
                      const f = fuente as Record<string, unknown>
                      if (typeof f.url === "string") {
                        fuentes.push({ url: f.url })
                      }
                    }
                  }
                }

                enviarEvento({
                  tipo: "busqueda_resultado",
                  consultas,
                  fuentes,
                })
              }
            }

            // Anotación de citación (url_citation)
            if (evento.type === "response.output_text.annotation.added") {
              const anotacion = evento.annotation as Record<string, unknown>
              if (anotacion.type === "url_citation") {
                enviarEvento({
                  tipo: "citacion",
                  citacion: {
                    url: anotacion.url ?? "",
                    titulo: anotacion.title ?? "",
                    indiceInicio: anotacion.start_index ?? 0,
                    indiceFin: anotacion.end_index ?? 0,
                  },
                })
              }
            }

            // === Deltas de texto de la respuesta ===
            if (
              evento.type === "response.output_text.delta" &&
              "delta" in evento
            ) {
              const contenido = evento.delta as string
              if (contenido) {
                enviarEvento({ contenido })
              }
            }

            // Cuando la respuesta se completa
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
    console.error("Error en la API de chat:", error)
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    )
  }
}
