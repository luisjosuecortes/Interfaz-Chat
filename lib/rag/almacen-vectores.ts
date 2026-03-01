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

// Redirecciones: cuando transferirDocumentos mueve docs de un ID temporal a uno real,
// los callbacks asincrónicos del Worker aun referencian el ID viejo.
// Este mapa redirige ID temporal → ID real para que las actualizaciones no se pierdan.
const redirecciones = new Map<string, string>()

/** Resuelve un ID de conversacion, siguiendo redirecciones si existen */
function resolverIdConversacion(id: string): string {
  return redirecciones.get(id) ?? id
}

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

  // Solicitar persistencia para que el navegador no elimine datos de IndexedDB bajo presion de almacenamiento
  if (navigator.storage?.persist) {
    navigator.storage.persist().then(concedido => {
      if (!concedido) console.warn("[RAG] Persistencia de almacenamiento no concedida por el navegador")
    })
  }
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

/** Cosine similarity entre dos vectores Float32 pre-normalizados (Matryoshka 256).
 *  Usado en la fase 2 (re-ranking) del Two-Stage Retrieval.
 *  Como ambos vectores estan normalizados, dot product = cosine similarity. */
function similitudCoseno(a: Float32Array, b: Float32Array): number {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}

// Two-Stage Retrieval: candidatos amplios para re-ranking
const TOP_K_CANDIDATOS = 50

// === API publica ===

/** Espera a que la hidratacion desde IndexedDB haya terminado */
export function esperarHidratacion(): Promise<void> {
  return promesaHidratacion
}

/** Obtiene los documentos RAG de una conversacion */
export function obtenerDocumentos(conversacionId: string): DocumentoRAG[] {
  return almacenesPorConversacion.get(resolverIdConversacion(conversacionId)) ?? []
}

/** Agrega un documento al almacen */
export function agregarDocumento(conversacionId: string, documento: DocumentoRAG): void {
  const idResuelto = resolverIdConversacion(conversacionId)
  const documentos = almacenesPorConversacion.get(idResuelto)
  if (documentos) {
    documentos.push(documento)
  } else {
    almacenesPorConversacion.set(idResuelto, [documento])
  }
}

/** Actualiza campos de un documento — persiste en IDB cuando pasa a "listo" */
export function actualizarDocumento(
  conversacionId: string,
  documentoId: string,
  actualizaciones: Partial<DocumentoRAG>
): void {
  const idResuelto = resolverIdConversacion(conversacionId)
  const documentos = almacenesPorConversacion.get(idResuelto)
  if (!documentos) return

  const indice = documentos.findIndex((d) => d.id === documentoId)
  if (indice !== -1) {
    documentos[indice] = { ...documentos[indice], ...actualizaciones }
    if (actualizaciones.estado === "listo") {
      persistirEnIDB(idResuelto)
    }
  }
}

/** Elimina un documento del almacen y de IndexedDB */
export function eliminarDocumento(conversacionId: string, documentoId: string): void {
  const idResuelto = resolverIdConversacion(conversacionId)
  const documentos = almacenesPorConversacion.get(idResuelto)
  if (!documentos) return

  const indice = documentos.findIndex((d) => d.id === documentoId)
  if (indice !== -1) {
    documentos.splice(indice, 1)
    persistirEnIDB(idResuelto)
  }
}

/** Transfiere documentos de un ID temporal a un ID de conversacion real.
 *  Registra redireccion para que callbacks asincrónicos del Worker
 *  que aun referencien el ID temporal encuentren los documentos. */
export function transferirDocumentos(idOrigen: string, idDestino: string): void {
  const documentos = almacenesPorConversacion.get(idOrigen)
  if (!documentos) return
  almacenesPorConversacion.set(idDestino, documentos)
  almacenesPorConversacion.delete(idOrigen)
  redirecciones.set(idOrigen, idDestino)
  persistirEnIDB(idDestino)
  eliminarDeIDB(idOrigen)
}

/** Busca fragmentos similares con Two-Stage Retrieval:
 *  Fase 1: Hamming binario rapido → top 50 candidatos (nanosegundos por fragmento)
 *  Fase 2: Cosine similarity Float32 → re-ranking preciso de los top 10 definitivos
 *  Filtra resultados por debajo del umbral de similitud minima. */
export function buscarFragmentosSimilares(
  conversacionId: string,
  embeddingConsulta: Uint8Array,
  embeddingConsultaFloat?: Float32Array,
  topK: number = 10,
  idsDocumentosRecientes?: Set<string>
): ResultadoBusqueda[] {
  const documentos = almacenesPorConversacion.get(resolverIdConversacion(conversacionId))
  if (!documentos) return []

  const BOOST_RECENCIA = 0.10
  const candidatos: ResultadoBusqueda[] = []

  // Fase 1: Hamming binario — filtrado rapido de candidatos
  for (const documento of documentos) {
    if (documento.estado !== "listo") continue

    const esReciente = idsDocumentosRecientes?.has(documento.id) ?? false
    const totalFragmentos = documento.fragmentos.length
    for (const fragmento of documento.fragmentos) {
      let similitud = similitudBinaria(embeddingConsulta, fragmento.embedding)
      if (esReciente) similitud += BOOST_RECENCIA
      if (similitud >= UMBRAL_SIMILITUD_MINIMA) {
        candidatos.push({ fragmento, similitud, nombreDocumento: documento.nombre, totalFragmentosDocumento: totalFragmentos })
      }
    }
  }

  candidatos.sort((a, b) => b.similitud - a.similitud)
  const preseleccionados = candidatos.slice(0, TOP_K_CANDIDATOS)

  // Fase 2: Re-rank con cosine Float32 (si hay embeddings Float32 disponibles)
  if (embeddingConsultaFloat && preseleccionados.length > 0) {
    for (const r of preseleccionados) {
      if (r.fragmento.embeddingFloat) {
        const esReciente = idsDocumentosRecientes?.has(r.fragmento.documentoId) ?? false
        r.similitud = similitudCoseno(embeddingConsultaFloat, r.fragmento.embeddingFloat)
        if (esReciente) r.similitud += BOOST_RECENCIA
      }
      // Si no tiene embeddingFloat (doc viejo de IDB), conserva la similitud Hamming
    }
    preseleccionados.sort((a, b) => b.similitud - a.similitud)
  }

  return preseleccionados.slice(0, topK)
}

/** Obtiene estadisticas del almacen de una conversacion */
export function obtenerEstadisticas(conversacionId: string): {
  totalDocumentos: number
  documentosListos: number
  totalFragmentos: number
} {
  const documentos = almacenesPorConversacion.get(resolverIdConversacion(conversacionId))
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
  const documentos = almacenesPorConversacion.get(resolverIdConversacion(conversacionId))
  if (!documentos) return false
  return documentos.some((d) => d.estado === "listo" && d.fragmentos.length > 0)
}

/** Limpia todos los datos RAG asociados a una conversacion:
 *  documentos en memoria, redirecciones que apuntan a este ID, e IndexedDB.
 *  Llamar al eliminar una conversacion para evitar memory leaks. */
export function limpiarDatosConversacion(conversacionId: string): void {
  const idResuelto = resolverIdConversacion(conversacionId)
  almacenesPorConversacion.delete(idResuelto)
  eliminarDeIDB(idResuelto)
  // Limpiar redirecciones que apuntan a este ID
  for (const [origen, destino] of redirecciones) {
    if (destino === idResuelto || origen === conversacionId) {
      redirecciones.delete(origen)
    }
  }
}
