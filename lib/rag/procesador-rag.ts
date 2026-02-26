// Procesador RAG - Orquestador principal
// Pipeline: archivo → Worker (extraccion + fragmentacion + vectorizacion) → almacenamiento
// Busqueda: consulta → embedding binario → similitud Hamming → contexto para el LLM
// El Worker procesa todo: React solo recibe progreso y resultados
// Soporta ~60 extensiones de codigo con fragmentacion inteligente por lenguaje

import type { Adjunto, DocumentoRAG, FragmentoDocumento, ResultadoBusqueda } from "@/lib/tipos"
import { generarId } from "@/lib/utils"
import { generarEmbedding, procesarArchivoCompleto } from "./motor-embeddings"
import {
  agregarDocumento,
  actualizarDocumento,
  buscarFragmentosSimilares,
  tieneFragmentosListos,
  esperarHidratacion,
} from "./almacen-vectores"
import { esArchivoSoportado, esArchivoProhibido } from "./separadores-codigo"

// Callback de progreso de procesamiento
export type CallbackProgreso = (
  documentoId: string,
  estado: DocumentoRAG["estado"],
  progreso?: number,
  error?: string
) => void

/** Determina si un adjunto debe procesarse con RAG (no imagenes, no archivos prohibidos).
 *  Usa el registro centralizado de extensiones soportadas y lista negra. */
export function debeUsarRAG(adjunto: Adjunto): boolean {
  if (adjunto.tipo === "imagen") return false
  if (esArchivoProhibido(adjunto.nombre)) return false
  return esArchivoSoportado(adjunto.nombre)
}

/** Procesa un documento completo para RAG
 *  En modo Worker: envia el archivo crudo al Worker via Transferable Objects
 *  El Worker ejecuta extraccion + fragmentacion + vectorizacion internamente
 *  React solo recibe mensajes de progreso y los fragmentos finales con embeddings */
export async function procesarDocumentoParaRAG(
  conversacionId: string,
  adjunto: Adjunto,
  alProgreso?: CallbackProgreso
): Promise<DocumentoRAG> {
  const documentoId = generarId()

  const documento: DocumentoRAG = {
    id: documentoId,
    nombre: adjunto.nombre,
    tipoMime: adjunto.tipoMime,
    estado: "pendiente",
    fragmentos: [],
    fechaCreacion: new Date(),
  }

  agregarDocumento(conversacionId, documento)
  alProgreso?.(documentoId, "pendiente")

  try {
    // Pipeline completo delegado al motor (Worker o fallback)
    // El Worker recibe el ArrayBuffer crudo y hace extracion + fragmentacion + vectorizacion
    const fragmentosProcesados = await procesarArchivoCompleto(
      adjunto.contenido,
      adjunto.nombre,
      adjunto.tipoMime,
      (datos) => {
        // Traducir progreso del motor al formato del procesador
        const estado = datos.fase as DocumentoRAG["estado"]
        const progreso = datos.porcentaje

        actualizarDocumento(conversacionId, documentoId, { estado })
        alProgreso?.(documentoId, estado, progreso)
      }
    )

    // Convertir FragmentoProcesado[] a FragmentoDocumento[]
    const fragmentosFinales: FragmentoDocumento[] = fragmentosProcesados.map(fp => ({
      id: generarId(),
      documentoId,
      texto: fp.texto,
      embedding: fp.embedding,
      indice: fp.indice,
      metadatos: { inicio: fp.inicio, fin: fp.fin },
    }))

    // Almacenar fragmentos (auto-persiste en IndexedDB cuando estado = "listo")
    actualizarDocumento(conversacionId, documentoId, {
      estado: "listo",
      fragmentos: fragmentosFinales,
      fechaProcesamiento: new Date(),
    })
    alProgreso?.(documentoId, "listo")

    return { ...documento, estado: "listo", fragmentos: fragmentosFinales, fechaProcesamiento: new Date() }
  } catch (error) {
    const mensajeError = error instanceof Error ? error.message : "Error desconocido"
    actualizarDocumento(conversacionId, documentoId, { estado: "error", mensajeError })
    alProgreso?.(documentoId, "error", undefined, mensajeError)
    return { ...documento, estado: "error", mensajeError }
  }
}

/** Busca contexto relevante para una consulta en los documentos de la conversacion.
 *  idsDocumentosRecientes: IDs de documentos adjuntados en el mensaje actual para boost */
export async function buscarContextoRelevante(
  conversacionId: string,
  consulta: string,
  topK: number = 10,
  idsDocumentosRecientes?: Set<string>
): Promise<ResultadoBusqueda[]> {
  // Esperar hidratacion de IndexedDB (no-op si ya completo)
  await esperarHidratacion()

  if (!tieneFragmentosListos(conversacionId)) return []

  const embeddingConsulta = await generarEmbedding(consulta)
  return buscarFragmentosSimilares(conversacionId, embeddingConsulta, topK, idsDocumentosRecientes)
}

/** Grupo de fragmentos adyacentes fusionados del mismo documento */
interface GrupoFragmentos {
  nombreDocumento: string
  indiceInicio: number
  indiceFin: number
  totalFragmentos: number
  texto: string
}

/** Fusiona fragmentos adyacentes del mismo documento para dar contexto continuo al LLM.
 *  Fragmentos con indices consecutivos (ej: 15,16,17) se unen en un solo bloque. */
function fusionarFragmentosAdyacentes(resultados: ResultadoBusqueda[]): GrupoFragmentos[] {
  if (resultados.length === 0) return []

  // Ordenar por documento y luego por indice
  const ordenados = [...resultados].sort((a, b) => {
    const cmpDoc = a.nombreDocumento.localeCompare(b.nombreDocumento)
    if (cmpDoc !== 0) return cmpDoc
    return a.fragmento.indice - b.fragmento.indice
  })

  const grupos: GrupoFragmentos[] = []
  let grupoActual: GrupoFragmentos = {
    nombreDocumento: ordenados[0].nombreDocumento,
    indiceInicio: ordenados[0].fragmento.indice,
    indiceFin: ordenados[0].fragmento.indice,
    totalFragmentos: ordenados[0].totalFragmentosDocumento,
    texto: ordenados[0].fragmento.texto,
  }

  for (let i = 1; i < ordenados.length; i++) {
    const r = ordenados[i]
    const esAdyacente =
      r.nombreDocumento === grupoActual.nombreDocumento &&
      r.fragmento.indice === grupoActual.indiceFin + 1

    if (esAdyacente) {
      grupoActual.indiceFin = r.fragmento.indice
      grupoActual.texto += "\n" + r.fragmento.texto
    } else {
      grupos.push(grupoActual)
      grupoActual = {
        nombreDocumento: r.nombreDocumento,
        indiceInicio: r.fragmento.indice,
        indiceFin: r.fragmento.indice,
        totalFragmentos: r.totalFragmentosDocumento,
        texto: r.fragmento.texto,
      }
    }
  }
  grupos.push(grupoActual)

  return grupos
}

/** Construye el texto de contexto para inyectar en el prompt del LLM.
 *  Fusiona fragmentos adyacentes e incluye posicion en el documento. */
export function construirContextoParaPrompt(resultados: ResultadoBusqueda[]): string {
  if (resultados.length === 0) return ""

  const grupos = fusionarFragmentosAdyacentes(resultados)

  const fragmentosTexto = grupos.map((grupo, i) => {
    const posicion = grupo.indiceInicio === grupo.indiceFin
      ? `seccion ${grupo.indiceInicio + 1} de ${grupo.totalFragmentos}`
      : `secciones ${grupo.indiceInicio + 1}-${grupo.indiceFin + 1} de ${grupo.totalFragmentos}`

    return `[Fragmento ${i + 1}] (Fuente: ${grupo.nombreDocumento}, ${posicion})\n${grupo.texto}`
  })

  return [
    "--- CONTEXTO DE DOCUMENTOS SUBIDOS ---",
    "",
    "Usa la siguiente informacion extraida de los documentos del usuario para responder su pregunta.",
    "Los fragmentos estan ordenados por posicion en el documento. La posicion (seccion X de Y) indica de donde proviene cada fragmento.",
    "",
    fragmentosTexto.join("\n\n"),
    "",
    "--- FIN DEL CONTEXTO ---",
    "",
    "Pregunta del usuario:",
    "",
  ].join("\n")
}
