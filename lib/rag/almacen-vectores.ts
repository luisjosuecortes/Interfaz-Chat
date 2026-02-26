// Almacen de vectores en memoria con persistencia en IndexedDB
// Busqueda por similitud binaria (distancia de Hamming) sobre Uint8Array[32]
// IndexedDB persiste documentos indexados para sobrevivir recargas de pagina (F5)

import type { DocumentoRAG, ResultadoBusqueda } from "@/lib/tipos"

// === IndexedDB ===

const NOMBRE_DB = "penguinchat-rag"
const VERSION_DB = 1
const NOMBRE_STORE = "documentos"

let dbPromesa: Promise<IDBDatabase> | null = null

function abrirDB(): Promise<IDBDatabase> {
  if (dbPromesa) return dbPromesa
  dbPromesa = new Promise((resolve, reject) => {
    const req = indexedDB.open(NOMBRE_DB, VERSION_DB)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(NOMBRE_STORE)) {
        db.createObjectStore(NOMBRE_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromesa
}

// === Tabla popcount precalculada (256 entradas) ===

const POPCOUNT = new Uint8Array(256)
for (let i = 0; i < 256; i++) {
  let n = i, c = 0
  while (n) { c += n & 1; n >>>= 1 }
  POPCOUNT[i] = c
}

// === Estado en memoria ===

const almacenesPorConversacion = new Map<string, DocumentoRAG[]>()

// Hidratacion: se inicia al cargar el modulo, todas las lecturas criticas la esperan
let promesaHidratacion: Promise<void> = Promise.resolve()

/** Carga todos los documentos desde IndexedDB a memoria */
async function hidratarDesdeIDB(): Promise<void> {
  try {
    const db = await abrirDB()
    const tx = db.transaction(NOMBRE_STORE, "readonly")
    const store = tx.objectStore(NOMBRE_STORE)

    await new Promise<void>((resolve, reject) => {
      const req = store.openCursor()
      req.onsuccess = () => {
        const cursor = req.result
        if (cursor) {
          const conversacionId = cursor.key as string
          const documentos = cursor.value as DocumentoRAG[]
          // No sobreescribir datos mas recientes ya en memoria
          if (!almacenesPorConversacion.has(conversacionId)) {
            almacenesPorConversacion.set(conversacionId, documentos)
          }
          cursor.continue()
        } else {
          resolve()
        }
      }
      req.onerror = () => reject(req.error)
    })
  } catch (e) {
    console.warn("[RAG] Error al hidratar desde IndexedDB:", e)
  }
}

// Iniciar hidratacion al cargar el modulo (solo en browser)
if (typeof window !== "undefined" && typeof indexedDB !== "undefined") {
  promesaHidratacion = hidratarDesdeIDB()
}

/** Persiste los documentos listos de una conversacion en IndexedDB (fire-and-forget) */
function persistirEnIDB(conversacionId: string): void {
  const documentos = almacenesPorConversacion.get(conversacionId)
  abrirDB().then(db => {
    const tx = db.transaction(NOMBRE_STORE, "readwrite")
    const store = tx.objectStore(NOMBRE_STORE)
    if (documentos) {
      const listos = documentos.filter(d => d.estado === "listo")
      if (listos.length > 0) {
        store.put(listos, conversacionId)
      } else {
        store.delete(conversacionId)
      }
    } else {
      store.delete(conversacionId)
    }
  }).catch(e => console.warn("[RAG] Error al persistir en IndexedDB:", e))
}

/** Elimina una conversacion de IndexedDB (fire-and-forget) */
function eliminarDeIDB(conversacionId: string): void {
  abrirDB().then(db => {
    const tx = db.transaction(NOMBRE_STORE, "readwrite")
    tx.objectStore(NOMBRE_STORE).delete(conversacionId)
  }).catch(e => console.warn("[RAG] Error al eliminar de IndexedDB:", e))
}

// === Similitud binaria ===

// Umbral minimo para filtrar fragmentos con similitud baja (ruido)
const UMBRAL_SIMILITUD_MINIMA = 0.55

// Boost aditivo para documentos adjuntados en el mensaje actual
// Con embeddings binarios de 256 bits, vectores aleatorios promedian ~0.5 de similitud
// Un boost de 0.10 asegura que documentos recientes suban significativamente en el ranking
const BOOST_DOCUMENTO_RECIENTE = 0.10

/** Similitud por distancia de Hamming normalizada (0..1)
 *  Compara bit a bit dos embeddings binarios Uint8Array[32]
 *  Retorna 1 = identicos, 0 = opuestos */
function similitudBinaria(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) return 0
  let bitsIguales = 0
  for (let i = 0; i < a.length; i++) {
    bitsIguales += 8 - POPCOUNT[a[i] ^ b[i]]
  }
  return bitsIguales / (a.length * 8)
}

// === API publica ===

/** Espera a que la hidratacion desde IndexedDB haya terminado */
export function esperarHidratacion(): Promise<void> {
  return promesaHidratacion
}

/** Obtiene los documentos RAG de una conversacion */
export function obtenerDocumentos(conversacionId: string): DocumentoRAG[] {
  return almacenesPorConversacion.get(conversacionId) ?? []
}

/** Agrega un documento al almacen */
export function agregarDocumento(conversacionId: string, documento: DocumentoRAG): void {
  const documentos = almacenesPorConversacion.get(conversacionId)
  if (documentos) {
    documentos.push(documento)
  } else {
    almacenesPorConversacion.set(conversacionId, [documento])
  }
}

/** Actualiza campos de un documento — persiste en IDB cuando pasa a "listo" */
export function actualizarDocumento(
  conversacionId: string,
  documentoId: string,
  actualizaciones: Partial<DocumentoRAG>
): void {
  const documentos = almacenesPorConversacion.get(conversacionId)
  if (!documentos) return

  const indice = documentos.findIndex((d) => d.id === documentoId)
  if (indice !== -1) {
    documentos[indice] = { ...documentos[indice], ...actualizaciones }
    if (actualizaciones.estado === "listo") {
      persistirEnIDB(conversacionId)
    }
  }
}

/** Elimina un documento del almacen y de IndexedDB */
export function eliminarDocumento(conversacionId: string, documentoId: string): void {
  const documentos = almacenesPorConversacion.get(conversacionId)
  if (!documentos) return

  const indice = documentos.findIndex((d) => d.id === documentoId)
  if (indice !== -1) {
    documentos.splice(indice, 1)
    persistirEnIDB(conversacionId)
  }
}

/** Limpia todos los documentos de una conversacion */
export function limpiarAlmacen(conversacionId: string): void {
  almacenesPorConversacion.delete(conversacionId)
  eliminarDeIDB(conversacionId)
}

/** Transfiere documentos de un ID temporal a un ID de conversacion real */
export function transferirDocumentos(idOrigen: string, idDestino: string): void {
  const documentos = almacenesPorConversacion.get(idOrigen)
  if (!documentos) return
  almacenesPorConversacion.set(idDestino, documentos)
  almacenesPorConversacion.delete(idOrigen)
  persistirEnIDB(idDestino)
  eliminarDeIDB(idOrigen)
}

/** Busca los fragmentos mas similares por distancia de Hamming.
 *  Filtra resultados por debajo del umbral de similitud minima.
 *  idsDocumentosRecientes: boost aditivo para documentos adjuntados en el mensaje actual */
export function buscarFragmentosSimilares(
  conversacionId: string,
  embeddingConsulta: Uint8Array,
  topK: number = 10,
  idsDocumentosRecientes?: Set<string>
): ResultadoBusqueda[] {
  const documentos = almacenesPorConversacion.get(conversacionId)
  if (!documentos) return []

  const resultados: ResultadoBusqueda[] = []

  for (const documento of documentos) {
    if (documento.estado !== "listo") continue

    const esReciente = idsDocumentosRecientes?.has(documento.id) ?? false
    const totalFragmentos = documento.fragmentos.length
    for (const fragmento of documento.fragmentos) {
      let similitud = similitudBinaria(embeddingConsulta, fragmento.embedding)

      if (esReciente) {
        similitud = Math.min(1.0, similitud + BOOST_DOCUMENTO_RECIENTE)
      }

      if (similitud >= UMBRAL_SIMILITUD_MINIMA) {
        resultados.push({ fragmento, similitud, nombreDocumento: documento.nombre, totalFragmentosDocumento: totalFragmentos })
      }
    }
  }

  resultados.sort((a, b) => b.similitud - a.similitud)
  return resultados.slice(0, topK)
}

/** Obtiene estadisticas del almacen de una conversacion */
export function obtenerEstadisticas(conversacionId: string): {
  totalDocumentos: number
  documentosListos: number
  totalFragmentos: number
} {
  const documentos = almacenesPorConversacion.get(conversacionId)
  if (!documentos) return { totalDocumentos: 0, documentosListos: 0, totalFragmentos: 0 }

  let documentosListos = 0
  let totalFragmentos = 0

  for (const doc of documentos) {
    if (doc.estado === "listo") {
      documentosListos++
      totalFragmentos += doc.fragmentos.length
    }
  }

  return { totalDocumentos: documentos.length, documentosListos, totalFragmentos }
}

/** Verifica si hay fragmentos listos para busqueda */
export function tieneFragmentosListos(conversacionId: string): boolean {
  const documentos = almacenesPorConversacion.get(conversacionId)
  if (!documentos) return false
  return documentos.some((d) => d.estado === "listo" && d.fragmentos.length > 0)
}
