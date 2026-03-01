# PenguinChat - Documentacion Tecnica

## Descripcion General

PenguinChat es un asistente de inteligencia artificial construido con **Next.js 16**, **React 19** y **TypeScript 5**. Se conecta a la API de OpenAI (Responses API) y soporta streaming en tiempo real, busqueda web, razonamiento (reasoning), adjuntos multimodales, artefactos con panel lateral (codigo, HTML, SVG), ejecucion local de codigo (JavaScript via iframe sandboxed, Python via Web Worker dedicado con Pyodide WASM y cache persistente), herramienta de ejecucion via function calling (el modelo puede invocar `ejecutar_codigo` y recibir resultados) y multiples modelos GPT. La arquitectura de proveedores es extensible para soportar Anthropic, Google y otros en el futuro.

---

## Estructura del Proyecto

```
chatslm/
├── app/                          # App Router de Next.js
│   ├── api/                      # Rutas de API (Server-side)
│   │   ├── chat/
│   │   │   ├── route.ts          # API de streaming para chat con OpenAI (con function calling)
│   │   │   └── continuar/
│   │   │       └── route.ts      # API para continuar respuesta tras tool call (ejecutar_codigo)
│   │   └── titulo/
│   │       └── route.ts          # API para generar titulos de conversaciones
│   ├── globals.css               # Estilos globales, tema y animaciones
│   ├── layout.tsx                # Layout raiz (fuentes, providers, metadata)
│   └── page.tsx                  # Pagina principal (ProveedorArtefacto + ContenedorChat)
│
├── components/                   # Componentes de React
│   ├── chat/                     # Componentes especificos del chat
│   │   ├── area-chat.tsx         # Area de mensajes con auto-scroll inteligente, titulo flotante y boton de sidebar
│   │   ├── barra-lateral.tsx     # Sidebar con branding "PenguinChat" (tipografia serif), lista de conversaciones y CSS visibility (sin render condicional)
│   ├── bloque-codigo.tsx     # Bloque de codigo con syntax highlighting, deteccion de artefactos y boton Ejecutar
│   │   ├── burbuja-mensaje.tsx   # Mensaje individual (usuario/asistente)
│   │   ├── contenedor-chat.tsx   # Componente orquestador principal (layout split chat + artefacto + drag-and-drop global)
│   │   ├── entrada-mensaje.tsx   # Input con selector de modelos, adjuntos, paste (Ctrl+V), drag-and-drop y limite de 10 adjuntos
│   │   ├── indicador-busqueda.tsx    # Indicador de busqueda web activa
│   │   ├── indicador-pensamiento.tsx # Boton + contenido expandido de reasoning (separados para layout flex)
│   │   ├── indicador-rag.tsx     # Indicador de estado de documentos RAG
│   │   ├── lightbox-imagen.tsx   # Lightbox modal para ver imagenes en grande (React portal)
│   │   ├── panel-artefacto.tsx   # Panel lateral para visualizar, editar y ejecutar artefactos (editor overlay, consola de resultados)
│   │   ├── pantalla-inicio.tsx   # Pantalla inicial de bienvenida
│   │   ├── renderizador-markdown.tsx # Procesador de Markdown con pipeline LaTeX de 5 pasos
│   │   ├── tarjeta-archivo.tsx     # Tarjeta de archivo con miniatura PDF, click-to-lightbox para imagenes
│   │   └── tarjetas-citacion.tsx # Tarjetas de fuentes citadas
│   └── ui/                       # Componentes de UI reutilizables (shadcn)
│       ├── button.tsx            # Boton con variantes (CVA)
│       ├── dropdown-menu.tsx     # Menu desplegable (Radix UI)
│       ├── icono-sparkle.tsx     # Icono sparkle y avatar del asistente
│       ├── iconos-proveedor.tsx  # Iconos SVG de proveedores de IA (OpenAI, etc.)
│       ├── popover.tsx           # Popover accesible (Radix UI)
│       ├── scroll-area.tsx       # Area de scroll personalizada (con fix para Radix issue #926)
│       └── tooltip.tsx           # Tooltips accesibles
│
├── lib/                          # Logica de negocio y utilidades
│   ├── rag/                      # Sistema RAG (Retrieval-Augmented Generation)
│   │   ├── almacen-vectores.ts   # Almacen de vectores binarios + IndexedDB persistente
│   │   ├── extractor-texto.ts    # Extractor de texto (fallback hilo principal)
│   │   ├── fragmentador-texto.ts # Fragmentador de texto con soporte de codigo (fallback hilo principal)
│   │   ├── motor-embeddings.ts   # Proxy hacia Web Worker con fallback a hilo principal
│   │   ├── separadores-codigo.ts # Registro centralizado de extensiones, separadores por lenguaje y lista negra
│   │   ├── worker-embeddings.ts  # Web Worker: pipeline streaming con async generators
│   │   └── procesador-rag.ts     # Orquestador RAG (delega al motor)
│   ├── use-miniatura-pdf.ts       # Hook para generar miniaturas de PDFs (pdfjs-dist, cache global)
│   ├── almacen-chat.ts           # Store global (useSyncExternalStore)
│   ├── cliente-chat.ts           # Cliente de streaming para la API (con soporte tool calling)
│   ├── constantes.ts             # Constantes compartidas cliente/servidor (INSTRUCCIONES_SISTEMA, HERRAMIENTAS_CHAT)
│   ├── contexto-artefacto.tsx    # React Context para artefactos + estado de ejecucion de codigo
│   ├── ejecutor-codigo.ts        # Motor de ejecucion local: JS (iframe sandbox) + Python (Web Worker con Pyodide WASM)
│   ├── worker-pyodide.ts         # Web Worker dedicado: Pyodide WASM, Cache API, try/finally matplotlib, protocolo postMessage
│   ├── hooks.ts                  # Hooks personalizados reutilizables
│   ├── modelos.ts                # Catalogo de modelos y proveedores de IA (con ventanaContexto/maxTokensSalida)
│   ├── preprocesar-imagen.ts     # Preprocesamiento de imagenes (resize + compress con Canvas API)
│   ├── tipos.ts                  # Tipos e interfaces TypeScript
│   └── utils.ts                  # Utilidades (cn, generarId)
│
├── public/
│   └── pdf.worker.min.mjs        # Worker de pdfjs-dist (copiado via postinstall)
│
├── .env.local                    # Variables de entorno (OPENAI_API_KEY)
├── components.json               # Configuracion de shadcn/ui
├── next.config.ts                # Configuracion de Next.js (Turbopack + WASM aliases)
├── package.json                  # Dependencias y scripts
└── tsconfig.json                 # Configuracion de TypeScript
```

---

## Arquitectura

### Patron General

El proyecto sigue una arquitectura **Component-Driven** con un **Store centralizado** sin dependencias externas:

```
                    ┌─────────────────────┐
                    │    ContenedorChat   │  ← Orquestador principal
                    │  (contenedor-chat)  │
                    └────────┬────────────┘
                             │
              ┌──────────────┼──────────────┬──────────────┐
              │              │              │              │
     ┌────────▼──────┐ ┌─────▼────┐ ┌───────▼───────┐ ┌───▼──────────┐
     │  BarraLateral │ │ AreaChat │ │ PantallaInicio│ │PanelArtefacto│
     │ (sidebar)     │ │ (msgs)   │ │ (bienvenida)  │ │(panel lateral│
     └───────────────┘ └────┬─────┘ └───────────────┘ │ 45% desktop) │
                            │                          └──────────────┘
                   ┌────────┼────────┐
                   │        │        │
          ┌────────▼──┐ ┌───▼────┐ ┌─▼───────────────┐
          │ Burbuja   │ │Entrada │ │ Indicadores     │
          │ Mensaje   │ │Mensaje │ │ (busqueda,      │
          │           │ │        │ │  pensamiento)   │
          └────┬──────┘ └────────┘ └─────────────────┘
               │
     ┌─────────┼─────────┐
     │         │         │
  Markdown  Codigo  Citaciones
              │
    ┌─────────▼─────────┐
    │ Si ≥25 lineas o   │
    │ SVG/HTML completo:│
    │ → TarjetaArtefacto│
    │ → abre panel      │
    └───────────────────┘
```

### Flujo de Datos

```
Usuario adjunta archivo → EntradaMensaje → ContenedorChat.manejarAdjuntoRAG()
    │
    ├── Si es documento (PDF, TXT, etc.) → Pipeline RAG inmediato:
    │   procesador-rag → motor-embeddings → Web Worker
    │   (extraccion + fragmentacion + vectorizacion streaming)
    │   (UI muestra progreso, boton enviar bloqueado hasta completar)
    │
    └── Si es imagen → se almacena en estado local (pasa directo a la API al enviar)

Usuario escribe → EntradaMensaje → ContenedorChat.manejarEnvio()
    │
    ├── 1. Crea conversacion si no existe (almacen-chat)
    │       └── Si hay ID RAG temporal → transferir documentos a la conversacion real
    │
    ├── 2. Separa imagenes (API directa) de documentos (ya indexados)
    │
    ├── 3. Agrega mensaje del usuario al store
    ├── 4. Busca contexto RAG relevante (obtenerContenidoConContextoRAG)
    │       │
    │       ├── Genera embedding binario de la consulta del usuario
    │       ├── Busca fragmentos similares por distancia de Hamming
    │       └── Prepende contexto relevante al mensaje del usuario
    │
    ├── 5. Calcula presupuesto dinamico (ventanaContexto - maxSalida - systemPrompt - RAG - margen)
    │       └── Trunca historial si excede el presupuesto (truncarHistorial, gpt-tokenizer)
    │
    ├── 6. Llama a enviarConsultaAlModelo()
    │       │
    │       ├── Agrega mensaje vacio del asistente (con modelo)
    │       ├── Llama a enviarMensajeConStreaming() (cliente-chat)
    │       │       │
    │       │       └── POST /api/chat → OpenAI Responses API
    │       │           │
    │       │           ├── Eventos de pensamiento → actualizarPensamiento
    │       │           ├── Eventos de busqueda   → actualizarBusqueda
    │       │           ├── Deltas de texto        → actualizarUltimoMensaje
    │       │           ├── Citaciones             → agregarCitacion
    │       │           ├── Tool call (ejecutar_codigo) → manejarToolCall:
    │       │           │     1. Parsea argumentos {lenguaje, codigo}
    │       │           │     2. Inserta bloque de codigo en el texto del asistente
    │       │           │     3. Muestra indicador de progreso "*Ejecutando codigo...*"
    │       │           │     4. ejecutarCodigo() localmente (iframe/Pyodide)
    │       │           │     5. Muestra resultado formateado al usuario en el chat
    │       │           │     6. POST /api/chat/continuar → envia resultado al modelo
    │       │           │     7. Procesa nuevo stream de continuacion
    │       │           │     8. Soporta encadenamiento recursivo (max 5 niveles)
    │       │           └── [FIN]                  → alFinalizar
    │       │
    │       └── Si es primer mensaje → generarTituloConversacion()
    │
    └── UI se re-renderiza via useSyncExternalStore
```

---

## Componentes Principales

### `contenedor-chat.tsx` - Orquestador

El componente raiz de la aplicacion. Gestiona:
- Envio de mensajes nuevos (`manejarEnvio`)
- Creacion lazy de conversaciones (solo al enviar el primer mensaje, no al pulsar "nueva conversacion")
- Edicion y reenvio de mensajes del usuario (`manejarEdicionMensaje`, `manejarReenvioMensaje`)
- Regeneracion de respuestas del asistente (`manejarRegenerarRespuesta`)
- Generacion automatica de titulos en el primer intercambio
- Control de la generacion (detener streaming)
- Streaming con throttle de 50ms para limitar re-renders
- **Lectura directa del modelo** (`obtenerModeloSeleccionado()`): todas las funciones asincronas que envian mensajes al modelo (enviar, editar, reenviar, regenerar) leen el modelo seleccionado directamente del store al momento de ejecutar, en vez de capturarlo del closure de React. Esto evita que `React.memo` en `BurbujaMensaje` (que ignora cambios de callbacks para optimizar renders) provoque que se use un modelo desactualizado
- **Layout split chat + artefacto**: cuando hay un artefacto activo, el area de chat se oculta en mobile y comparte el espacio en desktop (55% chat / 45% panel, max 700px). Usa `useArtefacto()` del contexto para reaccionar al estado del panel
- **Cierre automatico del panel**: `cerrarArtefacto()` se llama al cambiar de conversacion (`manejarSeleccionarConversacion`) y al crear nueva conversacion (`manejarNuevaConversacion`)
- **Limpieza RAG al eliminar conversacion** (`manejarEliminarConversacion`): al eliminar una conversacion desde la barra lateral, se llama `limpiarDatosConversacion(id)` antes de `eliminarConversacion(id)` del store, limpiando documentos en memoria, redirecciones y datos de IndexedDB
- **Patron reserved-space (ChatGPT/Claude):** en los 4 handlers, `establecerEscribiendo(true)` + `agregarMensaje(asistente, "")` ocurren ANTES del `await obtenerContenidoConContextoRAG`, garantizando espacio reservado y scroll inmediato sin ventana invisible
- **Indexacion RAG al adjuntar** (`manejarAdjuntoRAG`): procesa documentos inmediatamente al adjuntarlos, no al enviar
- **ID temporal de RAG** (`idRAGTemporal`): almacena vectores antes de crear la conversacion, luego transfiere
- **Bloqueo de envio** (`estaIndexandoRAG`): impide enviar mientras se indexan documentos
- **Inyeccion de contexto RAG** (`obtenerContenidoConContextoRAG`): busca fragmentos relevantes y los prepende al mensaje
- **Truncamiento de historial** (`truncarHistorial`): recorta pares completos de mensajes (usuario+asistente) cuando el historial excede el presupuesto dinamico del modelo (conteo real via `gpt-tokenizer`, encoding o200k_base, con `allowedSpecial: 'all'` para tolerar tokens especiales literales en el contenido). El presupuesto se calcula como: `ventanaContexto - maxTokensSalida - tokensSystemPrompt - tokensRAG - margenSeguridad(512)`. Cache FIFO de 500 entradas para evitar recontar. El system prompt se cuenta una sola vez (`tokensSystemPromptCache`)
- **Drag-and-drop global** (`manejarDragOverGlobal`, `manejarDropGlobal`): handlers en el div raiz que permiten arrastrar archivos desde el explorador de archivos a cualquier parte de la pagina. Los archivos dropeados se pasan a `EntradaMensaje` via props `archivosExternos` / `alLimpiarArchivosExternos`. Un overlay visual con borde punteado (`fixed inset-0 z-50 pointer-events-none`) indica la zona de drop activa
- **Orquestacion de tool calls** (`manejarToolCall`): funcion anidada dentro de `enviarConsultaAlModelo` que gestiona el ciclo de vida completo de las invocaciones de herramientas del modelo. Cuando el modelo emite un tool call `ejecutar_codigo`, el handler: (1) parsea argumentos JSON `{lenguaje, codigo}`, (2) inserta el bloque de codigo como markdown en `textoRespuestaFinal`, (3) muestra indicador de progreso inline ("*Ejecutando codigo Python/JavaScript...*") visible al usuario, (4) ejecuta localmente via `ejecutarCodigo()`, (5) muestra el resultado formateado al usuario en el chat ("**Resultado:**" o "**Error de ejecucion:**" con bloque de codigo), (6) formatea resultado como texto para el modelo, (7) llama `enviarContinuacionConStreaming()` que envia el resultado al modelo via `/api/chat/continuar` y procesa el nuevo stream. Gestiona correctamente el texto acumulado (`ultimoTextoContinuacion`) para no perder contenido entre el texto principal y la continuacion. Soporta encadenamiento recursivo con limite de profundidad (`MAX_TOOL_CALLS_ENCADENADOS = 5`): si el modelo hace otro tool call tras recibir el resultado, `alToolCall` del callback fusiona el texto acumulado y llama a `manejarToolCall` con `profundidad + 1`. Al alcanzar el limite, inserta un mensaje informativo y finaliza. Los callbacks `alFinalizar` y `alError` de la continuacion manejan la limpieza del estado (`estaEscribiendo`, `referenciaControlador`, titulo). El catch block muestra errores especificos en vez de genericos

**Layout del area principal:**

```tsx
<main className="flex flex-1 min-w-0">
  {/* Chat: se oculta en mobile cuando hay artefacto */}
  <div className={artefactoActivo ? "hidden lg:flex lg:flex-1" : "flex-1"}>
    {/* AreaChat o PantallaInicio */}
  </div>
  {/* Panel artefacto: 45% en desktop, 100% en mobile */}
  {artefactoActivo && (
    <div className="w-full lg:w-[45%] lg:max-w-[700px] shrink-0 h-full">
      <PanelArtefacto />
    </div>
  )}
</main>
```

### `almacen-chat.ts` - Store Global

Store implementado con `useSyncExternalStore` de React 19, sin dependencias externas (ni Zustand, ni Redux). Maneja:
- Lista de conversaciones
- Conversacion activa
- Creacion y seleccion de conversaciones
- Accion `iniciarNuevaConversacion` (desselecciona la activa sin crear una nueva)
- Estado de escritura
- Modelo seleccionado
- Estado de la barra lateral

**Patron Observer:** Los suscriptores se notifican automaticamente al cambiar el estado.

**Lectura directa del modelo (`obtenerModeloSeleccionado()`):** Funcion exportada que lee `estado.modeloSeleccionado` directamente del store sin pasar por el hook de React. Se usa en `contenedor-chat.tsx` dentro de funciones asincronas (`enviarConsultaAlModelo`, `manejarEnvio`, etc.) para obtener el modelo actual al momento de ejecutar, evitando closures stale causados por `React.memo` con comparador personalizado en `BurbujaMensaje` (que ignora cambios de callbacks).

### `cliente-chat.ts` - Cliente de Streaming

Dos funciones principales para comunicacion con el backend via SSE:

**`enviarMensajeConStreaming()`** - Flujo principal:
- Envia peticion POST a `/api/chat`
- Lee el stream con `ReadableStream` y `TextDecoder`
- Parsea eventos SSE (Server-Sent Events) linea por linea
- Maneja buffer incompleto para chunks parciales
- **Flush del buffer residual**: al terminar el stream (`done = true`), procesa cualquier dato restante en `bufferIncompleto` que no termine con `\n`. Esto previene perdida silenciosa del final de la respuesta cuando el ultimo chunk del servidor no termina con salto de linea
- Despacha callbacks tipados: `alActualizar`, `alBusquedaIniciada`, `alCitacion`, `alPensamientoIniciado`, `alPensamientoDelta`, `alPensamientoCompletado`, `alToolCall`
- **Manejo de tool calls**: cuando el evento es `tipo: "tool_call"`, despacha `alToolCall(nombre, argumentos, callId, idRespuesta)` y ejecuta `return` inmediatamente. Si algun campo falta, emite `console.warn` para depuracion en vez de ignorar silenciosamente. Esto evita que el `[FIN]` posterior sea procesado por el loop — el handler del tool call (`manejarToolCall` en `contenedor-chat.tsx`) gestiona el ciclo de vida completo incluyendo finalizacion

**`enviarContinuacionConStreaming()`** - Continuacion tras tool call:
- Envia resultado de tool call a `/api/chat/continuar` via POST
- Mismo patron de parsing SSE que la funcion principal
- Callbacks reducidos: `alActualizar`, `alFinalizar`, `alError`, `alToolCall`
- Soporta encadenamiento: si el modelo hace otro tool call durante la continuacion, lo despacha via `alToolCall` y ejecuta `return` (el handler recursivo se encarga)

**Protocolo SSE de eventos:**

| Evento | Formato | Handler |
|--------|---------|---------|
| Texto | `{"contenido": "..."}` | `alActualizar` (acumula) |
| Busqueda web | `{"tipo": "busqueda_iniciada"}` | `alBusquedaIniciada` |
| Busqueda resultado | `{"tipo": "busqueda_resultado", "consultas": [...], "fuentes": [...]}` | `alBusquedaResultado` |
| Citacion | `{"tipo": "citacion", "citacion": {...}}` | `alCitacion` |
| Pensamiento | `{"tipo": "pensamiento_iniciado"}` | `alPensamientoIniciado` |
| Pensamiento delta | `{"tipo": "pensamiento_delta", "delta": "..."}` | `alPensamientoDelta` |
| Tool call | `{"tipo": "tool_call", "nombre": "...", "argumentos": "...", "callId": "...", "idRespuesta": "..."}` | `alToolCall` |
| Fin | `[FIN]` | `alFinalizar` |

### `burbuja-mensaje.tsx` - Mensaje Individual

Renderiza un mensaje completo con:
- Avatar del asistente (componente `AvatarAsistente`) posicionado **arriba del mensaje** (fuera del flujo flex del texto)
- Contenido en Markdown (asistente) o texto plano (usuario)
- **Indicadores de estado junto al avatar** (en la misma linea via `flex items-center gap-3`):
  - `BotonPensamiento` (si hay razonamiento). Se despliega debajo en ancho completo.
  - Tres puntos animados (`.punto-cargando`) cuando el mensaje está en curso pero no hay razonamiento bloqueante.
  - Adorno estático de **Respuesta** (texto gris) cuando el mensaje carga directamente sin pensar.
  - `IndicadorBusqueda` se muestra **debajo** de toda esta fila y del pensamiento, con un margen superior e indentación generosa (`pl-8 pt-1.5 pb-2.5`) para fluir orgánicamente de forma vertical.
- Tarjetas de citacion
- Adjuntos (imagenes y archivos)
- Modo edicion inline para mensajes del usuario (ancho completo, bordes interactivos, transicion instantanea)
- Botones de accion: copiar, editar, reenviar, regenerar
- Nombre del modelo que genero la respuesta (en asistente)

**Variables derivadas clave:**

```typescript
// Solo para dots de carga animados vs estáticos
const estaSoloEsperando = !esUsuario && estaEscribiendoEste && !mensaje.contenido
// Estado levantado del pensamiento
const [pensamientoExpandido, establecerPensamientoExpandido] = useState(false)
// El avatar va en flex row si es el asistente (para adornos inline)
const tieneIndicadorInline = !esUsuario
```

**Auto-expansion del pensamiento durante streaming:**

Cuando el modelo transiciona de "pensando" a "completado" durante streaming, el contenido del pensamiento se auto-expande para que no desaparezca abruptamente. Se implementa con el patron React de "ajustar estado durante el render" (no useEffect):

```typescript
const [prevEstadoPensamiento, establecerPrevEstadoPensamiento] = useState<string | undefined>(undefined)
if (prevEstadoPensamiento !== mensaje.pensamiento?.estado) {
  establecerPrevEstadoPensamiento(mensaje.pensamiento?.estado)
  if (
    prevEstadoPensamiento === "pensando" &&
    mensaje.pensamiento?.estado === "completado" &&
    mensaje.pensamiento.resumen.length > 0
  ) {
    establecerPensamientoExpandido(true)
  }
}
```

Para mensajes historicos (ya completados al montar), `prevEstadoPensamiento` empieza como `undefined` (no como `"pensando"`), asi que no se auto-expande — solo se auto-expande cuando el usuario ve la transicion en vivo.

**Layout del avatar (estilo Gemini):**

```
[Avatar] Pensando... O Respuesta    ← flex row (boton / estático)
   ┃ Contenido del pensamiento...   ← debajo, ancho completo
🌐 Busqueda web completada          ← debajo, indentado extra
   "consulta 1" "consulta 2"
Texto de respuesta...               ← contenido normal
```

- **Fila superior** (`flex items-center gap-3`): Avatar + `BotonPensamiento` O adorno "Respuesta" estático/cargando.
- **Contenido expandido**: `ContenidoPensamiento` fluye directamente debajo de la fila superior, a ancho completo con `border-l-2`.
- **Busqueda web**: `IndicadorBusqueda` fluye completamente debajo, utilizando márgenes asimétricos para balance visual.

**`React.memo` con comparador personalizado:**

`BurbujaMensaje` esta envuelto en `memo` con una funcion comparadora que solo compara los props de datos (`mensaje`, `estaEscribiendoEste`, `estaGenerando`) e ignora los callbacks (`alEditarMensaje`, etc.). Los callbacks son recreados en cada render del componente padre pero su comportamiento es estable; ignorarlos en la comparacion evita re-renders innecesarios de todos los mensajes no-streaming.

El store preserva las referencias de objeto de los mensajes no-modificados en `actualizarUltimoMensaje` (via `.map()` que solo crea un nuevo objeto para el ultimo mensaje). Por lo tanto, `anterior.mensaje === siguiente.mensaje` es `true` para todos los mensajes excepto el que esta en streaming, permitiendo que React salte sus renders completamente.

**Modo edicion premium:**
Al editar un mensaje del usuario, la burbuja se expande a ancho completo con bordes interactivos que coinciden con la barra de entrada principal. Transicion instantanea (sin animaciones CSS). Botones: "Cancelar" (ghost con icono X) y "Enviar" (acento con icono ArrowUp, deshabilitado si vacio).

### `tarjeta-archivo.tsx` - Tarjeta de Archivo Minimalista

Componente de visualizacion de archivos adjuntos con tres modos: imagen, PDF con miniatura, y archivo generico. Diseno minimalista tipo chip/pill.

**Categorias de archivo (para seleccion de icono):**

| Categoria | Icono | Extensiones |
|-----------|-------|-------------|
| `pdf` | `FileText` | `.pdf` |
| `codigo` | `FileCode` | `.js`, `.ts`, `.tsx`, `.jsx`, `.py`, `.css`, `.html` |
| `datos` | `FileSpreadsheet` | `.csv`, `.json`, `.xml` |
| `config` | `File` | (extensiones no listadas explicitamente, ej: `.yaml`, `.toml`) |
| `texto` | `FileText` | `.md`, `.txt` (y cualquier extension sin categoria explicita) |
| `imagen` | `File` | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` |

**Estructura del componente:**
- `TarjetaArchivoConMiniatura` (wrapper con `memo`): resuelve el problema de usar hooks dentro de `.map()` al encapsular `useMiniaturaPDF` en un componente separado
- `TarjetaArchivo` (componente puro con `memo`): renderiza la tarjeta segun el tipo:
  - **Imagenes**: miniatura directa del contenido base64 (h-32/h-24)
  - **PDFs**: miniatura compacta generada por `useMiniaturaPDF` + nombre truncado (w-100px/w-130px)
  - **Archivos genericos**: chip minimalista con icono gris + nombre truncado + extension en texto gris (h-9/h-10)
- **Variantes**: `compacta` (input, mas pequena) y `expandida` (burbuja de mensaje, mas grande)
- **Boton eliminar**: aparece en hover (opacity transition), solo si se pasa `alEliminar`. Usa `!bg-black/60 hover:!bg-black/80` con `!text-white` y `ring-1 ring-white/30` para contraste sobre cualquier fondo de imagen (los `!important` previenen que `variant="ghost"` de shadcn sobreescriba colores en hover)
- **Click-to-lightbox**: las imagenes siempre muestran `cursor-pointer` y abren `LightboxImagen` al hacer click, en ambas variantes. El boton eliminar usa `e.stopPropagation()` para no interferir con el click de lightbox
- **Sin franjas de color, sin badges coloreados, sin fondos de icono**: diseno limpio con fondo `--color-claude-sidebar` y borde sutil

### `lightbox-imagen.tsx` - Lightbox Modal para Imagenes

Componente ligero para visualizar imagenes en grande, sin dependencias externas.

**Caracteristicas:**
- **React portal**: renderiza en `document.body` via `createPortal` para superponer toda la UI
- **Overlay**: fondo semi-transparente (`bg-black/80`) con `backdrop-blur-sm` y animacion `fade-in` (200ms)
- **Cierre triple**: tecla Escape (via `addEventListener("keydown")`), click fuera de la imagen (`onClick` en overlay), o boton X (esquina superior derecha con fondo `bg-white/10`)
- **Bloqueo de scroll**: establece `document.body.style.overflow = "hidden"` al montar y restaura al desmontar
- **Imagen responsive**: `max-h-[90vh] max-w-[90vw] object-contain` con `rounded-lg shadow-2xl`
- **`stopPropagation`**: click en la imagen no cierra el lightbox (solo en el overlay)
- **Cleanup**: `useEffect` con return para remover listener y restaurar overflow

### `use-miniatura-pdf.ts` - Hook de Miniaturas PDF

Hook que genera una miniatura de la primera pagina de un PDF.

**Proceso:**
1. Recibe `id`, `contenido` (base64) y `habilitado` como parametros
2. Si ya existe en el cache global (`Map<string, string>`), retorna inmediatamente el ObjectURL generado
3. Importa dinamicamente `pdfjs-dist` y configura el worker a `/pdf.worker.min.mjs`
4. Carga el documento PDF y obtiene la pagina 1
5. Crea un canvas offscreen con ancho de 160px (escalado por `devicePixelRatio`, max 2x) y altura proporcional
6. Renderiza la pagina al canvas y obtiene un Blob (ahorrando memoria respecto a DataURLs pesados)
7. Genera un `URL.createObjectURL(blob)`, lo almacena en cache global y retorna

**Caracteristicas:**
- **Cache global** (fuera del componente): `Map<string, string>` indexado por ID del adjunto. Sobrevive re-renders y desmontajes.
- **Limpieza estructurada:** Exporta `limpiarCacheMiniaturaPDF` que revoca el `ObjectURL` y limpia el mapa; es llamado automaticamente al eliminar un adjunto individual del input (`entrada-mensaje.tsx → eliminarAdjunto`) y al eliminar una conversacion completa (`almacen-chat.ts`), previniendo fugas de RAM en ambos escenarios.
- **Limpieza de efecto**: si el componente se desmonta antes de completar, no actualiza el estado
- **Cast de tipos**: usa `as Parameters<typeof pagina.render>[0]` para satisfacer los tipos de pdfjs-dist v5 que requieren el campo `canvas` en `RenderParameters`

### `area-chat.tsx` - Contenedor de mensajes

Usa un `<div>` nativo con scroll via `useScrollAlFondo()` para control total durante streaming. El titulo flotante de la conversacion se oculta automaticamente (`lg:opacity-0 lg:pointer-events-none` con `transition-opacity duration-200`) cuando el panel de artefactos esta abierto, evitando solapamiento visual. Lee `artefactoActivo` de `useArtefacto()`.

**Logica de scroll (2 efectos):**
- `useEffect([conversacion.id])`: scroll instantaneo al cambiar de conversacion
- `useEffect([estaEscribiendo])`: cuando `estaEscribiendo` pasa a `true`, fuerza scroll al fondo para mostrar el espacio reservado del asistente

El `MutationObserver` del hook se encarga del auto-scroll durante el streaming de tokens.

**Sentinel div:**

Despues del ultimo mensaje siempre existe un `<div className="min-h-4 shrink-0">`. Garantiza 16px de espacio en blanco al final de la lista, evitando que el indicador de tres puntos o el cursor parpadeante queden pegados al borde inferior del contenedor con scroll.

**Agrupacion de mensajes por remitente:**

Los mensajes consecutivos del mismo rol se agrupan visualmente con gaps reducidos. En vez de un `space-y-6` estatico, se usan clases dinamicas por mensaje:
- Primer mensaje (`indice === 0`): sin margen
- Mismo remitente que el anterior: `mt-1.5` (6px, grupo visual compacto)
- Diferente remitente: `mt-6` (24px, separacion clara entre turnos)

Esto se calcula comparando `mensaje.rol` con `mensajeAnterior.rol` en el `.map()` de renderizado.

**Padding del contenedor de mensajes:**

El div interior que contiene la lista de mensajes usa `pt-14 pb-3`: 56px de padding superior para que el primer mensaje no quede oculto bajo el header flotante (titulo + boton de sidebar, posicionado `absolute top-3`), y 12px de padding inferior que junto con el sentinel dan un margen final compacto de ~28px debajo del ultimo mensaje.

### `contexto-mensaje.tsx` [NEW]

Un mini-contexto en memoria de uso estrictamente local (no engloba la UI, engloba solo una burbuja individual). Extraordinariamente útil para inyectar metadatos transitorios o variables dinámicas a componentes de nodos muy anidados como ASTs del analizador de Markdown, preservando así las optimizaciones de caché del React y posibilitando la auto-apertura inteligente de artefactos en el streaming.

### `renderizador-markdown.tsx` - Procesador Markdown con Pipeline LaTeX

Usa `react-markdown` con plugins:
- `remarkMath` (PRIMERO): Parsea delimitadores `$...$` y `$$...$$` antes de que GFM interprete `|` como tabla
- `remarkGfm` (SEGUNDO): Tablas, task lists, tachado
- `rehypeKatex`: Renderiza formulas LaTeX con opciones tolerantes (`throwOnError: false`, `strict: false`, `output: "htmlAndMathml"`)
- Componentes personalizados para codigo, enlaces y tablas

Envuelto en `React.memo`: como `BurbujaMensaje` ya esta memoizado, `RenderizadorMarkdown` no se re-renderiza para mensajes no-streaming. Durante streaming, `contenido` cambia en cada token, por lo que el componente re-renderiza normalmente solo para el mensaje activo. Los plugins (`pluginsRemark`, `pluginsRehype`) y `componentesMarkdown` son constantes fuera del componente para que `ReactMarkdown` no vea nuevas referencias en cada render.

**Orden de plugins:** `[remarkMath, remarkGfm]` — remarkMath PRIMERO para que parsee `$...$` antes de que GFM interprete `|` como delimitador de tabla. Si el orden se invierte, formulas con `|` (como `$|x|$`) se rompen.

**Pipeline de pre-procesamiento (`preprocesarMatematicas`):**

Los LLMs no siempre producen LaTeX con delimitadores correctos. El pipeline de 5 pasos normaliza la salida antes de pasarla a remark-math:

| Paso | Descripcion | Ejemplo |
|------|-------------|---------|
| 1. Delimitadores | Convierte `\[...\]` → `$$...$$` y `\(...\)` → `$...$` | `\(x^2\)` → `$x^2$` |
| 2. Entornos | Envuelve `\begin{env}...\end{env}` huerfanos en `$$` | `\begin{align}...\end{align}` → `$$\begin{align}...\end{align}$$` |
| 3. Bare sub/super | Detecta subscripts/superscripts sin llaves ni `$` | `h_t` → `$h_{t}$`, `C_in` → `$C_{in}$`, `x^2` → `$x^{2}$` |
| 4. Braced sub/super | Detecta tokens con `^{...}` o `_{...}` sin `$` | `W^{(1)}` → `$W^{(1)}$`, `Conv^{(l)}` → `$Conv^{(l)}$` |
| 5. Pipe escaping | Reemplaza `\|` por `\vert{}` dentro de `$` existentes | `$\|x\|$` → `$\vert{}x\vert{}$` |

Cada paso usa un patron combinado `(bloques_protegidos)|(patron_a_transformar)` que preserva bloques de codigo y math existente sin marcadores temporales.

**Deteccion de bare subscripts/superscripts (Paso 3):**

Para evitar falsos positivos con identificadores de codigo como `my_variable` o `file_name`, el regex requiere:
- Base de **una sola letra** (latina `A-Z/a-z` o griega `Α-ω`)
- Lookbehind negativo: no precedido por word char, `\`, o `$`
- Lookahead negativo: no seguido por word char, `{`, o `\`
- Subscript/superscript de 1-4 caracteres alfanumericos
- Soporta parejas encadenadas: `W_x^2` → `$W_{x}^{2}$`

La funcion de reemplazo añade llaves automaticamente: `h_t` → `h_{t}` → `$h_{t}$` (necesario para KaTeX con subscripts multi-caracter como `C_in` → `$C_{in}$`).

**Deteccion de braced subscripts/superscripts (Paso 4):**

Captura tokens con al menos un `^{...}` o `_{...}` (con llaves). El patron de llaves soporta hasta 2 niveles de anidamiento: `{C_{out} × C_{in}}`. Los caracteres previos al operador pueden ser multi-caracter (ej: `Conv`, `∂L/∂W`) pero excluye separadores comunes para evitar capturar contexto no matematico.

### `bloque-codigo.tsx` - Syntax Highlighting y Deteccion de Artefactos

Componente dual: renderiza bloques de codigo con syntax highlighting y detecta automaticamente cuando un bloque debe mostrarse como artefacto en un panel lateral.

**Componentes exportados:**

| Componente | Descripcion |
|------------|-------------|
| `BloqueCodigoConResaltado` | Componente principal: si el codigo califica como artefacto, muestra `TarjetaArtefacto`; si no, muestra el bloque inline con tema claro (`oneLight`), barra superior y boton copiar |
| `CodigoConResaltado` | Componente para el panel de artefactos: tema claro (`oneLight`) con fondo transparente (delegado al contenedor `--color-claude-sidebar`) y `overflow: "visible"` para delegar scroll al contenedor exterior. Sin cabecera ni deteccion |

**Componentes internos:**

| Componente | Descripcion |
|------------|-------------|
| `TarjetaArtefacto` | Tarjeta clickable que sustituye al bloque de codigo en el chat para artefactos (>=25 lineas, SVG, HTML, LaTeX) |
| `TarjetaEjecucion` | Tarjeta neutral para bloques ejecutados por el modelo (marcador `@ejecutado-por-modelo`). Misma estructura visual que `TarjetaArtefacto`, con punto de color sutil para estado y soporte para `resultadoPrevio` |
| `IndicadorEjecucion` | Tarjeta animada durante ejecucion de tool calls (pseudo-lenguaje `ejecutando:*`). Icono Terminal pulsante + dots animados (`.punto-cargando`) |

**Constantes exportadas:**

| Constante | Descripcion |
|-----------|-------------|
| `NOMBRES_LENGUAJE` | Mapa de alias → nombre bonito (ej: `ts` → `TypeScript`, `py` → `Python`) |
| `EXTENSIONES_DESCARGA` | Mapa de lenguaje → extension de archivo para descarga (ej: `typescript` → `ts`) |

**Deteccion de artefactos (`debeSerArtefacto`):**

| Condicion | Resultado |
|-----------|-----------|
| Lenguaje `svg` o contenido empieza con `<svg` | Siempre artefacto (previsualizacion SVG) |
| Lenguaje `html`/`markup` con `<!DOCTYPE` o `<html>` | Siempre artefacto (previsualizacion HTML) |
| Codigo con ≥25 lineas | Artefacto (codigo largo) |
| Codigo con <25 lineas | Bloque inline normal |

El umbral de 25 lineas se eligio para deteccion puramente frontend (sin intencion del modelo): filtra snippets triviales y bloques de explicacion sin perder codigo sustancial como funciones, componentes o clases completas.

**Funciones internas de artefactos:**

| Funcion | Descripcion |
|---------|-------------|
| `generarIdArtefacto(contenido, posicionOrigen)` | Genera ID determinista via hash del contenido (primeros 100 chars) + posicion del bloque en el markdown fuente. La posicion (`node.position.start.offset` de react-markdown) previene colisiones entre bloques con prefijo identico (ej: dos componentes React con los mismos imports). El muestreo corto del contenido mantiene estabilidad durante streaming (append-only) |
| `debeSerArtefacto(codigo, lenguaje, totalLineas)` | Heuristica de deteccion: SVG, HTML completo, o ≥25 lineas |
| `determinarTipo(lenguaje, codigo)` | Clasifica en `"svg"`, `"html"`, `"markdown"` o `"codigo"` |
| `inferirTitulo(codigo, lenguaje)` | Busca nombre de archivo en comentarios de la primera linea (`// app.tsx`, `# main.py`, `<!-- index.html -->`). Fallback: nombre del lenguaje |

**Boton Ejecutar (lenguajes ejecutables):**

Para lenguajes ejecutables (JavaScript, TypeScript, Python), el bloque inline muestra un boton "Ejecutar" (icono `Play`) en la barra superior, junto al boton de copiar. El handler `manejarEjecutarEnArtefacto` usa `abrirYEjecutarArtefacto()` del contexto (operacion atomica que recibe el artefacto como parametro y ejecuta directamente sin depender del estado de React, eliminando race conditions). Para artefactos (>=25 lineas), la ejecucion se maneja directamente desde el boton Ejecutar del `PanelArtefacto`. Para Python, si `validarImportsPython()` detecta imports no disponibles en Pyodide, el boton se oculta.

**Regla de hooks**: TODOS los hooks (`useCopiarAlPortapapeles`, `useArtefacto`, `useMensaje`, `useCallback`, `useState`, 2x `useEffect`) se llaman incondicionalmente antes de cualquier early return. Esto previene el error "Rendered fewer hooks than expected" que ocurre cuando un early return condicional (ej: check de marcador `@ejecutado-por-modelo`) salta hooks que ya se habian ejecutado en renders previos.

**Flujo de deteccion:**

```
BloqueCodigoConResaltado recibe {codigo, lenguaje}
    │
    ├── [HOOKS: todos los hooks se ejecutan incondicionalmente]
    │
    ├── ¿lenguaje.startsWith("ejecutando:")? → IndicadorEjecucion (tarjeta animada)
    │
    ├── ¿Primera linea es @ejecutado-por-modelo? → TarjetaEjecucion (tarjeta neutral con resultadoPrevio)
    │
    ├── ¿deshabilitarArtefacto? → renderizar bloque inline
    │
    ├── ¿estaDisponible (contexto)? → si no hay ProveedorArtefacto, bloque inline
    │
    ├── ¿debeSerArtefacto(codigo, lenguaje, totalLineas)?
    │       │
    │       ├── Si → TarjetaArtefacto (card clickable)
    │       │         └── onClick → abrirArtefacto({id, tipo, titulo, contenido, lenguaje, totalLineas})
    │       │                        └── PanelArtefacto se abre via React Context
    │       │
    │       └── No → Bloque inline (barra superior + syntax highlighting + boton copiar + boton ejecutar?)
    │                  └── Si esLenguajeEjecutable(lenguaje) → boton Ejecutar abre panel y ejecuta
    │
    └── Sync en tiempo real: useEffect detecta si el panel muestra este artefacto
        (comparando artefactoActivo.id con idArtefacto) y actualiza el contenido
        via actualizarContenidoArtefacto() cuando el codigo cambia durante streaming
```

**`TarjetaArtefacto` (sub-componente):**

Tarjeta clickable que sustituye al bloque de codigo en el chat. Diseño minimalista con:
- Icono dinamico por tipo (`ICONOS_ARTEFACTO`: `FileCode2` para codigo, `Globe` para HTML, `Image` para SVG, `FileText` para markdown) en fondo oscuro (`#1e1e1e`) con contraste visual fuerte tipo VS Code icon badge
- Titulo inferido del codigo
- Badge con nombre del lenguaje y total de lineas
- `ChevronRight` que aparece en hover (opacity transition)
- Fondo `--color-claude-sidebar` con hover `--color-claude-sidebar-hover`

**Syntax highlighting (temas duales):**

Usa `react-syntax-highlighter` con PrismLight para resaltado de 65+ lenguajes de programacion (incluyendo C/C++, Rust, Go, SQL, Docker, YAML, GraphQL, MATLAB, etc.):
- **Bloques inline en chat** (`BloqueCodigoConResaltado`): tema `oneLight` (fondo claro `hsl(230, 1%, 98%)` ≈ `#fafafb`). Barra superior con `--color-claude-sidebar`, borde con `--color-claude-input-border`, texto con `--color-claude-texto-secundario`. Coherente con el tema blanco de la app.
- **Panel de artefactos** (`CodigoConResaltado`): tema `oneLight` con fondo `transparent` (el contenedor aplica `--color-claude-sidebar` = `#f9f9f9`). `overflow: "visible"` para delegar scroll al contenedor exterior con patron `absolute inset-0`.
- Boton de copiar con retroalimentacion visual
- Etiqueta del lenguaje en la barra superior

**Colores del contenedor inline (tema claro):**

| Elemento | Color | Descripcion |
|----------|-------|-------------|
| Fondo del codigo | `hsl(230, 1%, 98%)` | Del tema `oneLight` (casi blanco) |
| Barra superior | `var(--color-claude-sidebar)` | `#f9f9f9`, gris casi blanco |
| Borde del contenedor | `var(--color-claude-input-border)` | `#e5e5e5`, gris neutro |
| Texto de etiquetas | `var(--color-claude-texto-secundario)` | `#6b7280`, gris neutro |
| Fondo de tokens (`<code/>`) | `transparent` | Anula el fondo heredado del tema para evitar "remarcados" |

### `panel-artefacto.tsx` - Panel Lateral de Artefactos

Panel lateral que visualiza y edita artefactos (codigo, HTML, SVG, markdown, LaTeX) abiertos desde `BloqueCodigoConResaltado` via React Context. Se renderiza condicionalmente en `ContenedorChat` cuando `artefactoActivo !== null`.

**Estructura:**

```
┌─────────────────────────────────────────────────┐
│  Titulo     Lang · N lineas  [▶][✎][⊞][↓][×]   │  ← Cabecera fija (fondo blanco)
├─────────────────────────────────────────────────┤
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░ Modo codigo: CodigoConResaltado               ░│  ← Fondo claro #f9f9f9 en el
│░ Modo preview: VistaPreviaArtefacto            ░│     contenedor scrollable (flex-1),
│░  o RenderizadorMarkdown                       ░│     llena toda la altura disponible
│░ Modo edicion: overlay (textarea               ░│
│░  transparente + resaltado)                    ░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
├─────────────────────────────────────────────────┤
│ ● Completado  42ms                    [▼]       │  ← ConsolaResultados (si hay resultado)
│ console.log output...                           │     Tema claro, max-h-48, colapsable
│ => resultado final                              │
└─────────────────────────────────────────────────┘
```

**Modos de visualizacion (3):**

| Modo | Activacion | Implementacion |
|------|-----------|----------------|
| Codigo | Toggle "Codigo" (por defecto para codigo) | `CodigoConResaltado` con tema oneLight |
| Preview | Toggle "Preview" (por defecto para markdown/SVG/HTML/LaTeX) | `RenderizadorMarkdown`, `VistaPreviaArtefacto` (iframe sandboxed), o `convertirLatexAMarkdown` + `RenderizadorMarkdown` |
| Edicion | Boton lapiz "Editar" (todos los tipos) | Patron overlay: textarea transparente sobre `CodigoConResaltado` |

**Editor overlay (patron `react-simple-code-editor`):**

El modo edicion usa un patron de superposicion sin dependencias externas para mantener syntax highlighting mientras el usuario escribe:

1. **Capa visual** (`pointer-events-none select-none aria-hidden`): `CodigoConResaltado` renderiza el codigo con tema oneLight. El `"\n"` extra al final evita que el ultimo salto de linea colapse
2. **Capa de input** (`absolute top-0 left-0 w-full h-full`): textarea HTML transparente captura la escritura del usuario

**Buffer local de edicion (desacoplado del contexto):**

Las ediciones viven en un estado local `contenidoEditado` dentro de `PanelArtefacto`, completamente independiente del React Context (`ContextoArtefacto`). Esto evita un feedback loop donde el sync effect de `BloqueCodigoConResaltado` (diseñado para sincronizar streaming→panel) revertia las ediciones al detectar discrepancia entre el contenido editado y el codigo original del markdown. Al entrar en edicion, `contenidoEditado` se inicializa desde `artefactoActivo.contenido`; al salir, se descarta (`null`). La variable derivada `contenidoActual = contenidoEditado ?? contenido` se usa en todo el panel (textarea, capa visual, copy, download, preview) para que las ediciones se reflejen correctamente mientras estan activas.

Los estilos estan sincronizados pixel-a-pixel en la constante `ESTILOS_EDITOR`:

```typescript
const ESTILOS_EDITOR: React.CSSProperties = {
  fontFamily: '"Fira Code","Fira Mono",Menlo,Consolas,"DejaVu Sans Mono",monospace',
  fontSize: "0.85rem",
  lineHeight: "1.5",
  padding: "1rem",
  whiteSpace: "pre",
  overflowWrap: "normal",
  wordBreak: "normal",
  tabSize: 2,
  color: "transparent",
  WebkitTextFillColor: "transparent",
  caretColor: "var(--color-claude-texto)",
  overflow: "hidden",
}
```

- `color: transparent` + `WebkitTextFillColor: transparent` ocultan el texto del textarea
- `caretColor` mantiene el cursor visible sobre el codigo resaltado
- `selection:bg-blue-300/30` (Tailwind) proporciona seleccion visible sobre texto transparente
- Los valores de `fontFamily`, `fontSize`, `lineHeight`, `padding` y `tabSize` coinciden exactamente con los de `oneLight` + `estiloCodigoPanel` en `bloque-codigo.tsx`

**Tab key handler:** `manejarTeclaEdicion` intercepta Tab para insertar 2 espacios en la posicion del cursor sin perder el foco. Usa `requestAnimationFrame` para restaurar la posicion del cursor despues de la actualizacion del textarea via React.

**Scroll al cambiar de artefacto:** Usa un simple `useRef<HTMLDivElement>` + `useEffect` que hace `scrollTop = 0` al cambiar de artefacto (por `artefactoActivo?.id`). No usa `useScrollAlFondo` — ese hook tiene un `MutationObserver` que detecta cambios de `characterData`, lo cual causaba scroll al fondo en cada keystroke durante edicion.

**Orden de hooks (regla de React):** Todos los hooks (`useArtefacto`, `useCopiarAlPortapapeles`, `useState`, `useRef`, `useCallback`, `useEffect`) se llaman antes del early return `if (!artefactoActivo) return null`. Las funciones derivadas (`alternarEdicion`, `manejarTeclaEdicion`, `manejarDescarga`) se definen despues del early return porque no son hooks.

**Patron "ajustar estado durante render":** Al cambiar de artefacto (comparando `prevIdArtefacto` con `artefactoActivo?.id`), el panel restablece los modos automaticamente: markdown, SVG, HTML y LaTeX abren en preview por defecto; codigo abre en modo codigo. El modo edicion siempre se desactiva.

**`convertirLatexAMarkdown` (funcion interna):**

Convertidor ligero de 11 pasos que transforma la estructura de un documento LaTeX a Markdown, preservando formulas `$...$` y `$$...$$` intactas para que `RenderizadorMarkdown` las renderice con KaTeX. Necesario porque KaTeX solo renderiza formulas matematicas, no comandos estructurales como `\section`, `\textbf`, `\begin{enumerate}`, etc.

| Paso | Transformacion |
|------|---------------|
| 1 | Extrae contenido de `\begin{document}...\end{document}` y titulo del preambulo |
| 2 | Elimina comandos del preambulo (`\documentclass`, `\usepackage`, etc.) |
| 3 | Secciones → headers Markdown (`\section` → `##`, `\subsection` → `###`) |
| 4 | Formato de texto (`\textbf` → `**`, `\textit` → `*`, `\texttt` → backtick) |
| 5 | Listas (`\begin{enumerate/itemize}` + `\item` → bullets Markdown) |
| 6 | Entornos math display (equation, align, gather) → `$$...$$` |
| 7 | Otros entornos (center, quote, verbatim) → equivalentes Markdown |
| 8 | Espaciado y saltos de linea (`\\`, `\bigskip`, `~`, etc.) |
| 9 | Caracteres especiales LaTeX escapados (`\&`, `\%`, `\#`, etc.) |
| 10 | Elimina comandos no renderizables (`\label`, `\ref`, `\cite`, etc.) |
| 11 | Limpia lineas vacias excesivas |

**Acciones de la cabecera:**

| Boton | Icono | Descripcion |
|-------|-------|-------------|
| Ejecutar | `Play` (verde) / `Loader2` (spinner) | Ejecuta el codigo del artefacto via `ejecutarArtefacto()`. Solo visible para lenguajes ejecutables (JS/TS/Python). Deshabilitado durante ejecucion |
| Editar / Editando | `Pencil` | Toggle modo edicion (todos los tipos). Se oculta Preview/Codigo durante edicion |
| Vista previa / Codigo | `Eye` / `Code2` | Toggle entre codigo y preview (solo tipos con preview, no en modo edicion) |
| Copiar | `Copy` / `Check` | Copia el contenido completo al portapapeles con retroalimentacion visual (2s) |
| Descargar | `Download` | Descarga como archivo con extension correcta segun lenguaje (`EXTENSIONES_DESCARGA`) |
| Cerrar | `X` | Cierra el panel y vuelve al chat completo |

Todos los botones usan etiquetas de texto ocultas en mobile (`hidden sm:inline`).

**`VistaPreviaArtefacto` (sub-componente):**

Iframe sandboxed (`sandbox="allow-scripts"`) con `srcDoc` para renderizar HTML y SVG de forma segura:
- **SVG**: se envuelve en un HTML minimo con fondo claro (`#f9f9f9`) y centrado flexbox
- **HTML**: se inyecta directamente como `srcDoc` via `inyectarHeartbeat()`
- Fondo blanco para el iframe, borde zero

**Proteccion contra bucles infinitos (heartbeat):**
- Se inyecta un script `SCRIPT_HEARTBEAT` en el `<head>` del `srcDoc` que registra un listener de `postMessage`: responde `__pong__` a cada `__ping__` del padre
- Un `useEffect` envia pings cada 2 segundos via `iframeRef.current.contentWindow.postMessage()`
- Si el iframe no responde en 5 segundos (`Date.now() - ultimoPong > 5000`), se marca como `noResponde`
- Se muestra un overlay con "Este artefacto dejo de responder" y un boton "Recargar"
- "Recargar" incrementa una clave (`key`), forzando a React a destruir y recrear el iframe DOM, reiniciando el heartbeat
- Patron usado por CodeSandbox y herramientas similares de preview de codigo

**`descargarArchivo` (funcion interna):**

Crea un `Blob` con el contenido, genera `ObjectURL`, crea un enlace `<a>` temporal, triggera click programatico y limpia (`revokeObjectURL`).

**Fondo claro del contenedor de contenido:** El area de contenido usa un patron `relative` + `absolute inset-0` para garantizar que los scrollbars siempre esten en los bordes del panel. El div exterior (`flex-1 min-h-0 relative`) reserva toda la altura disponible via flexbox, y el div interior (`absolute inset-0 overflow-auto`) llena ese espacio exactamente y maneja el scroll. `bg-[var(--color-claude-sidebar)]` (`#f9f9f9`) se aplica condicionalmente al exterior (solo en modo codigo/edicion, no en vista previa).

**Animacion de entrada:** Clase `.animate-entrada-panel` (CSS keyframe `entrada-panel`): slide-in desde la derecha (translateX 16px → 0) con fade (opacity 0 → 1) en 200ms ease-out.

**`ConsolaResultados` (sub-componente):**

Panel de resultados de ejecucion de codigo con tema claro, posicionado en la parte inferior del panel sobre un divisor (`border-t`):

- **Barra de estado/toggle**: boton clickable que muestra estado (Cargando Python.../Ejecutando.../Completado/Error/Timeout) con icono animado (`Loader2 animate-spin` durante ejecucion, `●` coloreado despues). Incluye duracion en ms y chevron de toggle (`ChevronDown`/`ChevronUp`)
- **Salidas**: area scrollable con `max-h-48 overflow-y-auto`, font mono `text-xs`
- **Colores por tipo de salida (tema claro)**:

| Tipo | Clase CSS | Color |
|------|-----------|-------|
| `stdout` | `text-[var(--color-claude-texto)]` | Negro/gris oscuro |
| `stderr` | `text-amber-600` | Ambar |
| `resultado` | `text-emerald-600` | Verde |
| `error` | `text-red-600` | Rojo |
| `imagen` | — | Renderizado como `<img>` |

- Los resultados se prefijan con `=> ` y los stderr con `stderr: `
- **Imagenes matplotlib**: las salidas tipo `"imagen"` se renderizan como `<img src={dataURL}>` con `max-w-full rounded my-1` y max-height 400px, permitiendo visualizar graficos generados por matplotlib/savefig
- **Auto-scroll**: `useEffect` que hace `scrollTop = scrollHeight` al cambiar `resultado.salidas.length`
- **Colapsable**: toggle abrir/cerrar via la barra de estado
- **Visibilidad**: solo se muestra si hay ejecucion activa o hay salida (`estaActiva || tieneSalida`)
- Fondo `bg-[var(--color-claude-sidebar)]` con hover en la barra, consistente con el tema claro del panel
- **Espacio compacto**: `py-1.5 leading-snug` para minimizar espacio muerto entre lineas de salida

### `contexto-artefacto.tsx` - React Context para Artefactos y Ejecucion

Contexto de React que permite comunicacion entre `BloqueCodigoConResaltado` (emisor) y `ContenedorChat`/`PanelArtefacto` (receptores) sin prop drilling. Tambien gestiona el estado de ejecucion de codigo del artefacto activo.

**Patron:**

```
ProveedorArtefacto (page.tsx)
    ├── ContenedorChat → useArtefacto() → lee artefactoActivo para layout split
    │   ├── AreaChat → BurbujaMensaje → RenderizadorMarkdown → BloqueCodigoConResaltado
    │   │                                                        └── useArtefacto() → abrirArtefacto() / ejecutarArtefacto()
    │   └── PanelArtefacto → useArtefacto() → lee artefactoActivo + estadoEjecucion + resultadoEjecucion
    └── ContenedorChat → useArtefacto() → abrirYEjecutarArtefacto() (tool calls del modelo)
    └── (cualquier componente hijo puede usar useArtefacto())
```

**API del contexto (`ValorContextoArtefacto`):**

| Propiedad | Tipo | Descripcion |
|-----------|------|-------------|
| `estaDisponible` | `boolean` | `true` si `ProveedorArtefacto` esta montado. Evita que `BloqueCodigoConResaltado` intente renderizar tarjetas fuera del contexto |
| `artefactoActivo` | `Artefacto \| null` | Artefacto visible en el panel (`null` = panel cerrado) |
| `editadoPorUsuario` | `boolean` | `true` si el usuario edito el contenido manualmente. Evita que el sync de streaming revierta las ediciones |
| `abrirArtefacto` | `(artefacto: Artefacto) => void` | Abre el panel con el artefacto dado. Limpia estado de ejecucion y edicion. Estable via `useCallback` |
| `cerrarArtefacto` | `() => void` | Cierra el panel (`null`). Limpia todo el estado. Estable via `useCallback` |
| `actualizarContenidoArtefacto` | `(nuevoContenido: string, totalLineas: number) => void` | Actualiza el contenido del artefacto activo durante streaming. NO marca como editado. Usa `setState` funcional para evitar re-renders si el contenido no cambio. Estable via `useCallback` |
| `guardarEdicionUsuario` | `(nuevoContenido: string, totalLineas: number) => void` | Guarda ediciones del usuario y marca `editadoPorUsuario = true` para que el sync de streaming no las revierta |
| `estadoEjecucion` | `EstadoEjecucion` | Estado actual: `"inactivo"` \| `"cargando"` \| `"ejecutando"` \| `"completado"` \| `"error"` |
| `resultadoEjecucion` | `ResultadoEjecucion \| null` | Resultado de la ultima ejecucion (salidas, exito, duracion) |
| `ejecutarArtefacto` | `() => Promise<void>` | Ejecuta el codigo del artefacto activo usando `ejecutarCodigo()` del motor local. Lee contenido y lenguaje actuales (incluyendo ediciones). Determina estado inicial segun si Pyodide necesita cargarse |
| `abrirYEjecutarArtefacto` | `(artefacto: Artefacto) => Promise<ResultadoEjecucion \| null>` | Operacion atomica: abre el artefacto en el panel Y ejecuta su codigo. Usa `refEjecucionExterna` para proteger contra interferencia del auto-open de `bloque-codigo.tsx`. Retorna el resultado de la ejecucion (o `null` si falla). Usado por `manejarToolCall` en `contenedor-chat.tsx` |

**Decisiones de diseno:**

- **React Context vs Store global**: Se usa Context en vez de modificar `almacen-chat.ts` porque el artefacto es estado de UI transiente (no se persiste, no afecta mensajes). Evita re-renders innecesarios del store que maneja conversaciones.
- **`estaDisponible` flag**: Permite que `BloqueCodigoConResaltado` funcione sin el Provider (ej: en tests o previews aislados). El valor por defecto del contexto tiene `estaDisponible: false`, asi que sin Provider no se muestran tarjetas.
- **Callbacks estables**: `abrirArtefacto` y `cerrarArtefacto` usan `useCallback` con dependencias vacias para evitar re-renders de consumers.
- **Guard por ID en `abrirArtefacto`**: usa `setState(prev => ...)` funcional para comparar `prev?.id === artefacto.id` y retornar `prev` sin cambios si es el mismo artefacto. Esto evita re-renders innecesarios durante streaming donde el auto-open llama repetidamente con el mismo artefacto pero contenido actualizado.
- **Provider value memoizado**: `useMemo` envuelve el objeto `value` del Provider con dependencias explicitas. Sin esto, cada render del Provider creaba un nuevo objeto y forzaba re-render de TODOS los consumers via `Object.is()`. Este fix, junto con el guard por ID, resuelve el crash "Maximum update depth exceeded" durante streaming de artefactos.
- **`refEjecucionExterna`**: Ref booleano que protege las ejecuciones iniciadas por tool calls del modelo. Cuando es `true`, `abrirArtefacto` se convierte en no-op, evitando que el auto-open de `bloque-codigo.tsx` resetee `estadoEjecucion` durante una ejecucion en curso. Se activa en `abrirYEjecutarArtefacto` y se desactiva en su `finally`.

### `ejecutor-codigo.ts` - Motor de Ejecucion Local de Codigo (Manager)

Motor de ejecucion de codigo en el navegador. Arquitectura en dos capas:

- **JavaScript/TypeScript**: iframe sandboxed aislado (nuevo por cada ejecucion), ejecutado en el hilo principal
- **Python**: delegado a un **Web Worker dedicado** (`worker-pyodide.ts`) con Pyodide WASM. El hilo principal actua como manager del Worker: lo crea, le envia codigo, recibe resultados via `postMessage`, y lo termina si excede el timeout

**Constantes:**

| Constante | Valor | Descripcion |
|-----------|-------|-------------|
| `LENGUAJES_EJECUTABLES` | `javascript`, `js`, `typescript`, `ts`, `jsx`, `tsx`, `python`, `py` | Set de lenguajes soportados |
| `TIMEOUT_EJECUCION_MS` | `30_000` (30s) | Tiempo maximo de ejecucion |
| `PAQUETES_PYODIDE_DISPONIBLES` | Set con ~90 paquetes | Stdlib + cientificos disponibles en Pyodide 0.27.5 (duplicado del Worker para validacion en UI) |
| `ORIGEN_SANDBOX` | `__ejecutor_penguin__` | Identificador para filtrar postMessages del iframe JS |
| `MARCADOR_IMAGEN_BASE64` | `__IMG_BASE64__:` | Prefijo en stdout para identificar imagenes base64 capturadas por matplotlib |

**Funciones exportadas:**

| Funcion | Descripcion |
|---------|-------------|
| `esLenguajeEjecutable(lenguaje)` | Verifica si un lenguaje soporta ejecucion |
| `ejecutarCodigo(codigo, lenguaje, alIniciarEjecucion?)` | Ejecuta codigo y retorna `ResultadoEjecucion`. El callback opcional se invoca cuando el runtime esta listo (para Python: tras cargar Pyodide) |
| `obtenerEstadoPyodide()` | Retorna estado actual de Pyodide (`inactivo` \| `cargando` \| `listo` \| `error`) |
| `validarImportsPython(codigo)` | Retorna lista de imports no disponibles en Pyodide (vacia si todo OK) |
| `detectarUsoInput(codigo)` | Detecta si el codigo Python usa `input()` (no disponible en WASM) |
| `estaEjecutandoCodigo()` | Indica si hay una ejecucion de Python en curso (para guards en la UI) |

**Ejecutor JavaScript (iframe sandboxed):**

Crea un iframe nuevo para cada ejecucion (no reutiliza) por seguridad:
- `sandbox="allow-scripts"` sin `allow-same-origin`
- CSP via meta tag: `default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'`
- Intercepta `console.log`, `console.error`, `console.warn`, `console.info`
- Ejecuta via `eval()` (requiere `'unsafe-eval'` en CSP)
- Comunica resultados via `postMessage` con identificador `ORIGEN_SANDBOX`
- Timeout via `setTimeout` en el padre + destruccion del iframe
- El iframe se elimina del DOM con 100ms de retraso para permitir mensajes finales

**Manager del Worker Python:**

El hilo principal no ejecuta Python directamente. Gestiona un Worker dedicado (`worker-pyodide.ts`):

- **`obtenerWorker()`**: crea el Worker la primera vez con `new Worker(new URL("./worker-pyodide.ts", import.meta.url))` y espera el mensaje `{tipo: "estado", estado: "listo"}`. Las llamadas subsiguientes retornan el Worker existente inmediatamente. Si el Worker reporta error, la promesa se rechaza y se puede reintentar
- **`ejecutarPython(codigo)`**: gestiona el ciclo completo de ejecucion:
  1. **Mutex** (cola de promesas FIFO): solo una ejecucion activa a la vez. Cada llamada registra su turno y espera al anterior
  2. **Pre-validacion de imports**: en el hilo principal para error rapido sin crear Worker
  3. **Envia al Worker**: `{tipo: "ejecutar", id: idEjecucion, codigo}`
  4. **Escucha mensajes**: acumula `stdout`/`stderr` en array de salidas, resuelve al recibir `resultado`
  5. **Timeout real**: `setTimeout` en el hilo principal funciona correctamente porque WASM corre en el Worker, no aqui. Si el Worker no responde en 30s, `worker.terminate()` lo destruye y se recrea en la proxima ejecucion
  6. **Post-procesamiento**: `postProcesarImagenes()` convierte marcadores `__IMG_BASE64__:` en entradas tipo `"imagen"` con data URL
- **`solicitarAlmacenamientoPersistente()`**: se invoca al crear el Worker. `navigator.storage.persist()` solo funciona desde el hilo principal (no disponible en Workers para el dominio `storage.persist()`)
- **Flag `ejecucionEnCurso`**: se activa dentro del mutex `try` y se desactiva en `finally`, consultable via `estaEjecutandoCodigo()`

**Mutex de ejecucion (cola de promesas):**

Pyodide (`runPythonAsync`) NO es reentrante: si dos ejecuciones corren simultaneamente, los callbacks de `setStdout`/`setStderr` se sobreescriben y los globals se corrompen. La cola de promesas serializa el acceso:

```typescript
let colaEjecucion: Promise<void> = Promise.resolve()

async function ejecutarPython(codigo: string): Promise<ResultadoEjecucion> {
  let liberar: () => void
  const miTurno = new Promise<void>(r => { liberar = r })
  const turnoAnterior = colaEjecucion
  colaEjecucion = miTurno
  await turnoAnterior  // Esperar a que termine la ejecucion anterior

  try { /* ejecucion */ }
  finally { liberar!() }  // Siempre liberar, incluso en error/timeout
}
```

Este es el **segundo nivel de defensa**: el primer nivel es el guard en `contexto-artefacto.tsx` (`if (estadoEjecucion === "ejecutando") return`) que previene clicks duplicados en la UI.

### `worker-pyodide.ts` - Web Worker de Python (Pyodide WASM)

Web Worker dedicado que ejecuta Python via Pyodide en su propio hilo. Al correr en un Worker, el event loop del hilo principal (React) nunca se bloquea, incluso con loops infinitos (`while True: pass`). El Worker se puede terminar con `worker.terminate()` desde el manager si excede el timeout.

**Constantes (internas al Worker):**

| Constante | Valor | Descripcion |
|-----------|-------|-------------|
| `PYODIDE_CDN` | `https://cdn.jsdelivr.net/pyodide/v0.27.5/full/` | URL del CDN de Pyodide |
| `NOMBRE_CACHE_PYODIDE` | `pyodide-v0.27.5` | Nombre del cache persistente |
| `MARCADOR_IMAGEN_BASE64` | `__IMG_BASE64__:` | Prefijo para imagenes base64 de matplotlib |
| `PAQUETES_PYODIDE_DISPONIBLES` | Set con ~90 paquetes | Duplicado para validacion dentro del Worker |

**Singleton Pyodide:**

Pyodide se carga lazy (primera ejecucion) y persiste como singleton dentro del Worker:
- `loadPyodide()` con `fetch: fetchConCache` para cache persistente via Cache API
- Despues de cargar, override de `input()` y `sys.stdin` para dar error claro
- Reporta estado al hilo principal via `postMessage({tipo: "estado", estado: "listo"})`

**Cache API persistente (`fetchConCache`):**

Estrategia cache-first para Pyodide (~11MB WASM) y paquetes Python, ejecutada dentro del Worker (Cache API funciona en Web Workers):
1. Intenta leer de `caches.open("pyodide-v0.27.5")`
2. Si hay hit, retorna sin red
3. Si no, descarga via `fetch()`, guarda en cache, retorna
4. Si la Cache API no esta disponible, usa `fetch()` normal

**`construirCodigoPython(codigoUsuario)` — Envoltorio try/except/finally:**

Envuelve el codigo del usuario en una estructura que garantiza la captura de figuras matplotlib incluso cuando el codigo lanza una excepcion:

```python
import sys as __sys__
__tiene_matplotlib__ = False
try:
    import matplotlib
    matplotlib.use('agg')
    __tiene_matplotlib__ = True
except ImportError:
    pass

__excepcion_usuario__ = None
try:
    # (codigo del usuario indentado 4 espacios)
    ...
except Exception as __e__:
    __excepcion_usuario__ = __e__
    import traceback as __tb__
    __tb__.print_exc()
finally:
    # SIEMPRE capturar figuras matplotlib (incluso con error)
    if __tiene_matplotlib__:
        # ... savefig → BytesIO → base64 → print con marcador __IMG_BASE64__:
        __plt__.close('all')
```

El codigo del usuario se indenta 4 espacios por linea (lineas vacias se mantienen vacias). Post-ejecucion, el Worker verifica `pyodide.globals.get("__excepcion_usuario__")`: si es `null` → `exito: true`, si tiene valor → `exito: false` (el traceback ya fue impreso a stderr).

**Handler principal (`self.onmessage`):**

1. Carga Pyodide si no esta listo (`cargarPyodideEnWorker()`)
2. Pre-valida imports contra `PAQUETES_PYODIDE_DISPONIBLES`
3. Carga paquetes via `loadPackagesFromImports(codigo)` (numpy, pandas, etc.)
4. Redirige stdout/stderr al hilo principal via `postMessage({tipo: "stdout"|"stderr", id, texto})`
5. Ejecuta `construirCodigoPython(codigo)` via `runPythonAsync`
6. Verifica `__excepcion_usuario__` y envia resultado al hilo principal

**Protocolo de mensajes Worker:**

| Direccion | Tipo | Payload |
|-----------|------|---------|
| → Worker | `ejecutar` | `{ id, codigo }` |
| ← Main | `stdout` | `{ id, texto }` |
| ← Main | `stderr` | `{ id, texto }` |
| ← Main | `resultado` | `{ id, exito, error? }` |
| ← Main | `estado` | `{ estado: "cargando" \| "listo" \| "error" }` |

---

## Rutas de API

### `POST /api/chat` - Streaming de Chat

**Request:**
```json
{
  "mensajes": [
    { "rol": "usuario", "contenido": "Hola" },
    { "rol": "asistente", "contenido": "..." }
  ],
  "modelo": "gpt-4o-mini",
  "adjuntos": [
    {
      "id": "abc123",
      "tipo": "imagen",
      "nombre": "foto.png",
      "contenido": "data:image/png;base64,...",
      "tipoMime": "image/png"
    }
  ]
}
```

**Response:** Stream SSE con eventos JSON:
```
data: {"contenido":"Hola, "}
data: {"contenido":"¿como "}
data: {"tipo":"busqueda_iniciada"}
data: {"tipo":"busqueda_resultado","consultas":["..."],"fuentes":[{"url":"..."}]}
data: {"tipo":"citacion","citacion":{"url":"...","titulo":"..."}}
data: {"tipo":"pensamiento_iniciado"}
data: {"tipo":"pensamiento_delta","delta":"Analizando..."}
data: {"tipo":"pensamiento_completado"}
data: {"tipo":"tool_call","nombre":"ejecutar_codigo","argumentos":"{...}","callId":"...","idRespuesta":"..."}
data: [FIN]
```

**Caracteristicas:**
- Convierte roles del español al ingles (`usuario` → `user`)
- Soporta contenido multimodal (imagenes y archivos en el ultimo mensaje)
- Herramienta de busqueda web habilitada por defecto
- **Herramienta `ejecutar_codigo`** (function calling): el modelo puede invocar la funcion `ejecutar_codigo` con parametros `{lenguaje: "python"|"javascript", codigo: "..."}` via el mecanismo de tool use de OpenAI. La herramienta se define con `strict: true` para schema enforcement. Cuando el modelo emite un tool call, el backend envia el evento `tool_call` al frontend y cierra el stream inmediatamente. El frontend ejecuta el codigo localmente y envia el resultado a `/api/chat/continuar` para que el modelo continue
- Reasoning habilitado para modelos con `tieneReasoning: true` (definido en `modelos.ts`)
- `max_output_tokens` dinamico: usa `maxTokensSalida` del modelo seleccionado (definido en `modelos.ts`). GPT-5.x y GPT-4.1: 32768; GPT-4o: 16384
- **System prompt para formateo matematico, estructura de respuesta, idioma de razonamiento e instrucciones de ejecucion de codigo** (`INSTRUCCIONES_SISTEMA`, importado de `lib/constantes.ts`): se envia via el parametro `instructions` de la Responses API. Incluye secciones: (1) MATH FORMATTING: delimitadores LaTeX; (2) RESPONSE STRUCTURE: listas y headers; (3) LANGUAGE: razonar en el idioma del usuario; (4) CODE EXECUTION: cuando usar/no usar la herramienta, timeout; (5) CRITICAL RESTRICTIONS: prohibiciones explicitas de `input()`, `plt.show()`, `time.sleep()`, threads/procesos, shell commands, network requests; (6) Available Python packages: lista de stdlib y cientificos disponibles en Pyodide, y lista de paquetes NO disponibles

**Definicion de herramienta `ejecutar_codigo`:**

```typescript
{
  type: "function",
  name: "ejecutar_codigo",
  description: "Ejecuta codigo Python o JavaScript en el navegador...",
  parameters: {
    type: "object",
    properties: {
      lenguaje: { type: "string", enum: ["python", "javascript"] },
      codigo: { type: "string", description: "El codigo fuente a ejecutar" },
    },
    required: ["lenguaje", "codigo"],
    additionalProperties: false,
  },
  strict: true,
}
```

### `POST /api/chat/continuar` - Continuacion tras Tool Call

Endpoint para enviar el resultado de una ejecucion de tool call al modelo y continuar la respuesta. Utiliza `previous_response_id` de la Responses API para encadenar con la respuesta que genero el tool call.

**Request:**
```json
{
  "idRespuesta": "resp_abc123",
  "callId": "call_xyz789",
  "resultado": "42\n",
  "modelo": "gpt-4o-mini"
}
```

**Response:** Stream SSE identico a `/api/chat` (mismos eventos de texto, busqueda, pensamiento, tool_call, citacion, `[FIN]`).

**Caracteristicas:**
- Usa `previous_response_id` para encadenar con la respuesta anterior
- Envia el resultado como `function_call_output` con el `call_id` correspondiente
- Incluye las mismas herramientas (web_search + ejecutar_codigo) para soportar encadenamiento
- Mismo `INSTRUCCIONES_SISTEMA`, reasoning condicional, `max_output_tokens` y `HERRAMIENTAS_CHAT` que `/api/chat`
- Si el modelo hace otro tool call durante la continuacion, el frontend puede encadenar recursivamente

### `POST /api/titulo` - Generacion de Titulos

**Request:**
```json
{
  "mensajeUsuario": "¿Que es TypeScript?",
  "respuestaAsistente": "TypeScript es un lenguaje..."
}
```

**Response:**
```json
{
  "titulo": "Que es TypeScript"
}
```

Usa `gpt-4o-mini` con maximo 30 tokens para generar un titulo de 6 palabras.

---

## Tipos Principales (`lib/tipos.ts`)

### Tipos RAG

| Interfaz | Descripcion |
|----------|-------------|
| `EstadoProcesamientoRAG` | Estado del pipeline: `pendiente` → `extrayendo` → `fragmentando` → `vectorizando` → `listo` \| `error` |
| `FragmentoDocumento` | Un chunk de texto con su embedding binario `Uint8Array[32]`, indice y metadatos de posicion |
| `DocumentoRAG` | Documento procesado con nombre, tipo MIME, estado, fragmentos y fechas |
| `ResultadoBusqueda` | Resultado de busqueda semantica: fragmento + similitud binaria (Hamming) + nombre del documento |
| `DocumentoRAGUI` | Version simplificada para renderizar estado en la UI (id, nombre, estado, progreso, error, adjuntoId) |

### Tipos Chat

| Interfaz | Descripcion |
|----------|-------------|
| `Mensaje` | Mensaje individual con contenido, modelo, adjuntos, citaciones, busqueda y pensamiento |
| `Conversacion` | Coleccion de mensajes con titulo y fechas |
| `Adjunto` | Archivo o imagen adjunto (base64) |
| `CitacionWeb` | Fuente web citada con URL, titulo e indices |
| `InfoBusquedaWeb` | Estado de busqueda web con consultas y fuentes |
| `InfoPensamiento` | Estado de reasoning con resumen |
| `ModeloDisponible` | Definicion de un modelo con id, nombre, descripcion, proveedor, categoria, `ventanaContexto`, `maxTokensSalida` y `tieneReasoning` |
| `ProveedorIA` | Definicion de un proveedor de IA con id y nombre |
| `EstadoChat` | Estado global de la aplicacion |
| `AccionesChat` | Todas las acciones disponibles del store |

### Tipos Artefactos

| Tipo/Interfaz | Descripcion |
|----------------|-------------|
| `TipoArtefacto` | Union literal: `"codigo"` \| `"html"` \| `"svg"` \| `"markdown"` \| `"latex"` |
| `Artefacto` | Contenido extraido del chat para el panel lateral: `id`, `tipo`, `titulo`, `contenido`, `lenguaje?`, `totalLineas` |

### Tipos Ejecucion de Codigo

| Tipo/Interfaz | Descripcion |
|----------------|-------------|
| `EstadoEjecucion` | Union literal: `"inactivo"` \| `"cargando"` \| `"ejecutando"` \| `"completado"` \| `"error"`. Representa el ciclo de vida de una ejecucion en el panel de artefactos |
| `EntradaConsola` | Una linea de salida de la consola: `tipo` (`"stdout"` \| `"stderr"` \| `"resultado"` \| `"error"` \| `"imagen"`), `contenido` (string; para `"imagen"`: data URL base64 `data:image/png;base64,...`) y `marcaTiempo` (ms desde inicio) |
| `ResultadoEjecucion` | Resultado completo de una ejecucion: `exito` (boolean), `salidas` (array de `EntradaConsola`), `duracionMs` (tiempo total) e `interrumpido?` (boolean, si fue timeout) |

---

## Modelos y Proveedores (`lib/modelos.ts`)

Exporta `PROVEEDORES`, `MODELOS_DISPONIBLES`, `CATEGORIAS_MODELOS` (fuente unica de verdad) y `MODELO_POR_DEFECTO`.

### Proveedores

| Proveedor | ID | Icono |
|-----------|-----|-------|
| OpenAI | `openai` | `iconos-proveedor.tsx` → `IconoOpenAI` |

Para agregar un nuevo proveedor:
1. Añadir entrada en `PROVEEDORES` (modelos.ts)
2. Añadir modelos en `MODELOS_DISPONIBLES` con el `proveedor` correspondiente
3. Añadir categorias en `CATEGORIAS_MODELOS` con el `proveedor`
4. Añadir icono SVG en `iconos-proveedor.tsx` y registrarlo en `MAPA_ICONOS`
5. Configurar cliente API en `app/api/chat/route.ts`

### Modelos

| Modelo | Proveedor | Categoria | Reasoning | ventanaContexto | maxTokensSalida | Descripcion |
|--------|-----------|-----------|-----------|-----------------|-----------------|-------------|
| `gpt-5.2` | OpenAI | gpt-5.2 | Si | 200K | 32K | El mas reciente y capaz |
| `gpt-5.1` | OpenAI | gpt-5.1 | Si | 200K | 32K | Ideal para codigo y razonamiento |
| `gpt-5` | OpenAI | gpt-5 | Si | 200K | 32K | Proposito general de la familia GPT-5 |
| `gpt-5-mini` | OpenAI | gpt-5 | Si | 128K | 16K | Version rapida de GPT-5 |
| `gpt-5-nano` | OpenAI | gpt-5 | Si | 128K | 16K | Ultra-rapido y economico |
| `gpt-4.1` | OpenAI | gpt-4.1 | No | 1M | 32K | Versatil y preciso |
| `gpt-4.1-mini` | OpenAI | gpt-4.1 | No | 1M | 32K | Compacto y economico |
| `gpt-4o` | OpenAI | gpt-4o | No | 128K | 16K | Multimodal de proposito general |
| `gpt-4o-mini` | OpenAI | gpt-4o | No | 128K | 16K | Compacto y economico (modelo por defecto) |

---

## Hooks Personalizados (`lib/hooks.ts`)

### `useCopiarAlPortapapeles(duracionMs?)`

Hook para copiar texto al portapapeles con retroalimentacion visual temporal.

```typescript
const { haCopiado, copiar } = useCopiarAlPortapapeles(2000)
// haCopiado: boolean - se activa 2s despues de copiar
// copiar: (texto: string) => Promise<void>
```

Usado en: `burbuja-mensaje.tsx`, `bloque-codigo.tsx`, `panel-artefacto.tsx`

### `useAlmacenChat()`

Hook del store global que provee estado y acciones.

```typescript
const {
  conversaciones,
  conversacionActiva,
  conversacionActual,
  estaEscribiendo,
  modeloSeleccionado,
  crearConversacion,
  agregarMensaje,
  // ... todas las acciones
} = useAlmacenChat()
```

### `useScrollAlFondo()`

Hook para auto-scroll inteligente en contenedores de chat con streaming. Patron basado en Vercel AI Chatbot.

```typescript
// API del hook:
const { contenedorRef, irAlFondo } = useScrollAlFondo()
// contenedorRef: ref para el div contenedor de scroll
// irAlFondo(suave?): scroll al fondo; suave=true → smooth, false → instant
```

**Arquitectura interna:**
- `MutationObserver` (childList + subtree + characterData): detecta texto nuevo en streaming y mensajes nuevos sin depender del ciclo de React
- `ResizeObserver`: detecta cambios de altura (markdown renderizando, tablas, imagenes cargando)
- `estaUsuarioScrolleandoRef`: previene auto-scroll cuando el usuario scrollea activamente (flag con reset a 150ms)
- `estaEnFondoRef`: ref interno que rastrea si el usuario esta en el fondo, sin provocar re-renders (solo se usa internamente en los observers)
- `rafId` deduplicador: un solo `requestAnimationFrame` por frame durante streaming intenso
- `behavior: "instant"` en auto-scroll de contenido (evita jitter por animaciones colisionando); `"smooth"` disponible via `irAlFondo(true)` para posible boton futuro de ir al fondo
- Umbral: **100px** desde el fondo

**Patron de scroll completo en `area-chat.tsx` (2 capas):**

| Capa | Mecanismo | Para que |
|------|-----------|----------|
| **1. Scroll al enviar** | `useEffect([estaEscribiendo])` → `irAlFondo(false)` | Mostrar espacio reservado inmediatamente, sin importar donde este el usuario |
| **2. Auto-scroll durante streaming** | `MutationObserver` + `rAF` + `irAlFondo()` | Seguir el texto mientras llegan tokens, si el usuario estaba en el fondo |

Usado en: `area-chat.tsx`

---

## Utilidades (`lib/utils.ts`)

| Funcion | Descripcion |
|---------|-------------|
| `cn(...inputs)` | Combina clases CSS con `clsx` + `tailwind-merge` |
| `generarId()` | Genera un ID unico basado en timestamp + aleatorio |

---

## Estilos y Tema

### Paleta de Colores

| Variable CSS | Color | Uso |
|-------------|-------|-----|
| `--color-claude-bg` | `#ffffff` | Fondo principal (blanco puro) |
| `--color-claude-sidebar` | `#f9f9f9` | Fondo del sidebar (gris casi blanco) |
| `--color-claude-sidebar-hover` | `#f0f0f1` | Hover en sidebar |
| `--color-claude-input` | `#ffffff` | Fondo de inputs |
| `--color-claude-input-border` | `#e5e5e5` | Borde de inputs (gris neutro) |
| `--color-claude-texto` | `#1a1a1a` | Texto principal (negro premium) |
| `--color-claude-texto-secundario` | `#6b7280` | Texto secundario (gris neutro, Tailwind gray-500) |
| `--color-claude-acento` | `#1a1a1a` | Color de acento (negro, botones de accion primarios) |
| `--color-claude-acento-hover` | `#000000` | Hover del acento |
| `--color-claude-usuario-burbuja` | `#f4f4f5` | Fondo burbuja del usuario (gris neutro claro, Tailwind zinc-100) |

**Tokens de sombra (variables custom):**

| Variable CSS | Valor | Uso |
|-------------|-------|-----|
| `--sombra-xs` | `0 1px 2px rgba(0,0,0,0.04)` | Sombra sutil para tarjetas y contenedores en reposo |
| `--sombra-sm` | `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)` | Hover en tarjetas de archivo |
| `--sombra-md` | `0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)` | Elevacion media |
| `--sombra-input-foco` | `0 0 0 1px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.06)` | Focus del input de mensajes |

**Filosofia de tema:** El fondo principal es blanco puro (`#ffffff`) con sidebar apenas diferenciado (`#f9f9f9`), separado visualmente del area principal por un borde (`#e5e5e5`). La burbuja del usuario usa un gris neutro claro (`#f4f4f5`, Tailwind zinc-100) como fondo sutil sin tintes calidos. Bordes, scrollbars y separadores usan grises neutros puros para un aspecto limpio. El texto de las respuestas usa `#111111` (casi negro puro) para maximo contraste. Los colores de acento usan negro (`#1a1a1a`) para botones de accion primarios (enviar, detener), eliminando por completo el naranja del tema. Las tarjetas de archivo usan un diseno minimalista tipo chip con iconos grises por categoria.

### Tipografia

- **Sans-serif:** Geist Sans (fuente principal)
- **Monospace:** Geist Mono (bloques de codigo)
- **Serif:** Instrument Serif (branding PenguinChat y encabezados h1/h2 en markdown)

### Animaciones CSS

| Clase | Efecto |
|-------|--------|
| `.cursor-parpadeo` | Cursor parpadeante durante streaming |
| `.punto-cargando` | Tres puntos que saltan (espera primer token del asistente); color `--color-claude-texto` para contraste sobre fondo blanco |
| `.icono-busqueda-pulsando` | Pulsacion del icono de busqueda web |
| `.puntos-animados` | Secuencia "..." animada |
| `.icono-pensamiento-girando` | Rotacion del spinner de reasoning |
| `.burbuja-entrada` | Entrada suave para burbujas de mensaje (slide-up 6px en 250ms ease-out) |
| `.edicion-entrada` | Transicion suave al modo edicion de mensajes (scale 0.98→1 en 200ms) |
| `textarea:focus::placeholder` | Fade del placeholder al hacer focus (opacity 0.4 + translateX 4px) |
| `.scrollbar-oculto` | Oculta scrollbar manteniendo scroll funcional (Firefox: `scrollbar-width: none`, Chrome: `::-webkit-scrollbar { display: none }`) |
| `.scrollbar-codigo` | Scrollbar sutil para panel de codigo sobre fondo oscuro (thumb `#555`/`#777`, track transparente; Firefox: `scrollbar-color: #555 transparent`) |
| `.animate-entrada-panel` | Entrada del panel de artefactos desde la derecha (translateX 16px → 0, opacity 0 → 1, 200ms ease-out) |

### Estilos KaTeX (Formulas Matematicas)

Estilos personalizados dentro de `.prosa-markdown` para integrar KaTeX con el tema visual:

| Selector | Efecto |
|----------|--------|
| `.katex` | Tamaño de fuente `1.05em` para legibilidad |
| `.katex-display` | `margin: 1.25em 0`, `padding: 0.5em 0` para formulas display centradas y prominentes. Scroll horizontal para formulas anchas |
| `.katex-display > .katex` | Tamaño de fuente `1.15em` para que las formulas display destaquen sobre las inline |
| `.katex-error` | Color secundario y tamaño reducido (errores tolerados) |
| `.katex-html` | `white-space: nowrap` para evitar quiebres en formulas |

La hoja de estilos de KaTeX (`katex/dist/katex.min.css`) se importa en `layout.tsx` para las fuentes matematicas.

### Estilos de Prosa Markdown

Los estilos de `.prosa-markdown` estan optimizados para legibilidad premium inspirados en Tailwind Typography (prose):

| Propiedad | Valor | Referencia |
|-----------|-------|------------|
| `font-size` | `16px` | Prose base usa 16px (1rem) |
| `line-height` | `1.75` | Prose recomienda 1.75 para texto de parrafo |
| `color` | `#111111` | Negro casi puro para maximo contraste |
| Marcadores (::marker) | `#1a1a1a` + `font-weight: 600` | Negro solido |
| Margen entre `li` | `0.35em` | Compacto, estilo Claude |
| Margen entre `p` | `0.75em` | Intermedio entre compacto y prose (0.5em → 0.75em) |
| Listas `ul`/`ol` | `list-style-position: inside`, `padding-left: 0`, `margin-left: 0` | Sin indentacion en primer nivel (estilo Claude) |
| `li > p` | `display: inline` | Parrafos fluyen con el marcador sin salto de linea |
| `li > p + p` | `display: block` | Parrafos posteriores como bloque normal |
| Sublistas `li > ul/ol` | `padding-left: 1.25em` | Indentacion solo para niveles anidados |
| Enlaces | `color: #1a1a1a`, subrayado sutil | Oscuros con underline-offset |
| Blockquotes | `border-left: #d1d5db` | Gris neutro (gray-300) |
| Titulos bold en listas | `display: inline` | Fluyen con el marcador |
| Encabezados h1, h2 | `font-family: var(--font-serif)`, `font-weight: 400`, `color: #0a0a0a` | Tipografia serif elegante (Instrument Serif) para jerarquia visual |
| Encabezados h3-h6 | `font-weight: 600`, `color: #0a0a0a` | Sans-serif (Geist) para encabezados menores |
| Codigo inline | `bg-[#f3f4f6]`, `color: #1a1a1a`, `font-medium` | Fondo gris neutro claro sobre blanco |

---

## Dependencias Principales

| Paquete | Version | Proposito |
|---------|---------|-----------|
| `next` | 16.1.6 | Framework React con App Router |
| `react` | 19.2.3 | Libreria de UI |
| `openai` | ^6.22.0 | SDK de OpenAI (Responses API) |
| `@huggingface/transformers` | ^3.8.1 | Embeddings locales via ONNX/WASM en navegador |
| `pdfjs-dist` | ^5.4.624 | Extraccion de texto de PDFs en el navegador |
| `react-markdown` | ^10.1.0 | Renderizado de Markdown |
| `react-syntax-highlighter` | ^16.1.0 | Resaltado de sintaxis de codigo |
| `radix-ui` | ^1.4.3 | Componentes accesibles sin estilo |
| `lucide-react` | ^0.575.0 | Iconos SVG |
| `class-variance-authority` | ^0.7.1 | Variantes de componentes |
| `tailwind-merge` | ^3.5.0 | Merge inteligente de clases Tailwind |
| `remark-gfm` | ^4.0.1 | GitHub Flavored Markdown |
| `remark-math` | ^6.0.0 | Formulas matematicas en Markdown |
| `rehype-katex` | ^7.0.1 | Renderizado de LaTeX con KaTeX |
| `gpt-tokenizer` | ^3.4.0 | Conteo de tokens para truncamiento de historial (encoding o200k_base) |

---

## Configuracion

### Variables de Entorno

```env
OPENAI_API_KEY=sk-...   # Clave de API de OpenAI (requerida)
```

### Scripts de NPM

| Script | Comando | Descripcion |
|--------|---------|-------------|
| `dev` | `next dev` | Servidor de desarrollo |
| `build` | `next build` | Compilar para produccion |
| `start` | `next start` | Iniciar en produccion |
| `lint` | `eslint` | Verificar errores de linting |
| `postinstall` | `cp node_modules/pdfjs-dist/...` | Copia el worker de PDF.js a `public/` automaticamente |

---

## Funcionalidades

1. **Chat conversacional** con multiples modelos y proveedores de IA
2. **Selector de modelos con panel de proveedores** (Popover): trigger a la derecha, panel con sidebar de iconos de proveedores a la izquierda y modelos agrupados por categoria a la derecha
3. **Streaming en tiempo real** con throttle de 50ms para rendimiento optimo
4. **Busqueda web integrada** con indicador visual y fuentes citadas
5. **Reasoning/Pensamiento** visible con summary en streaming
6. **Adjuntos multimodales** (imagenes y archivos de texto)
7. **RAG local en el navegador**: procesamiento de documentos (PDF, codigo fuente en ~60 extensiones, Jupyter Notebooks, TXT, etc.) con pipeline streaming completo en Web Worker (async generators), embeddings binarios via WebGPU/WASM, pipeline Matryoshka (384→256 dims) → cuantizacion binaria (256 bits → 32 bytes), auto-tuning de batch size (WebGPU: 128, WASM: 32), heuristicas para archivos grandes (chunks elasticos, filtrado de paginas ruido), fragmentacion inteligente por lenguaje (separadores jerarquicos tipo LangChain: funciones, clases, bloques con fallback a parrafos/oraciones), busqueda por distancia de Hamming con priorizacion de documentos recientes, persistencia en IndexedDB e inyeccion de contexto relevante al LLM
8. **Indexacion inmediata al adjuntar**: los documentos se procesan al adjuntarlos, no al enviar el mensaje, con indicador visual de progreso
9. **Bloqueo de envio durante indexacion**: el boton de enviar se deshabilita mientras hay documentos RAG en proceso
10. **Presupuesto dinamico de tokens por modelo**: el historial se trunca automaticamente cuando excede el presupuesto calculado como `ventanaContexto - maxTokensSalida - tokensSystemPrompt - tokensContextoRAG - margenSeguridad(512)`. El presupuesto es especifico por modelo (GPT-4o: 128K ventana; GPT-5.2: 200K; GPT-4.1: 1M). El system prompt se cuenta una sola vez (cache estatico). Los tokens RAG se cuentan en cada envio. Recorte por pares completos (usuario+asistente) via `gpt-tokenizer` (encoding `o200k_base`). Conserva al menos los ultimos 4 mensajes. Cache de conteo por contenido con FIFO eviction (max 500 entradas)
11. **Eliminacion de documentos RAG**: al quitar un adjunto, se elimina tambien su indice del almacen de vectores
12. **Edicion de mensajes** del usuario con recorte automatico del historial
13. **Regeneracion de respuestas** manteniendo contexto
14. **Reenvio de mensajes** con nueva respuesta
15. **Gestion de conversaciones** (crear, renombrar, eliminar, creacion lazy al enviar primer mensaje)
16. **Generacion automatica de titulos** en el primer intercambio
17. **Titulo flotante editable** sin header fijo, como boton absolute sobre el area de chat
18. **Markdown completo** con GFM, formulas matematicas KaTeX (pipeline de 5 pasos para normalizar LaTeX de LLMs), highlighting de codigo y auto-scroll inteligente
19. **Nombre del modelo** visible junto a los botones de accion del asistente
20. **Branding PenguinChat** con tipografia serif en la cabecera del sidebar
21. **Tarjetas de citacion** con preview de YouTube y favicons
22. **UI/UX moderna** estilo chat premium con tema blanco limpio, burbuja de usuario gris neutro, tipografia serif elegante en encabezados y tarjetas de archivo minimalistas tipo chip
23. **Truncado fiable en sidebar** con cadena defensiva de overflow y workaround para Radix UI ScrollArea issue #926
24. **Priorizacion de documentos recientes en RAG**: cuando el usuario adjunta un documento con su mensaje, los fragmentos de ese documento reciben un boost aditivo (+0.10) en la busqueda semantica, priorizandolos sobre documentos previamente indexados
25. **Soporte de Jupyter Notebooks (.ipynb)**: parsing semantico de celdas (markdown, codigo con salidas, raw) con separadores inteligentes que combinan headings de markdown y bloques de Python
26. **Tarjetas de archivo minimalistas** (`tarjeta-archivo.tsx`): componente reutilizable tipo chip con icono gris por categoria (FileText, FileCode, FileSpreadsheet), nombre truncado y extension en texto gris sutil, variante compacta (input) y expandida (burbuja), miniaturas compactas para imagenes y PDFs, boton eliminar en hover
27. **Miniaturas de PDF** (`use-miniatura-pdf.ts`): hook que renderiza la pagina 1 de PDFs a canvas offscreen via pdfjs-dist. Usa un caché global `Map<string, string>` devolviendo URLs ligeros tipo `URL.createObjectURL(blob)` en lugar de DataURLs pesados, con limpieza automática (`revokeObjectURL`) al eliminar una conversación.
28. **Agrupacion de mensajes por remitente**: mensajes consecutivos del mismo rol usan gap reducido (`mt-1.5` = 6px) vs gap normal entre roles diferentes (`mt-6` = 24px), creando agrupacion visual natural
29. **Modo edicion premium**: al editar un mensaje del usuario, la burbuja se expande a ancho completo con bordes interactivos que coinciden con la barra de entrada principal, transicion instantanea, botones de cancelar/enviar estilizados
30. **Avatar del asistente arriba del mensaje**: el SVG se posiciona encima del texto con `mb-3.5` de separacion, fuera del flujo flex del texto para que el contenido ocupe el ancho completo
31. **Indicadores de estado junto al avatar (estilo Gemini)**: layout en flex-col con fila superior (avatar + `BotonPensamiento`), contenido expandido debajo (ancho completo con `border-l-2`), y busqueda web debajo del pensamiento. Los componentes `BotonPensamiento` y `ContenidoPensamiento` estan separados para permitir este layout
32. **Listas sin indentacion (estilo Claude)**: `list-style-position: inside` + `padding-left: 0` + `li > p { display: inline }` para que las listas queden al ras del margen izquierdo sin indentacion en el primer nivel
33. **Razonamiento en el idioma del usuario**: system prompt instruye al modelo a razonar y pensar en el mismo idioma que usa el usuario (español si pregunta en español)
34. **Exclusión de archivos compilados en ESLint**: la carpeta `public/` fue ignorada vía `eslint.config.mjs` para evitar advertencias de variables no usadas producidas por librerías dependientes minificadas (como `pdf.worker.min.mjs`); manteniendo el proyecto en `0 warnings`.
35. **Sistema de artefactos** (panel lateral): bloques de codigo grandes (≥25 lineas), SVGs, HTML completo y bloques markdown se detectan automaticamente en el frontend y se muestran como tarjetas clickables en el chat. Al hacer click, se abre un panel lateral (45% desktop, 100% mobile) con syntax highlighting, boton de copiar, descarga y vista previa (HTML/SVG/Markdown). Deteccion puramente frontend sin modificar el modelo ni el system prompt.
36. **Panel de artefactos** (`panel-artefacto.tsx`): panel lateral con cabecera informativa (titulo, lenguaje, lineas), acciones (copiar, descargar, toggle preview, cerrar), `CodigoConResaltado` para visualizacion de codigo, `VistaPreviaArtefacto` (iframe sandboxed) para HTML/SVG, y `RenderizadorMarkdown` para preview de markdown. Animacion de entrada slide-in desde la derecha.
37. **Tarjeta de artefacto** en el chat: sustituye al bloque de codigo inline con una card minimalista mostrando icono dinamico por tipo (`ICONOS_ARTEFACTO`: `FileCode2`/`Globe`/`Image`/`FileText`) en fondo oscuro, titulo inferido del codigo, lenguaje y total de lineas. Al hacer click, abre el panel lateral via React Context (`useArtefacto`).
38. **Deteccion inteligente de artefactos**: heuristicas frontend que identifican SVGs (lenguaje o contenido `<svg`), HTML completo (`<!DOCTYPE`/`<html>`), markdown (lenguaje `markdown`/`md`), y codigo largo (≥25 lineas). Titulo inferido automaticamente de comentarios en la primera linea del codigo (`// app.tsx`, `# main.py`).
39. **React Context para artefactos** (`contexto-artefacto.tsx`): comunicacion entre `BloqueCodigoConResaltado` (emisor) y `PanelArtefacto` (receptor) sin prop drilling, con flag `estaDisponible` para funcionar sin Provider.
40. **Layout split responsive para artefactos**: en desktop el chat ocupa ~55% y el panel ~45% (max 700px). En mobile, el panel ocupa 100% y el chat se oculta (`hidden lg:flex`). Transicion animada con `duration-300`.
41. **Sync en tiempo real de artefactos durante streaming**: cuando el usuario abre un artefacto mientras el modelo esta generando, el panel se actualiza en vivo conforme llegan nuevos tokens. Se logra con un ID estable (`generarIdArtefacto` hashea solo los primeros 100 chars del codigo) y un `useEffect` en `BloqueCodigoConResaltado` que detecta si el artefacto activo corresponde a este bloque y sincroniza el contenido via `actualizarContenidoArtefacto()` del contexto.
42. **Modelo actualizado en edicion/reenvio/regeneracion**: al editar un mensaje y reenviarlo, el sistema usa el modelo seleccionado actualmente (no el que estaba seleccionado cuando se creo el mensaje original). Se logra leyendo `obtenerModeloSeleccionado()` directamente del store en vez de capturar el valor del closure de React, evitando stale closures causados por `React.memo`.
43. **Escritura durante streaming**: el textarea de entrada de mensajes permite escribir mientras el modelo esta generando una respuesta. Solo el envio y adjuntar archivos estan bloqueados durante streaming (`puedeEnviar` controla el boton y la tecla Enter), permitiendo al usuario preparar su siguiente mensaje.
44. **Auto-expansion del pensamiento al completarse**: cuando el modelo termina de pensar (transicion "pensando" → "completado"), el contenido del pensamiento se expande automaticamente para que no desaparezca. Solo se activa durante streaming en vivo, no para mensajes historicos. Usa el patron React de "ajustar estado durante el render" en vez de `useEffect` para cumplir con ESLint `react-hooks/set-state-in-effect`.
45. **Fondo claro completo en panel de artefactos**: el contenedor scrollable del panel tiene `bg-[var(--color-claude-sidebar)]` (`#f9f9f9`) condicional (solo en modo codigo, no en vista previa). El fondo claro llena toda la altura disponible desde el primer frame, incluso durante streaming cuando el codigo aun no ocupa todo el espacio. Patron estandar de Claude.ai y ChatGPT Canvas: el fondo del panel es consistente con el tema light de la app.
46. **Scrollbar horizontal fija al fondo del panel de artefactos**: el area de contenido del panel usa un patron `relative` + `absolute inset-0` (VS Code/Monaco pattern) para que los scrollbars siempre esten en los bordes del panel. El div exterior (`flex-1 min-h-0 relative`) define la altura via flexbox, el interior (`absolute inset-0 overflow-auto`) llena ese espacio y maneja el scroll. Esto garantiza que la barra horizontal este al fondo incluso para documentos cortos que no llenan la altura del panel.
47. **Scrollbars finas y consistentes**: scrollbars horizontales y verticales de 6px en toda la app (webkit: `height: 6px` + `width: 6px`; Firefox: `scrollbar-width: thin`). El panel de artefactos usa la scrollbar global (`#d1d5db`/`#9ca3af`) que se integra naturalmente con el fondo claro. Las formulas LaTeX (`katex-display`) heredan el estilo global de 6px para scroll horizontal.
48. **Flush del buffer residual en streaming**: al terminar el stream SSE (`done = true`), el cliente procesa cualquier dato restante en `bufferIncompleto` que no termine con `\n`. Esto previene perdida silenciosa del final de la respuesta cuando el ultimo chunk del servidor no incluye salto de linea final.
49. **`max_output_tokens` dinamico por modelo**: `route.ts` consulta `maxTokensSalida` del modelo seleccionado en `modelos.ts` (GPT-5.x/4.1: 32768, GPT-4o: 16384). Antes era un valor fijo de 16384 para todos los modelos. Los modelos GPT-5 soportan respuestas mas largas (~24000 palabras) sin truncamiento.
50. **Tema claro unificado** (`oneLight`): tanto los bloques de codigo inline (<25 lineas) como el panel de artefactos usan el tema `oneLight` de react-syntax-highlighter (fondo `hsl(230, 1%, 98%)` ≈ `#fafafb`, casi blanco). La barra superior usa `--color-claude-sidebar` y el borde usa `--color-claude-input-border`, coherentes con el tema blanco de la app. El panel usa fondo transparente delegando al contenedor (`--color-claude-sidebar` = `#f9f9f9`). Consistencia visual total entre inline y panel.
51. **Overflow delegado en panel de artefactos**: `CodigoConResaltado` (componente del panel) usa `overflow: "visible"` en su customStyle para anular el `overflow: "auto"` que el tema `oneLight` aplica al PreTag via `pre[class*="language-"]`. Esto delega el manejo de scroll al contenedor exterior (`absolute inset-0 overflow-auto`), garantizando que la scrollbar horizontal este fija al fondo del panel incluso para archivos cortos. Sin esta anulacion, react-syntax-highlighter crea una scrollbar anidada a la altura del contenido.
52. **Botones etiquetados en el panel de artefactos**: los botones de Copiar y Descargar en la cabecera del panel ahora incluyen etiquetas de texto (`hidden sm:inline`) ademas de los iconos, siguiendo el mismo patron del toggle de Preview/Codigo. Mejora la descubribilidad de las acciones en todos los modos (codigo y vista previa).
53. **Soporte de artefactos visuales**: bloques de codigo con lenguajes como `markdown`, `svg` o `html` se detectan y abren en modo preview por defecto en vez de mostrar raw syntax al inicio. El toggle Codigo/Preview permite alternar entre la vista renderizada y el raw con syntax highlighting.
54. **Iconos dinamicos por tipo de artefacto**: `TarjetaArtefacto` muestra un icono diferente segun el tipo de artefacto usando el mapa `ICONOS_ARTEFACTO`: `FileCode2` para codigo, `Globe` para HTML, `Image` para SVG, `FileText` para markdown. El icono mantiene fondo oscuro (`#1e1e1e`) con texto claro para contraste visual tipo VS Code icon badge.
55. **Modo preview por defecto segun tipo**: al abrir un artefacto, el panel establece automaticamente el modo vista previa segun su tipo: markdown, HTML y SVG abren en preview (renderizado); el código general abre en modo codigo (raw). Usa el patron React de "ajustar estado durante el render" con `prevIdArtefacto` para detectar cambios sin `useEffect`.
56. **Auto-Apertura Reactiva e Inteligente de Artefactos**: cuando un modelo genera (streaming) un artefacto de código grande (≥ 25 líneas) o un bloque interpretado (SVG, HTML), este necesita abrirse automáticamente. El gran reto arquitectónico es lograr esto sin *Prop Drilling* que perjudique la memoización de Markdown, ni variables globales que intercepten historiales antiguos. La solución (`lib/contexto-mensaje.tsx`) fue crear un ligerísimo **ContextoLocal** que envuelve puramente `RenderizadorMarkdown` de CADA mensaje. El componente `bloque-codigo.tsx` consume el Hook `useMensaje()` para saber si "su mensaje anfitrión se está generando ahora mismo". Todo ocurre localmente y sin re-renderizar masivamente nada más. 
57. **Preview Markdown sin iframe**: a diferencia de HTML/SVG que usan iframe sandboxed, el preview de markdown renderiza directamente con `RenderizadorMarkdown` (componente React puro). Esto preserva estilos de la app (`.prosa-markdown`), soporte de KaTeX, tablas GFM y bloques de codigo anidados. Los bloques de codigo dentro del markdown se renderizan via `BloqueCodigoConResaltado` y, si son ≥25 lineas, se muestran como `TarjetaArtefacto` clickable (sin recursion infinita gracias a `deshabilitarArtefacto` del panel).
58. **Fix "Maximum update depth exceeded" en sidebar**: el error ocurria porque `barra-lateral.tsx` usaba `{estaAbierta && (<>...</>)}` para renderizar condicionalmente TODO el contenido. Al abrir el sidebar, TODOS los componentes Radix (Tooltip + DropdownMenu por cada conversacion) se montaban simultaneamente, causando cascadas internas de `setState` que excedian el limite de React (`radix-ui@1.4.3` + React 19). **Fix**: se elimino el render condicional y se usa CSS (`overflow-hidden` + `w-0`) para ocultar el contenido cuando esta cerrado. Se agrega el atributo HTML5 `inert` cuando esta colapsado para prevenir focus/interaccion con teclado y screen readers. Beneficio adicional: la transicion CSS `w-64 → w-0` ahora tiene contenido para animar (antes montaba/desmontaba abruptamente). TypeScript workaround: `{ inert: true as unknown as boolean }` porque React 19 aun no exporta tipos perfectos para `inert`.
59. **Scroll al inicio al cambiar de artefacto en panel lateral**: el panel lateral de artefactos (`panel-artefacto.tsx`) usa un simple `useRef<HTMLDivElement>` + `useEffect` que ejecuta `scrollTop = 0` al cambiar de artefacto (dependencia: `artefactoActivo?.id`). Se elimino el hook `useScrollAlFondo` del panel porque su `MutationObserver` (que detecta cambios de `characterData` en el DOM) causaba scroll automatico al fondo en cada keystroke durante el modo edicion — el textarea muta el DOM, el observer lo detecta, y al tener `estaEnFondoRef = true` fuerza scroll al fondo. `useScrollAlFondo` permanece intacto en `area-chat.tsx` donde si se necesita para seguir el streaming de tokens.
60. **Paste de imagenes del portapapeles (Ctrl+V) y drag-and-drop local**: `entrada-mensaje.tsx` soporta tres metodos de adjuntar archivos: (1) file picker via boton de clip, (2) paste del portapapeles (`onPaste` en el textarea) que detecta archivos via `clipboardData.items` y solo previene el paste de texto si hay archivos, (3) drag-and-drop local (`onDragOver`/`onDragLeave`/`onDrop` en el contenedor del input) con feedback visual (borde punteado + fondo tintado). Ademas, acepta archivos desde el drag-and-drop global de `ContenedorChat` via props `archivosExternos` / `alLimpiarArchivosExternos`, procesados con un `useEffect`. La funcion compartida `procesarArchivos()` (async) centraliza la logica: las imagenes se preprocesan con `preprocesarImagen()` (resize + compress), los demas archivos se leen con `FileReader.readAsDataURL`. Validacion por extension via `esArchivoSoportado()` (de `separadores-codigo.ts`) y limite de adjuntos. El `manejarDragLeave` usa `relatedTarget` para evitar falsos negativos al mover el cursor entre elementos hijos del contenedor.
61. **Limite de 10 adjuntos por mensaje**: constante `MAXIMO_ADJUNTOS = 10` que limita la cantidad total de archivos/imagenes por mensaje. Se aplica en tres puntos: (1) `procesarArchivos()` calcula el espacio disponible y solo procesa archivos que caben, (2) el callback de `establecerAdjuntos` verifica el limite antes de agregar, (3) el boton de adjuntar archivo se deshabilita cuando se alcanza el limite (`disabled={adjuntos.length >= MAXIMO_ADJUNTOS}`). Funciona identicamente para file picker, paste, drag-and-drop local y drag-and-drop global.
62. **Lightbox/modal para ver imagenes** (`lightbox-imagen.tsx`): componente ligero usando `createPortal` a `document.body` con overlay semi-transparente (`bg-black/80 backdrop-blur-sm`). Se cierra con Escape (via `addEventListener("keydown")`), click fuera de la imagen, o boton X. Bloquea el scroll del body (`overflow: hidden`) mientras esta abierto. Se integra en `tarjeta-archivo.tsx`: las imagenes siempre muestran `cursor-pointer` y abren el lightbox al hacer click, en ambas variantes (compacta y expandida). El boton eliminar usa `e.stopPropagation()` para no disparar el lightbox. El boton X de imagenes usa `!bg-black/60 hover:!bg-black/80` con `!text-white` y `ring-1 ring-white/30` para mantener contraste sobre fondos oscuros (los `!important` previenen que `variant="ghost"` de shadcn sobreescriba colores en hover).
63. **Drag-and-drop global de archivos** (`contenedor-chat.tsx`): handlers `onDragOver`/`onDragLeave`/`onDrop` en el div raiz de `ContenedorChat` permiten arrastrar archivos desde el explorador de archivos del OS a cualquier parte de la pagina. Un overlay visual (`fixed inset-0 z-50 border-2 border-dashed pointer-events-none`) muestra la zona de drop activa. Solo se activa si `evento.dataTransfer.types` incluye "Files" (ignora drag de texto). Los archivos dropeados se almacenan en `archivosDropeados` state y se pasan a `EntradaMensaje` via props `archivosExternos` / `alLimpiarArchivosExternos`. `EntradaMensaje` los procesa via un `useEffect` que llama `procesarArchivos()` y limpia el state del padre. Compatible con los metodos existentes (file picker, paste, drag-and-drop local en el input).
64. **Fix hydration error de Radix UI Popover** (`entrada-mensaje.tsx`): el Popover del selector de modelos causaba un error de hidratacion (`aria-controls` ID mismatch) porque Radix UI genera IDs internos diferentes en SSR vs cliente. **Fix**: deferred mounting con `estaMontado` state + `useEffect(() => set(true), [])`. El Popover solo se renderiza despues del primer mount en cliente; durante SSR se muestra un `<span>` con el nombre del modelo como placeholder. Esto preserva el textarea visible durante SSR (mejor FCP) sin romper la hidratacion.
65. **Fix validacion de archivos adjuntos** (`entrada-mensaje.tsx`): la validacion anterior usaba `TIPOS_ACEPTADOS` (un Set de extensiones como `.pdf`) y comparaba contra `archivo.type` (un MIME type como `application/pdf`). Nunca coincidian, rechazando silenciosamente todos los archivos no-imagen con MIME type definido (PDFs, JSON, etc.). Los archivos de codigo (.ts, .py) pasaban por accidente porque su `archivo.type` es vacio en navegadores. **Fix**: se reemplazo la validacion por MIME type con `esArchivoSoportado(archivo.name)` de `separadores-codigo.ts`, que valida correctamente por extension de archivo, nombres conocidos (Dockerfile, Makefile) y lista negra. Se elimino el Set `TIPOS_ACEPTADOS` (ya no se necesita).
66. **LaTeX Preview con convertidor LaTeX→Markdown**: los bloques de codigo con lenguaje `latex` o `tex` se detectan como artefactos visuales y se abren en modo preview por defecto. Como KaTeX solo renderiza formulas matematicas (no documentos completos), el preview usa `convertirLatexAMarkdown()`, un convertidor ligero de 11 pasos en `panel-artefacto.tsx` que transforma la estructura del documento LaTeX a Markdown: extrae body de `\begin{document}`, convierte `\section`→`##`, `\textbf`→`**`, `\textit`→`*`, listas enumerate/itemize→bullets markdown, entornos math (equation/align/gather)→`$$...$$`, y limpia preambulo/espaciado/caracteres especiales. Las formulas inline `$...$` y display `$$...$$` se preservan intactas para KaTeX. No requirio dependencias nuevas. Se agrego `"latex"` a `TipoArtefacto` en `tipos.ts` y el icono `Sigma` al mapa `ICONOS_ARTEFACTO`.
67. **Edicion en vivo de artefactos con syntax highlighting (editor overlay)**: todos los artefactos (codigo, HTML, SVG, markdown, LaTeX) son editables directamente en el panel lateral con un editor que preserva syntax highlighting durante la escritura. El boton de lapiz (`Pencil` de lucide-react) alterna entre el modo edicion y la vista normal. La implementacion usa el patron overlay (inspirado en `react-simple-code-editor`): un `<textarea>` HTML con texto transparente (`color: transparent`, `-webkit-text-fill-color: transparent`) superpuesto `absolute` sobre `CodigoConResaltado` con tema oneLight. El cursor permanece visible via `caret-color: var(--color-claude-texto)`, y la seleccion es visible via `selection:bg-blue-300/30`. Los estilos criticos (fontFamily, fontSize, lineHeight, padding, tabSize) estan sincronizados pixel-a-pixel en la constante `ESTILOS_EDITOR` con los mismos valores que `oneLight` + `estiloCodigoPanel` de `bloque-codigo.tsx`. Tab inserta 2 espacios sin perder foco (via `requestAnimationFrame` para restaurar el cursor). Las ediciones viven en un buffer local (`contenidoEditado`) desacoplado del React Context para evitar que el sync effect de streaming las revierta. Al salir de edicion, si hubo cambios, se persisten al contexto via `actualizarContenidoArtefacto(contenidoEditado, lineasEditadas)`, actualizando el `artefactoActivo` global. Esto permite que el preview (markdown, LaTeX, HTML, SVG) refleje inmediatamente los cambios del usuario. El panel restaura automaticamente el modo adecuado (preview para visuales, codigo para programaticos).
68. **Fix boton X invisible en hover sobre imagenes** (`tarjeta-archivo.tsx`): el boton eliminar usaba `variant="ghost"` de shadcn que aplica `hover:bg-accent hover:text-accent-foreground` en hover, sobreescribiendo `bg-black/60` y `text-white` y haciendo la X invisible sobre imagenes. **Fix**: se agregaron modificadores `!important` de Tailwind (`!bg-black/60`, `hover:!bg-black/80`, `!text-white`) para que los estilos custom prevalezcan sobre los de la variante ghost. Aplicado a los 3 botones X del componente (imagenes, PDFs, y archivos genericos).
69. **Previsualizacion de imagenes mas grande** (`tarjeta-archivo.tsx`): el tamano de previsualizacion de imagenes adjuntas en la variante compacta (area de input) se aumento de `h-20 w-20` (80px) a `h-32 w-32` (128px) para mejor visibilidad. La variante expandida (burbuja de mensaje) se mantiene en `h-24 w-24` (96px).
70. **Persistencia de almacenamiento IndexedDB** (`almacen-vectores.ts`): se solicita `navigator.storage.persist()` al inicializar el almacen de vectores RAG para evitar que el navegador elimine datos de IndexedDB bajo presion de almacenamiento. Los navegadores modernos conceden persistencia automaticamente para sitios con engagement frecuente o PWAs instaladas.
71. **Liberacion de memoria PDF.js** (`worker-embeddings.ts`): el Web Worker llama `docPDF.destroy()` en un bloque `finally` al terminar de procesar cada PDF, liberando caches internas de paginas, fuentes e imagenes decodificadas que de otro modo se acumularian indefinidamente en la memoria del Worker. Con PDFs grandes (100+ paginas), esto evita acumular cientos de MB.
72. **Contexto RAG con estructura XML** (`procesador-rag.ts`): la inyeccion de contexto RAG al prompt usa tags XML (`<contexto-documentos>`, `<fragmento>`, `<instruccion>`) en vez de delimitadores de texto plano (`---`). Cada fragmento incluye metadata como atributos XML (`indice`, `fuente`, `posicion`). La instruccion de uso se coloca al final del bloque (posicion de recencia) para maximizar la atencion del modelo, siguiendo hallazgos del paper "Lost in the Middle" (Liu et al., 2023). El formato XML es mas compacto y crea limites estructurales fuertes que los LLMs atienden mejor.
73. **Mapa de redirecciones RAG** (`almacen-vectores.ts`): al transferir documentos de un ID temporal a una conversacion real (`transferirDocumentos`), se registra una redireccion en un `Map<string, string>`. Todas las funciones publicas del almacen (`obtenerDocumentos`, `actualizarDocumento`, `eliminarDocumento`, `buscarFragmentosSimilares`, `tieneFragmentosListos`, `obtenerEstadisticas`) resuelven el ID via `resolverIdConversacion()` antes de acceder al Map principal. Esto evita una race condition donde callbacks asincrónicos del Web Worker (que aun referencian el ID temporal) perdian silenciosamente actualizaciones de estado y embeddings, dejando documentos permanentemente en estado "vectorizando".
74. **Preprocesamiento de imagenes** (`lib/preprocesar-imagen.ts`): las imagenes adjuntadas se redimensionan y comprimen automaticamente antes de almacenarse en el estado de React. Usa `createImageBitmap(archivo, { imageOrientation: 'from-image' })` para manejar orientacion EXIF, escala proporcionalmente a max 2048px en el lado mayor, y comprime con `OffscreenCanvas.convertToBlob()` (JPEG 0.85 para fotos, WebP 0.92 para PNGs/capturas). Imagenes pequeñas (<1024px en ambas dimensiones) y GIFs pasan sin modificacion. Reduce fotos de iPhone 15 Pro (48MP, ~15MB) a ~200-400KB, evitando congelamiento de UI, uso excesivo de memoria JS y timeouts en fetch POST. La API de OpenAI redimensiona internamente a 2048px, asi que no hay perdida de calidad efectiva.
75. **Constantes compartidas cliente/servidor** (`lib/constantes.ts`): el system prompt `INSTRUCCIONES_SISTEMA` y la definicion de herramientas `HERRAMIENTAS_CHAT` se extraen a un modulo compartido importado tanto por `route.ts` y `continuar/route.ts` (servidor, parametros `instructions` y `tools` de la Responses API) como por `contenedor-chat.tsx` (cliente, conteo de tokens para presupuesto dinamico). Evita duplicacion y garantiza consistencia. La definicion de herramientas incluye `web_search` y `ejecutar_codigo` con preferencia explicita por JavaScript.
76. **Limpieza de datos RAG al eliminar conversacion** (`almacen-vectores.ts`): `limpiarDatosConversacion(id)` elimina documentos del Map en memoria, limpia redirecciones del mapa de redirecciones que apuntan a ese ID (previniendo memory leak por acumulacion indefinida de entradas), y elimina datos de IndexedDB. Se llama desde `contenedor-chat.tsx` via `manejarEliminarConversacion` antes de `eliminarConversacion` del store. Complementa la limpieza de miniaturas PDF que ya existia en `almacen-chat.ts`.
77. **Fix colision de IDs de artefactos** (`bloque-codigo.tsx`, `renderizador-markdown.tsx`): `generarIdArtefacto()` ahora recibe `posicionOrigen` (el offset del bloque de codigo en el markdown fuente, via `node.position.start.offset` de react-markdown). Se mezcla en el hash DJB2 junto con los primeros 100 chars del contenido. Previene colisiones entre bloques con prefijo identico (ej: dos componentes React con los mismos imports) sin afectar la estabilidad del ID durante streaming (el offset del opening ``` no cambia al appendear tokens).
78. **Fix memory leak de ObjectURLs en miniaturas PDF** (`entrada-mensaje.tsx`): `eliminarAdjunto()` ahora llama `limpiarCacheMiniaturaPDF(id)` antes de filtrar el adjunto del estado. Revoca el ObjectURL y elimina la entrada del cache global `cacheMiniatura`. Solo se ejecuta al click del boton X (no al enviar mensaje, donde `establecerAdjuntos([])` limpia sin llamar `eliminarAdjunto`). Es no-op si el adjunto no era PDF.
79. **Cola de serializacion del Worker RAG** (`motor-embeddings.ts`): `procesarArchivoCompleto()` serializa el envio de archivos al Worker mediante un mutex (`archivoEnProceso`) y cola FIFO (`colaArchivos`). Solo un archivo se procesa en el Worker a la vez; al soltar multiples archivos simultaneamente, cada uno espera su turno. La decodificacion base64 ocurre fuera de la cola. Previene interleaving de inferencia ONNX concurrente que podria causar errores o comportamiento indefinido.
80. **Two-Stage Retrieval** (`almacen-vectores.ts`, `worker-embeddings.ts`, `motor-embeddings.ts`, `tipos.ts`): la busqueda RAG ahora usa un modelo de recuperacion en dos fases inspirado en sistemas como Pinecone y Vespa. **Fase 1**: filtrado rapido por distancia de Hamming binaria (32 bytes) que selecciona los top 50 candidatos en nanosegundos por fragmento. **Fase 2**: re-ranking preciso con cosine similarity sobre vectores Float32 Matryoshka(256 dims) para elegir los 10 definitivos. El Float32 truncado que el pipeline ya calculaba como paso intermedio (linea 440 de `worker-embeddings.ts`) ahora se preserva y envia al hilo principal via Transferable Objects junto al binario. `FragmentoDocumento` tiene un campo opcional `embeddingFloat?: Float32Array` (backward compatible con docs existentes en IndexedDB). `generarEmbedding()` retorna `EmbeddingConsulta { binario, float }` con ambas representaciones. Costo: 1KB extra por fragmento (256×4 bytes), ~0.1ms extra por busqueda (50 dot products). Como los vectores Matryoshka estan pre-normalizados, dot product = cosine similarity (sin necesidad de re-normalizar).
81. **Proteccion contra bucles infinitos en iframe** (`panel-artefacto.tsx`): `VistaPreviaArtefacto` inyecta un script de heartbeat en el `srcDoc` del iframe. El padre envia pings cada 2s via `postMessage`; si no recibe respuesta en 5s, muestra overlay "dejo de responder" con boton "Recargar" que destruye y recrea el iframe via React `key`. Patron inspirado en CodeSandbox. Protege contra codigo LLM con loops infinitos (`while(true)`) que bloquearian el event loop del iframe.
82. **Fix crash por tokens especiales en conteo de tokens** (`contenedor-chat.tsx`): `contarTokensMensaje()` llamaba a `countTokens(contenido)` de `gpt-tokenizer` sin opciones, lo que causaba un error de runtime `Disallowed special token found: <|endoftext|>` cuando el contenido de un mensaje incluia tokens especiales literales (ej: conversaciones sobre tokenizacion, prompts o formato interno de modelos). **Fix**: se pasa `{ allowedSpecial: 'all' }` como segundo argumento a `countTokens()`. Es seguro porque la funcion solo se usa para estimar el tamano del historial para truncamiento dinamico, no para enviar tokens al modelo. Los tokens especiales en el texto son texto literal del usuario/asistente, no instrucciones de control.
83. **Fix editor de artefactos no dejaba editar (feedback loop)** (`panel-artefacto.tsx`): al escribir en el editor overlay del panel de artefactos, el texto se revertia instantaneamente al original, haciendo el editor inutilizable. **Causa raiz**: `manejarCambioEdicion` escribia al React Context (`actualizarContenidoArtefacto`), lo que disparaba el sync effect de `BloqueCodigoConResaltado` (bloque-codigo.tsx:409-413) — diseñado para sincronizar streaming→panel — que detectaba discrepancia entre el contenido editado y el `codigo` original del markdown y lo revertia. En desktop el chat permanece montado (`hidden lg:flex`) cuando el panel esta abierto, manteniendo el effect activo. **Fix**: las ediciones ahora viven en un buffer local `contenidoEditado` (estado `useState<string | null>`) completamente desacoplado del contexto. Al entrar en edicion se inicializa desde `artefactoActivo.contenido`; al salir se descarta (`null`). La variable derivada `contenidoActual = contenidoEditado ?? contenido` alimenta textarea, capa visual, copy, download, preview y conteo de lineas. `actualizarContenidoArtefacto` ya no se importa en el panel. El sync effect de streaming queda intacto en `bloque-codigo.tsx` sin modificaciones. Patron inspirado en `react-simple-code-editor` donde el estado de edicion es local y los props externos no lo sobreescriben.
84. **Ejecucion local de codigo en el navegador** (`lib/ejecutor-codigo.ts`, `lib/worker-pyodide.ts`): motor de ejecucion en dos capas que soporta JavaScript/TypeScript (iframe sandboxed aislado, nuevo por cada ejecucion) y Python (Web Worker dedicado con Pyodide WASM). JavaScript se ejecuta via `eval()` dentro de un iframe con `sandbox="allow-scripts"` y CSP que bloquea red (`default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'`). Captura `console.log/error/warn/info` via `postMessage` con identificador `ORIGEN_SANDBOX`. Python se ejecuta en un **Web Worker dedicado** (`worker-pyodide.ts`) con Pyodide (~11MB WASM), carga lazy al primer uso, cache persistente via Cache API dentro del Worker, redireccion de stdout/stderr via `postMessage`, carga automatica de paquetes (`loadPackagesFromImports`), y override de `input()`/`sys.stdin`. El hilo principal actua como manager: crea el Worker, le envia codigo, recibe resultados, y lo termina con `worker.terminate()` si excede el timeout de 30 segundos (funciona porque WASM corre en el Worker, no en el hilo principal). El timeout solo aplica a la ejecucion del codigo, no a la carga de Pyodide (que puede tomar mas tiempo en la primera descarga). `ejecutarCodigo()` acepta un callback opcional `alIniciarEjecucion` que se invoca cuando el runtime esta listo y la ejecucion comienza, permitiendo a la UI transicionar de "Cargando Python..." a "Ejecutando..." en tiempo real. Lenguajes soportados: `javascript`, `js`, `typescript`, `ts`, `jsx`, `tsx`, `python`, `py`. **Soporte matplotlib**: el Worker envuelve el codigo del usuario en `try/except/finally` via `construirCodigoPython()`: el preamble configura matplotlib Agg, el except captura excepciones con traceback, y el finally SIEMPRE captura figuras matplotlib como PNG base64 (incluso si el codigo lanzo una excepcion). Las imagenes se imprimen con marcador `__IMG_BASE64__:` que `postProcesarImagenes()` en el hilo principal convierte en entradas tipo `"imagen"` con data URL renderizable.
85. **Cache persistente de Pyodide via Cache API** (`lib/worker-pyodide.ts`): estrategia cache-first para Pyodide WASM y paquetes Python, ejecutada **dentro del Web Worker** (Cache API funciona en Workers). `fetchConCache()` intercepta todas las descargas: primero busca en `caches.open("pyodide-v0.27.5")`, si hay hit retorna sin red, si no descarga y guarda en cache. Se integra en `loadPyodide()` via el parametro `fetch`, cacheando automaticamente el WASM (~11MB), scripts JS y paquetes `.whl`. Se solicita `navigator.storage.persist()` desde el hilo principal (manager en `ejecutor-codigo.ts`) al crear el Worker, ya que la API de persistencia de almacenamiento no esta disponible desde Workers. Despues de la primera descarga, las cargas subsiguientes son instantaneas desde cache.
86. **Boton Ejecutar en bloques de codigo** (`bloque-codigo.tsx`, `panel-artefacto.tsx`): para lenguajes ejecutables (JS/TS/Python), tanto los bloques inline (<25 lineas) como los artefactos (>=25 lineas) muestran un boton "Ejecutar" (icono `Play`). En bloques inline, el handler `manejarEjecutarEnArtefacto` usa `abrirYEjecutarArtefacto()` del contexto, que recibe el artefacto como parametro y ejecuta directamente sin depender del estado de React — eliminando la race condition del patron anterior (`setTimeout(50ms)` + `ejecutarArtefacto()`). En artefactos ya abiertos, el boton esta directamente en la cabecera del panel. Los lenguajes no ejecutables (Go, Rust, CSS, etc.) no muestran el boton. **Validacion de imports**: para Python, si `validarImportsPython()` detecta imports no disponibles en Pyodide, el boton Ejecutar se oculta tanto en los bloques inline como en el panel de artefactos. **Ocultar con `input()`**: si el codigo Python usa `input()` (detectado por `detectarUsoInput()`), el boton se oculta completamente en vez de mostrarse deshabilitado, ya que `input()` no esta disponible en WASM. **Ejecucion per-bloque**: el boton Ejecutar esta siempre habilitado para bloques completos, incluso durante streaming de otros bloques. react-markdown solo renderiza bloques con fence de cierre (` ``` `), por lo que un bloque renderizado siempre contiene codigo completo. Se elimino `ejecucionDeshabilitada = estaGenerandose` que bloqueaba TODOS los botones durante cualquier streaming.
87. **Consola de resultados en panel de artefactos** (`panel-artefacto.tsx`): componente `ConsolaResultados` con tema claro posicionado en la parte inferior del panel sobre un divisor (`border-t`). Barra de estado colapsable con icono animado (spinner durante ejecucion, circulo coloreado despues), duracion en ms y chevron de toggle. Area scrollable (`max-h-48`) con font mono `text-xs`. Colores por tipo: stdout negro, stderr ambar (`text-amber-600`), resultado verde (`text-emerald-600`), error rojo (`text-red-600`). Auto-scroll via `useEffect` que hace `scrollTop = scrollHeight` al cambiar salidas. Solo visible si hay ejecucion activa o hay salida.
88. **Herramienta `ejecutar_codigo` via function calling** (`route.ts`, `contenedor-chat.tsx`): los modelos AI pueden invocar la funcion `ejecutar_codigo` con parametros `{lenguaje, codigo}` durante la generacion de respuesta. El backend define la herramienta con `strict: true` en el array de tools de la Responses API de OpenAI. Cuando el modelo emite un function call, el backend usa el evento `response.output_item.done` con `item.type === "function_call"` para extraer `name`, `arguments` y `call_id` del item completo (NOTA: el evento `response.function_call_arguments.done` solo contiene `arguments` e `item_id`, NO `name` ni `call_id`). El backend envia un evento SSE `tool_call` al frontend con `nombre`, `argumentos`, `callId` e `idRespuesta`, y cierra el stream. El frontend parsea los argumentos, inserta el bloque de codigo en el texto del asistente, ejecuta localmente via `ejecutarCodigo()`, y envia el resultado al modelo via `/api/chat/continuar` para que continue generando.
89. **Endpoint de continuacion tras tool call** (`app/api/chat/continuar/route.ts`): endpoint POST que recibe `{idRespuesta, callId, resultado, modelo}` y continua la respuesta del modelo usando `previous_response_id` de la Responses API de OpenAI. Envia el resultado como `function_call_output` con el `call_id` correspondiente. Mismo patron de streaming SSE, mismas herramientas (web_search + ejecutar_codigo), mismo system prompt y reasoning condicional que `/api/chat`. Soporta encadenamiento recursivo: si el modelo hace otro tool call durante la continuacion, el frontend puede encadenar de nuevo.
90. **Orquestacion de tool calls via panel de artefactos** (`contenedor-chat.tsx`): funcion `manejarToolCall` anidada dentro de `enviarConsultaAlModelo` que gestiona el ciclo de vida completo de las invocaciones de herramientas del modelo. Cuando el modelo emite un tool call `ejecutar_codigo`, el handler: (1) parsea argumentos JSON `{lenguaje, codigo}`, (2) inserta un code fence con pseudo-lenguaje (`` ```ejecutando:python ``) en el markdown del chat, que `BloqueCodigoConResaltado` renderiza como componente `IndicadorEjecucion` premium (tarjeta con icono Terminal pulsante y dots animados), (3) abre el panel de artefactos con el codigo y ejecuta atomicamente via `abrirYEjecutarArtefacto()` del contexto — el usuario ve el codigo y `ConsolaResultados` mientras ejecuta, (4) al terminar, reemplaza el indicador temporal (via regex `/```ejecutando:[^\n]*\n```\n\n/`) con un bloque de codigo marcado (`@ejecutado-por-modelo exito/error duracionMs salidasJSON`) que se renderiza como `TarjetaEjecucion` + bloque de resultado formateado, (5) cierra el panel despues de 800ms de delay, (6) llama `enviarContinuacionConStreaming()` para que el modelo continue generando con el resultado. El marcador ahora serializa el resultado completo (salidas JSON + duracion) en la primera linea del bloque, permitiendo restaurar la consola al reabrir la tarjeta. Gestiona correctamente el texto acumulado (`ultimoTextoContinuacion`) para no perder contenido entre el texto principal y la continuacion. Soporta encadenamiento recursivo con limite de profundidad (`MAX_TOOL_CALLS_ENCADENADOS = 5`). Si el tool name es desconocido, limpia `estaEscribiendo` y `referenciaControlador` para evitar bloqueo permanente. Si la ejecucion falla, reemplaza el indicador con un mensaje de error especifico. Si el usuario cancela durante la ejecucion, cierra el panel y limpia estado. **Patron awaitable**: `alToolCall` retorna `Promise<void>` y es `await`-eado en el stream SSE, integrando toda la cadena de tool calls (ejecucion + continuacion + encadenamientos) dentro del contexto de errores de `enviarMensajeConStreaming`. Esto implementa 4 capas de seguridad (defense-in-depth): (1) `alFinalizar` en continuacion, (2) `alError` en continuacion, (3) try-catch en `manejarToolCall`, (4) try-catch externo en `enviarMensajeConStreaming` que captura errores propagados desde `await alToolCall`.
91. **Protocolo SSE extendido para tool calls** (`cliente-chat.ts`): el cliente de streaming maneja eventos `tool_call` con `await alToolCall?.(...)` seguido de `return`. El `await` integra toda la cadena de tool calls (ejecucion local + continuacion + posibles encadenamientos) dentro del contexto de `enviarMensajeConStreaming`, permitiendo que el try-catch externo capture cualquier error no manejado. El tipo de `alToolCall` es `void | Promise<void>` para soportar tanto callbacks sincronos como async. Si el evento `tool_call` llega con campos faltantes (nombre, argumentos, callId o idRespuesta vacios), se llama `alFinalizar()` para limpiar el estado de `estaEscribiendo` y evitar que la app se quede "pegada". La funcion `enviarContinuacionConStreaming()` reutiliza el mismo patron de parsing SSE con callbacks reducidos (`alActualizar`, `alFinalizar`, `alError`, `alToolCall`) y soporta encadenamiento. Los callbacks de `alToolCall` en encadenamientos deben retornar la Promise (`return manejarToolCall(...)`) para mantener el patron awaitable.
92. **System prompt con instrucciones de ejecucion de codigo y preferencia por JavaScript** (`lib/constantes.ts`): seccion `CODE EXECUTION` en `INSTRUCCIONES_SISTEMA` que instruye al modelo a **SIEMPRE usar JavaScript por defecto** y solo usar Python cuando se necesiten librerias cientificas especificas (numpy, scipy, pandas, sympy, sklearn, matplotlib). Explica que JavaScript se ejecuta instantaneamente en un iframe sandboxed mientras Python requiere cargar Pyodide (~11MB WASM). Incluye guias claras de cuando usar cada lenguaje, paquetes Python disponibles, timeout de 30 segundos, y cuando NO usar la herramienta (operaciones triviales). `HERRAMIENTAS_CHAT` exporta la definicion de herramientas compartida entre ambas rutas API, eliminando duplicacion. El system prompt se comparte entre servidor (parametro `instructions` de la Responses API) y cliente (conteo de tokens para presupuesto dinamico). Incluye secciones: (1) MATH FORMATTING: delimitadores LaTeX; (2) RESPONSE STRUCTURE: listas y headers; (3) LANGUAGE: razonar en el idioma del usuario; (4) CODE EXECUTION: preferencia JavaScript, cuando usar/no usar la herramienta, timeout 30s; (5) CRITICAL RESTRICTIONS: prohibiciones explicitas de `input()`, `plt.show()`, `time.sleep()`, threads/procesos, shell commands, network requests; (6) Available Python packages: lista de stdlib y cientificos disponibles en Pyodide, y lista de paquetes NO disponibles
93. **Estado de ejecucion en React Context** (`contexto-artefacto.tsx`): el contexto de artefactos gestiona `estadoEjecucion` (`"inactivo"` | `"cargando"` | `"ejecutando"` | `"completado"` | `"error"`), `resultadoEjecucion` (`ResultadoEjecucion | null`), `ejecutarArtefacto()` (funcion async para ejecucion manual del usuario) y `abrirYEjecutarArtefacto()` (operacion atomica para tool calls del modelo que retorna `ResultadoEjecucion`). Usa `refEjecucionExterna` (useRef) para proteger ejecuciones de tool calls contra interferencia del auto-open de `bloque-codigo.tsx`: cuando es `true`, `abrirArtefacto()` se convierte en no-op. El estado inicial de ejecucion se determina segun si Pyodide necesita cargarse. Se limpia automaticamente al cerrar el panel. **Restauracion de resultados previos**: `abrirArtefacto()` ahora verifica si el artefacto incluye `resultadoPrevio` (campo opcional de tipo `ResultadoEjecucion`); si existe, restaura `resultadoEjecucion` y establece `estadoEjecucion` a `"completado"` o `"error"` segun `resultadoPrevio.exito`. Esto permite que `TarjetaEjecucion` (bloques ejecutados por el modelo) restauren la consola con salidas, duracion y estado al reabrir el artefacto, sin necesidad de re-ejecutar el codigo.
94. **Indicador de ejecucion premium durante tool calls** (`bloque-codigo.tsx`, `contenedor-chat.tsx`): cuando el modelo invoca `ejecutar_codigo`, `contenedor-chat.tsx` inserta un code fence con pseudo-lenguaje (`` ```ejecutando:python ``) en el markdown del chat. `BloqueCodigoConResaltado` detecta lenguajes que empiezan con `"ejecutando:"` y renderiza el componente `IndicadorEjecucion` en vez de un bloque de codigo normal. `IndicadorEjecucion` es una tarjeta neutral con la misma estructura visual que `TarjetaArtefacto` y `TarjetaEjecucion`: fondo `--color-claude-sidebar`, icono `Terminal` pulsante (`animate-pulse`) en fondo oscuro `#1e1e1e`, texto "Ejecutando {lenguaje}" con tres dots animados (reutiliza `.punto-cargando` de globals.css), y subtitulo "Procesando codigo". La clase CSS `.indicador-ejecutando` aplica animacion de entrada suave (reutiliza keyframe `entrada-burbuja`). Al completar la ejecucion, el code fence temporal se reemplaza por el bloque marcado con `@ejecutado-por-modelo` que se renderiza como `TarjetaEjecucion`.
95. **Resultado de ejecucion visible en el chat** (`contenedor-chat.tsx`): despues de ejecutar un tool call, el resultado se muestra formateado al usuario directamente en el texto del mensaje del asistente. **Formato inteligente**: resultados cortos (1-3 lineas) se muestran como markdown inline ("**Resultado:** 42") para que formulas, formato y expresiones matematicas se rendericen correctamente. Resultados largos (4+ lineas) se muestran en code fence ("**Resultado:**\n```...```") para legibilidad. Errores siempre usan code fence ("**Error de ejecucion:**\n```...```"). Antes, todos los resultados usaban code fence, impidiendo el renderizado de formulas.
96. **Pre-validacion de imports Python contra whitelist** (`ejecutor-codigo.ts`): antes de ejecutar codigo Python via Pyodide, `validarImportsPython()` extrae los top-level imports del codigo via regex y los valida contra `PAQUETES_PYODIDE_DISPONIBLES` (Set con ~90 paquetes: stdlib + cientificos). Si hay paquetes no disponibles, retorna error claro (`"Paquete(s) no disponible(s) en Pyodide: ..."`) en vez del criptico `ModuleNotFoundError` de Pyodide. Ademas, `loadPackagesFromImports` se ejecuta dentro de try-catch para capturar errores de carga de paquetes. Esta doble validacion (whitelist + try-catch) hace el sistema robusto contra paquetes desconocidos.
97. **Limite de recursion para tool calls encadenados** (`contenedor-chat.tsx`): constante `MAX_TOOL_CALLS_ENCADENADOS = 5` que limita la profundidad de tool calls recursivos. Cuando el modelo ejecuta codigo, recibe el resultado, y vuelve a ejecutar codigo (encadenamiento), el parametro `profundidad` se incrementa en cada nivel. Al alcanzar el limite, se inserta un mensaje informativo ("*Se alcanzo el limite de ejecuciones encadenadas.*") y se finaliza la generacion limpiamente. Previene loops infinitos donde el modelo podria encadenar tool calls indefinidamente.
98. **TarjetaEjecucion — registro visual de tool calls en el chat** (`bloque-codigo.tsx`): componente especial que reemplaza los bloques de codigo marcados con `@ejecutado-por-modelo` (comentario en la primera linea). Diseno neutral monocromatico consistente con `TarjetaArtefacto`: misma estructura de 3 columnas (icono + texto + flecha), fondo `--color-claude-sidebar` con hover `--color-claude-sidebar-hover`, borde `--color-claude-input-border`, icono `Terminal` en fondo oscuro `#1e1e1e`. El estado se indica con un punto de color sutil (`●` emerald-500 para exito, red-500 para error) junto al nombre del lenguaje, en vez de badges o gradientes coloreados. Subtitulo muestra conteo de lineas y "Codigo del modelo". `ChevronRight` aparece en hover (opacity transition) como en `TarjetaArtefacto`. Click abre el artefacto en el panel lateral via `abrirArtefacto()` pasando `resultadoPrevio` (parseado del marcador serializado), lo que restaura la consola con salidas y duracion sin re-ejecutar. La deteccion usa regex `REGEX_MARCADOR_EJECUCION` con 3 grupos adicionales: estado (`exito`/`error`), duracion en ms, y salidas como JSON. La primera linea (marcador) se elimina del codigo mostrado.
99. **Sistema de marcadores serializados para bloques ejecutados por el modelo** (`contenedor-chat.tsx`, `bloque-codigo.tsx`): cuando `manejarToolCall` completa una ejecucion, inserta el codigo del modelo como bloque markdown con un comentario marcador en la primera linea que incluye el resultado completo serializado: `# @ejecutado-por-modelo exito 1234 [{"tipo":"stdout","contenido":"hello","marcaTiempo":0}]` (Python) o `// @ejecutado-por-modelo error 500 [...]` (JS/TS). El formato es: `marcador estado duracionMs salidasJSON`. La regex `REGEX_MARCADOR_EJECUCION` (`/^(?:# |\/\/ )@ejecutado-por-modelo(?:\s+(exito|error))?(?:\s+(\d+)\s+(.+))?$/`) parsea 3 grupos opcionales: [1]=estado, [2]=duracionMs, [3]=salidasJSON. `BloqueCodigoConResaltado` reconstruye un `ResultadoEjecucion` completo desde estos datos y lo pasa a `TarjetaEjecucion`, que a su vez lo incluye como `resultadoPrevio` al llamar `abrirArtefacto()`. Esto permite que el panel restaure la consola con salidas, duracion y estado al reabrir un bloque ya ejecutado, sin necesidad de cache externo ni re-ejecucion. El marcador es invisible al usuario final (se elimina antes de mostrar el codigo). Backward compatible: marcadores sin datos serializados (formato viejo) siguen funcionandose gracias a los grupos opcionales de la regex.
100. **Fix tool calling "se queda pegado" — patron awaitable + evento correcto** (`route.ts`, `continuar/route.ts`, `cliente-chat.ts`, `contenedor-chat.tsx`, `bloque-codigo.tsx`, `panel-artefacto.tsx`): **Problema principal (backend)**: el backend usaba el evento `response.function_call_arguments.done` para extraer datos del tool call, pero este evento solo contiene `arguments` e `item_id` — NO tiene `name` ni `call_id`. Esto causaba que `nombre` y `callId` llegaran como strings vacios al frontend, activando el branch de "campos faltantes" y dejando la app pegada. **Fix backend**: reemplazar `response.function_call_arguments.done` por `response.output_item.done` con `item.type === "function_call"`, que contiene el item completo con `name`, `arguments` y `call_id`. Mismo fix en ambos endpoints (`/api/chat` y `/api/chat/continuar`). **Problema secundario (frontend)**: `manejarToolCall` era una funcion `async` llamada sin `await` (fire-and-forget). Su Promise flotaba desconectada: si cualquier error no manejado ocurria, se convertia en "unhandled promise rejection" invisible y `estaEscribiendo` quedaba en `true` permanentemente. **Fix frontend**: (1) Tipo de `alToolCall` cambiado a `void | Promise<void>`, (2) `await alToolCall?.(...)` en ambos parsers SSE, (3) `alFinalizar()` en el branch de campos faltantes, (4) `return manejarToolCall(...)` en callback de encadenamiento. **Fix boton Ejecutar**: reemplazado `setTimeout(50ms) + ejecutarArtefacto()` por `abrirYEjecutarArtefacto()` (operacion atomica). **Fix texto UI**: "Cargando Pyodide..." cambiado a "Cargando Python...".
101. **Fix hooks ordering + UI consistente de ejecucion de codigo** (`bloque-codigo.tsx`, `contenedor-chat.tsx`, `contexto-artefacto.tsx`, `tipos.ts`, `globals.css`): correccion de 4 problemas interrelacionados. **(1) Fix "Rendered fewer hooks than expected"**: `BloqueCodigoConResaltado` tenia hooks (`useCallback`, `useState`, 2x `useEffect`) despues de un early return condicional (check de marcador `@ejecutado-por-modelo`). Cuando el streaming agregaba el marcador a un bloque, React detectaba menos hooks y crasheaba. Fix: mover TODOS los hooks (7 en total) antes de cualquier early return. Los useEffects de auto-open/sync son no-ops para bloques marcados porque `esArtefactoValido` es false. **(2) TarjetaEjecucion monocromatica**: reemplazados gradientes emerald/red (`bg-gradient-to-r from-emerald-50`) y badges coloreados por diseno neutral identico a `TarjetaArtefacto` (fondo `--color-claude-sidebar`, icono Terminal en `#1e1e1e`, punto de color `●` sutil para estado). **(3) IndicadorEjecucion premium**: reemplazado indicador italic markdown (`*Ejecutando codigo...*`) por componente tarjeta con icono Terminal pulsante y dots animados (`.punto-cargando`), inyectado como code fence con pseudo-lenguaje `ejecutando:python`. **(4) Cache de resultados via marcador serializado**: `Artefacto` extendido con `resultadoPrevio?: ResultadoEjecucion`, el marcador serializa salidas JSON + duracion en la primera linea, `abrirArtefacto()` restaura el estado de ejecucion, eliminando la necesidad de re-ejecutar para ver output.

102. **Titulo flotante se oculta con artefacto abierto** (`area-chat.tsx`): la barra superior flotante (boton sidebar + titulo de conversacion editable) se oculta automaticamente cuando el panel de artefactos esta abierto en pantallas grandes (`lg:`). Usa `lg:opacity-0 lg:pointer-events-none` con `transition-opacity duration-200` para una transicion suave. Lee `artefactoActivo` de `useArtefacto()`. En mobile no aplica porque el chat completo esta `hidden` cuando hay artefacto. Evita solapamiento visual entre el titulo y la cabecera del panel de artefactos.
103. **Fix crash React "Maximum update depth exceeded"** (`contexto-artefacto.tsx`, `contexto-mensaje.tsx`, `bloque-codigo.tsx`): durante streaming de artefactos (codigo >=25 lineas), React entraba en un ciclo infinito de re-renders que crasheaba la app. **Causa raiz**: el `useEffect` de auto-apertura en `bloque-codigo.tsx:499-511` tenia `codigo` en sus dependencias y se disparaba cada ~50ms durante streaming, llamando `abrirArtefacto()` con un nuevo object literal. `Object.is()` siempre retornaba `false` para objetos nuevos, programando re-renders en cada tick. **3 amplificadores**: (1) Provider value de `ProveedorArtefacto` sin memoizar (cada render creaba nuevo objeto, forzando re-render de TODOS los consumers), (2) Provider value de `ProveedorMensaje` sin memoizar (mismo problema), (3) el sync effect separado (lineas 515-519) hacia `actualizarContenidoArtefacto()` en cada tick, duplicando setState. **Fix 4-partes**: (1a) Guard en `abrirArtefacto`: usa `setState(prev => prev?.id === artefacto.id ? prev : artefacto)` para no triggerear re-render si ya muestra el mismo artefacto. (1b) `useMemo` en Provider value de `ProveedorArtefacto` con dependencias explicitas. (1c) `useMemo` en Provider value de `ProveedorMensaje`. (1d) Gate en auto-open effect: `yaAbiertoAutoRef` (mutable ref via useState) se marca `true` al primer disparo, y el effect solo corre cuando `esArtefactoValido` transiciona de false a true. Dependencias reducidas a `[estaGenerandose, esArtefactoValido]`. El sync effect separado se mantiene intacto para actualizar contenido durante streaming.
104. **Soporte matplotlib/graficos en consola de ejecucion** (`worker-pyodide.ts`, `ejecutor-codigo.ts`, `tipos.ts`, `panel-artefacto.tsx`): los graficos generados con matplotlib en codigo Python ahora se renderizan como imagenes PNG dentro de la consola de resultados del panel de artefactos. **Pipeline**: (1) `construirCodigoPython()` en el Worker envuelve el codigo del usuario en `try/except/finally`: el preamble configura `matplotlib.use('agg')` (backend no-GUI) antes de cualquier import del usuario. (2) El codigo del usuario indentado 4 espacios se ejecuta dentro del `try`. (3) Si lanza excepcion, el `except` la captura con `traceback.print_exc()` y marca `__excepcion_usuario__`. (4) El `finally` SIEMPRE itera figuras abiertas (`plt.get_fignums()`), guardandolas como PNG a 150 DPI via `savefig` → `BytesIO` → `base64.b64encode`, e imprimiendolas con prefijo `__IMG_BASE64__:`. Esto garantiza que figuras creadas antes de un error se capturen (antes se perdian silenciosamente). (5) `postProcesarImagenes()` en el hilo principal convierte entradas stdout con el marcador en entradas tipo `"imagen"` con data URL (`data:image/png;base64,...`). (6) `ConsolaResultados` renderiza entradas `"imagen"` como `<img src={dataURL}>` con `max-w-full rounded my-1` y max-height 400px. El tipo `EntradaConsola` en `tipos.ts` incluye `"imagen"` como tipo adicional. Variables Python internas usan prefijo `__` para evitar colisiones con el codigo del usuario.
105. **Ejecucion per-bloque durante streaming** (`bloque-codigo.tsx`): el boton Ejecutar de bloques de codigo ahora esta siempre habilitado, incluso mientras el modelo sigue generando otros bloques. **Antes**: `ejecucionDeshabilitada = estaGenerandose` deshabilitaba TODOS los botones Ejecutar de todos los bloques mientras cualquier mensaje estaba en streaming. **Ahora**: se elimino `ejecucionDeshabilitada` completamente. react-markdown solo renderiza bloques de codigo cuando el fence de cierre (` ``` `) ya llego, por lo que cualquier bloque renderizado como componente siempre contiene codigo completo. No hay riesgo de ejecutar codigo parcial.
106. **Ocultar boton Ejecutar con `input()`** (`bloque-codigo.tsx`, `panel-artefacto.tsx`): cuando `detectarUsoInput()` detecta que el codigo Python usa `input()`, el boton Ejecutar se oculta completamente tanto en bloques inline como en la cabecera del panel de artefactos. **Antes**: el boton se mostraba en color amber con tooltip de warning, lo que confundia al usuario porque podia intentar ejecutar de todos modos y recibir un error criptico. **Ahora**: `esEjecutable` incluye `!tieneInput` en su condicion, y toda la logica de estilos amber fue eliminada. Se elimino tambien la referencia a `tieneInput` en los estilos del boton ya que no aplica.
107. **Resultados de tool call como markdown inline** (`contenedor-chat.tsx`): los resultados de ejecucion de tool calls ahora usan formato inteligente basado en longitud. Resultados cortos (1-3 lineas) se muestran como markdown inline ("**Resultado:** 42" o "**Resultado:** $x^2 + 1$") permitiendo que formulas LaTeX, formato y expresiones matematicas se rendericen correctamente. Resultados largos (4+ lineas) mantienen code fence para legibilidad. Errores siempre usan code fence. La deteccion usa `salidasTexto.split("\n").length > 3` para determinar el formato. Antes, todos los resultados usaban code fence indiscriminadamente.
108. **Consola de ejecucion compacta** (`panel-artefacto.tsx`): se redujo el espacio vertical muerto en la consola de resultados del panel de artefactos. **Cambios**: `py-2` (16px vertical) → `py-1.5` (12px vertical), `leading-relaxed` (line-height 1.625) → `leading-snug` (line-height 1.375). Estos ajustes eliminan el exceso de espacio entre lineas de salida sin comprometer la legibilidad, especialmente notable cuando la consola muestra pocas lineas.
109. **Resize dinamico de consola y panel de artefactos** (`panel-artefacto.tsx`, `contenedor-chat.tsx`): dos features de redimensionamiento por drag implementados. **(1) Consola vertical**: drag handle de 4px (`h-1`) en el borde superior de `ConsolaResultados`, ENCIMA de la barra de estado ("Completado"). Color `bg-[var(--color-claude-input-border)]`, sin indicadores visuales extra. Arrastrar hacia arriba agranda la consola, hacia abajo la reduce. Estado `alturaConsola` (px, default `null` = `max-h-64`). Min 60px, max 60% del panel. Usa refs para tracking sin re-renders. **(2) Panel horizontal**: drag handle de 6px (`w-1.5`) posicionado como overlay absoluto en el borde izquierdo interno del panel (solo `lg:+`). Al ser overlay, se superpone al borde `border-l` del panel sin crear un espacio en blanco adicional, de forma que el scrollbar del chat queda pegado literalmente a la orilla del panel. Arrastrar a la izquierda agranda el panel, a la derecha lo reduce. Estado `anchoPanelPx` en `ContenedorChat`. Min 350px, max 50% del `<main>` (via `mainRef`). Sin barras ni indicadores visuales adicionales — solo cambio de cursor (`ns-resize`/`ew-resize`) y color de fondo al hover. `document.body.style.cursor` y `userSelect = "none"` durante drag. El panel mantiene `flex flex-1 min-w-0` en su contenedor interno para prevenir desbordes de scroll.
110. **Pyodide en Web Worker dedicado — fix "Beso de la Muerte"** (`lib/worker-pyodide.ts`, `lib/ejecutor-codigo.ts`): la ejecucion de Python via Pyodide WASM se movio del hilo principal a un **Web Worker dedicado** (`worker-pyodide.ts`). **Problema**: cuando el usuario ejecutaba `while True: pass`, Pyodide (WASM) bloqueaba el event loop de JavaScript completamente. `Promise.race` con timeout no funcionaba porque `setTimeout` nunca se ejecutaba — el event loop estaba congelado. La unica salida era forzar-cerrar la pestaña del navegador. **Solucion**: el Worker tiene su propio event loop aislado, por lo que: (1) el hilo principal (React) nunca se bloquea, manteniendo la UI responsive a 60 FPS incluso durante loops infinitos; (2) `setTimeout` en el hilo principal funciona correctamente porque no esta congelado por WASM; (3) si el Worker no responde en 30 segundos (`TIMEOUT_EJECUCION_MS`), se termina con `worker.terminate()` y se recrea lazy en la proxima ejecucion. El Worker se crea con `new Worker(new URL("./worker-pyodide.ts", import.meta.url))`, sintaxis soportada nativamente por Next.js 16 con Turbopack. `ejecutor-codigo.ts` se convierte en un **manager del Worker**: crea el Worker la primera vez (`obtenerWorker()`), le envia codigo via `postMessage`, recibe resultados (stdout/stderr/resultado) y lo termina si excede el timeout. **Opcion descartada**: `SharedArrayBuffer + setInterruptBuffer()` — requiere headers COOP/COEP que rompen integraciones con CDNs de terceros (Pyodide, KaTeX, etc.).
111. **Mutex de ejecucion de Python — cola de promesas FIFO** (`lib/ejecutor-codigo.ts`): Pyodide (`runPythonAsync`) NO es reentrante — si dos ejecuciones corren simultaneamente, los callbacks de `setStdout`/`setStderr` se sobreescriben y los globals se corrompen. **Problema**: si el modelo ejecuta un tool call de Python y el usuario hace click en "Ejecutar" en otro bloque simultaneamente, se disparan dos `ejecutarCodigo()` contra el mismo Worker. **Solucion**: mutex basado en cola de promesas que serializa el acceso. Cada llamada a `ejecutarPython()` registra su turno (`miTurno`) y espera al anterior (`await turnoAnterior`). El `finally` siempre libera el turno, incluso en error o timeout. Flag `ejecucionEnCurso` consultable via `estaEjecutandoCodigo()` (exportado). Este es el **segundo nivel de defensa**: el primer nivel es el guard en `contexto-artefacto.tsx` (`if (estadoEjecucion === "ejecutando") return`) que previene clicks duplicados en la UI.
112. **Matplotlib try/except/finally — captura garantizada de figuras** (`lib/worker-pyodide.ts`): `construirCodigoPython(codigoUsuario)` envuelve el codigo del usuario en una estructura `try/except/finally` que garantiza la captura de figuras matplotlib incluso cuando el codigo lanza una excepcion. **Problema anterior**: el EPILOGUE de matplotlib se concatenaba despues del codigo del usuario (`PREAMBLE + codigo + EPILOGUE`). Si el codigo lanzaba una excepcion (ej: `1/0` despues de `plt.plot()`), el EPILOGUE nunca se ejecutaba y las figuras se perdian silenciosamente. **Solucion**: (1) el preamble configura `matplotlib.use('agg')` antes que el usuario pueda importar matplotlib; (2) el codigo del usuario se indenta 4 espacios y se ejecuta dentro del `try` (lineas vacias se mantienen vacias); (3) el `except` captura la excepcion, imprime traceback via `print_exc()`, y marca `__excepcion_usuario__`; (4) el `finally` SIEMPRE itera figuras abiertas (`plt.get_fignums()`), las guarda como PNG a 150 DPI via `savefig` → `BytesIO` → `base64.b64encode`, las imprime con marcador `__IMG_BASE64__:`, y cierra todas las figuras. Post-ejecucion, el Worker verifica `pyodide.globals.get("__excepcion_usuario__")`: si es `null` → `exito: true`; si tiene valor → `exito: false` (el traceback ya fue impreso a stderr). Variables internas usan prefijo `__` para evitar colisiones con el codigo del usuario.
113. **Estado Inteligente del Botón Ejecutar** (`renderizador-markdown.tsx`, `bloque-codigo.tsx`, `contexto-artefacto.tsx`): para evitar que el usuario intente ejecutar un bloque de código incompleto, el sistema desactiva el botón "Ejecutar" de ambos componentes (panel y chat) _únicamente_ para el bloque de código actualmente en streaming. Esto se logra leyendo el AST proveído por `react-markdown` combinándolo con el texto real del ContextoMensaje (`useMensaje`) con un offset (`node.position`). Esto localiza el fin del token en bruto y si contiene ` ``` ` significa que el bloque está cerrado y por lo tanto puede habilitar de nuevo los botones "Ejecutar".
114. **Precarga Global de Pyodide** (`contenedor-chat.tsx`, `ejecutor-codigo.ts`): como los scripts WASM de python cargaban on demand (10s+) ocasionando una experiencia mala de primera ejecución, ahora Pyodide se instancia globalmente llamando a un Worker dummy (`precargarPyodide`) dos segundos después del TTI (Time To Interactive) de `ContenedorChat` para evitar saturación del Event Loop en el primer dibujado del framework NextJS, asegurando ejecuciones cuasi-instantáneas.
115. **Visibilidad dinámica del botón menú lateral flotante** (`area-chat.tsx`): la barra superior flotante dividía su opacidad de manera unificada junto con el título. Ahora el botón para activar/desactivar la barra lateral (`PanelLeftOpen`) y el contenedor del título (`conversacion.titulo`) se encuentran desacoplados para que el botón de menú siga disponible permanentemente para abrir el panel en monitores grandes (`lg:`), aun cuando el panel de artefactos esté abierto ocultando el título por cuestión de espacio.
116. **Timeout de ejecucion aumentado a 30 segundos y preferencia por JavaScript** (`lib/ejecutor-codigo.ts`, `lib/constantes.ts`, `app/api/chat/route.ts`, `app/api/chat/continuar/route.ts`, `lib/contexto-artefacto.tsx`): **Problema**: el timeout de ejecucion de 10 segundos era insuficiente para la primera carga de Pyodide WASM (~11MB), causando que ejecuciones de Python fallaran con "Ejecucion interrumpida" antes de que Pyodide terminara de descargar. **Solucion en 4 partes**: (1) `TIMEOUT_EJECUCION_MS` aumentado de `10_000` a `30_000` — suficiente para la descarga inicial en conexiones lentas; (2) system prompt actualizado con preferencia agresiva por JavaScript (`SIEMPRE USA JAVASCRIPT por defecto`), explicando que JavaScript es instantaneo y Python requiere Pyodide WASM, con guias claras de cuando usar cada lenguaje; (3) descripcion de la herramienta `ejecutar_codigo` actualizada en ambas rutas API para reflejar el nuevo timeout y la preferencia por JavaScript; (4) callback `alIniciarEjecucion` agregado a `ejecutarCodigo()` y `ejecutarPython()` que se invoca cuando Pyodide termina de cargar y la ejecucion comienza, permitiendo a la UI transicionar en tiempo real de "Cargando Python..." a "Ejecutando..." (antes la UI permanecia en "Cargando" durante toda la ejecucion). **Eliminacion de duplicacion**: la definicion de herramientas (web_search + ejecutar_codigo) se extrajo a `HERRAMIENTAS_CHAT` en `lib/constantes.ts`, reemplazando las definiciones inline identicas en ambas rutas API. Ahora cambiar la herramienta solo requiere editar un archivo.
117. **Fix validacion de tool calls y logging diagnostico** (`lib/cliente-chat.ts`, `components/chat/contenedor-chat.tsx`, `lib/contexto-artefacto.tsx`, `lib/ejecutor-codigo.ts`, `app/api/chat/route.ts`, `app/api/chat/continuar/route.ts`): **Problema**: tool calls del modelo podian fallar silenciosamente sin mostrar ningun feedback al usuario (ni el panel de artefactos ni errores en el chat). **Causas identificadas**: (1) en `cliente-chat.ts`, la validacion de campos del evento `tool_call` usaba checks de truthiness de JavaScript (`parseado.callId && parseado.idRespuesta`) que rechazaban strings vacias `""` como falsy — si la API enviaba un campo como string vacia, el tool call se descartaba silenciosamente y solo se llamaba `alFinalizar()`, dejando al usuario en un estado "escribiendo" sin explicacion; (2) en `contenedor-chat.tsx`, si `JSON.parse(argumentos)` fallaba en el catch de `manejarToolCall`, el error se "tragaba" porque intentaba reemplazar un indicador temporal (`` ```ejecutando:... ``) que nunca fue insertado — el regex `.replace()` no encontraba match, retornaba el string sin cambios, y el error se perdia por completo. **Solucion**: (1) validacion cambiada de truthiness (`&&`) a null checks (`!= null`) en ambas funciones de streaming (`enviarMensajeConStreaming` y `enviarContinuacionConStreaming`), aceptando strings vacias como validas; (2) flag `indicadorInsertado` en `manejarToolCall` que controla si el catch debe reemplazar el indicador temporal (regex) o agregar el error al final del texto (append); (3) logging diagnostico completo en toda la cadena de tool calls: `[api/chat]` y `[api/continuar]` en backend al emitir eventos function_call, `[cliente-chat]` al recibir eventos tool_call en el streaming SSE (con detalle de campos faltantes si la validacion falla), `[tool-call]` en `manejarToolCall` al recibir/ejecutar/completar tool calls (con lenguaje, profundidad, callId, exito, salidas, duracion), `[artefacto]` en `abrirYEjecutarArtefacto` (con estado inicial, estado Pyodide, resultado), y `[ejecutor]` en `ejecutarCodigo` (con lenguaje, familia, lineas de codigo). Esto permite diagnosticar la ruta exacta de fallo abriendo la consola del navegador y del servidor.

---

## Notas Tecnicas

### Arquitectura Multi-Proveedor

El sistema esta preparado para soportar multiples proveedores de IA. La estructura de datos sigue una jerarquia:

```
Proveedor (ProveedorIA)
  └── Categorias (CATEGORIAS_MODELOS, filtradas por proveedor)
       └── Modelos (ModeloDisponible, con campo `proveedor`)
```

**Archivos clave:**
- `lib/tipos.ts`: Interfaces `ProveedorIA` y `ModeloDisponible` (con campo `proveedor: string`)
- `lib/modelos.ts`: Constantes `PROVEEDORES`, `MODELOS_DISPONIBLES`, `CATEGORIAS_MODELOS`, helpers `obtenerProveedorDeModelo()`
- `components/ui/iconos-proveedor.tsx`: Iconos SVG por proveedor, extensibles via `MAPA_ICONOS`
- `components/chat/entrada-mensaje.tsx`: Popover con panel de dos columnas (proveedores + modelos)

**Input de mensajes - Estilos premium:**

El contenedor del input usa `overflow-hidden` para evitar scrollbars no deseados, con tokens de sombra custom:
- En reposo: `shadow-[var(--sombra-xs)]` (sombra sutil) + `ring-1 ring-transparent` + `border border-[var(--color-claude-input-border)]`
- En focus: `shadow-[var(--sombra-input-foco)]` (sombra multi-capa) + `ring-[var(--color-claude-texto)]/10` + `border-[var(--color-claude-texto)]`
- Transicion `duration-200` para suavidad entre estados

**UI del selector de modelos:** El trigger muestra solo `Nombre Modelo ▼` (sin icono), posicionado a la derecha del input junto al boton de enviar. Al hacer click se abre un Popover (`align="end"`) con dos paneles:
- **Panel izquierdo (w-12):** Sidebar vertical con iconos de proveedores (boton por cada proveedor), el activo se resalta con fondo hover
- **Panel derecho:** Lista de modelos agrupados por categoria del proveedor seleccionado, con check en el modelo activo

El `proveedorActivo` se maneja con estado local dentro de `EntradaMensaje`. Al seleccionar un modelo, el Popover se cierra automaticamente.

**Adjuntos multimodales (4 metodos de entrada):**

`EntradaMensaje` soporta cuatro metodos para adjuntar archivos, todos procesados por la funcion compartida `procesarArchivos()`:

| Metodo | Handler | Descripcion |
|--------|---------|-------------|
| File picker | `manejarSeleccionArchivos` | Click en boton de clip → `<input type="file">` oculto |
| Paste | `manejarPegar` | `onPaste` en textarea → `clipboardData.items` → solo `preventDefault` si hay archivos |
| Drag-and-drop local | `manejarDragOver`/`manejarDragLeave`/`manejarDrop` | En el contenedor del input → feedback visual con borde punteado |
| Drag-and-drop global | `useEffect` con prop `archivosExternos` | Archivos dropeados en cualquier parte de la pagina (gestionado por `ContenedorChat`) |

**Constantes:**
- `MAXIMO_ADJUNTOS = 10`: limite total de archivos/imagenes por mensaje
- `TIPOS_IMAGEN` y `TIPOS_ARCHIVO`: strings para el atributo `accept` del input
- Validacion de archivos: `esArchivoSoportado(nombre)` importado de `separadores-codigo.ts` (valida por extension, no por MIME type)

**Drag-and-drop visual:** Cuando `estaArrastrando` es `true`, el contenedor del input muestra `border-dashed border-[var(--color-claude-acento)] bg-[var(--color-claude-acento)]/5`. El `manejarDragLeave` usa `relatedTarget` para evitar que al mover el cursor entre elementos hijos se desactive el estado visual prematuramente.

### Workaround Radix UI ScrollArea (issue #926)

Radix UI inyecta un `<div>` interno en el `ScrollArea.Viewport` con `display: table; min-width: 100%`. Esto crea un contexto de formateo de tabla que expande el contenido al ancho total, ignorando restricciones de `overflow-hidden` y `truncate` en elementos hijos.

**Fix aplicado en `scroll-area.tsx`:** Se agrega `[&>div]:!block` al className del Viewport para forzar `display: block !important` en el div interno de Radix.

**Cadena defensiva de overflow en la barra lateral (`barra-lateral.tsx`):**
1. `<aside>`: `overflow-hidden` (capa de defensa 1)
2. `<ScrollArea>`: `min-w-0` (permite que el flex child se comprima)
3. Wrapper de contenido: `w-full overflow-hidden` (capa de defensa 2)
4. Cada item de conversacion: `overflow-hidden` (capa de defensa 3)
5. Texto del titulo: `flex-1 min-w-0 truncate` (truncado con elipsis)
6. Boton de acciones: `shrink-0` (nunca se comprime)

### Fix Sidebar Infinite Loop (CSS visibility vs render condicional)

**Problema:** `barra-lateral.tsx` originalmente usaba `{estaAbierta && (<>...</>)}` para renderizar condicionalmente todo el contenido del sidebar. Con `radix-ui@1.4.3` + React 19, al abrir el sidebar TODOS los componentes Radix (Tooltip, DropdownMenu) se montaban simultaneamente, causando cascadas internas de `setState` que excedian el limite de actualizaciones de React ("Maximum update depth exceeded").

**Solucion:** Se elimino el render condicional y se usa CSS para ocultar el contenido:
- `overflow-hidden` + `w-0` en el `<aside>` hace invisible el contenido cuando esta cerrado
- Atributo HTML5 `inert` previene focus, interaccion con teclado y screen readers cuando esta colapsado
- Los componentes Radix permanecen montados (no hay mount/unmount) eliminando las cascadas de setState
- La transicion CSS `w-64 → w-0` ahora anima suavemente (antes era un mount/unmount abrupto)

**Implementacion:**
```tsx
<aside
  className={cn("... overflow-hidden", estaAbierta ? "w-64" : "w-0")}
  {...(!estaAbierta ? { inert: true as unknown as boolean } : {})}
>
  {/* Contenido SIEMPRE montado */}
</aside>
```

**TypeScript:** `inert` es un atributo HTML5 valido pero React 19 no exporta tipos perfectos para el. El workaround `true as unknown as boolean` satisface TypeScript sin afectar el runtime.

---

## Sistema de Artefactos

### Que son los Artefactos

Los artefactos son bloques de contenido grande (codigo, HTML, SVG, markdown) que se extraen del flujo del chat y se visualizan en un panel lateral dedicado. Inspirado en Claude Artifacts y ChatGPT Canvas, pero con deteccion puramente frontend (no requiere cooperacion del modelo).

**Artefactos son para codigo largo y contenido previsualizable, no para texto.** Un bloque de codigo corto (<25 lineas) se muestra inline normalmente. Solo codigo sustancial, SVGs, documentos HTML completos y bloques markdown largos se promueven a artefactos.

### Arquitectura de Artefactos

```
BloqueCodigoConResaltado (renderizador-markdown → componentesMarkdown.code)
    │
    ├── Detecta: ¿codigo ≥ 25 lineas? ¿SVG? ¿HTML completo? ¿Markdown?
    │
    ├── Si → TarjetaArtefacto (card clickable en el chat)
    │         │
    │         └── onClick → useArtefacto().abrirArtefacto(artefacto)
    │                        │
    │                        └── React Context (ContextoArtefacto)
    │                             │
    │                             ├── ContenedorChat lee artefactoActivo → ajusta layout split
    │                             │
    │                             └── PanelArtefacto lee artefactoActivo → renderiza contenido
    │                                  ├── CodigoConResaltado (syntax highlighting, tema oneLight)
    │                                  ├── VistaPreviaArtefacto (iframe sandboxed, HTML/SVG)
    │                                  └── RenderizadorMarkdown (preview markdown directo)
    │
    ├── Sync streaming: useEffect compara artefactoActivo.id con idArtefacto local
    │   Si coinciden y el contenido cambio → actualizarContenidoArtefacto(codigo, totalLineas)
    │   (ID estable: hash de primeros 100 chars, no cambia durante append-only)
    │
    └── No → Bloque inline normal (barra superior + codigo + boton copiar)
```

### Archivos del Sistema de Artefactos

| Archivo | Descripcion |
|---------|-------------|
| `lib/tipos.ts` | `TipoArtefacto` ("codigo" \| "html" \| "svg" \| "markdown") y `Artefacto` (id, tipo, titulo, contenido, lenguaje, totalLineas) |
| `lib/contexto-artefacto.tsx` | React Context + `ProveedorArtefacto` + `useArtefacto()` hook |
| `components/chat/bloque-codigo.tsx` | Deteccion de artefactos + `TarjetaArtefacto` + `BloqueCodigoConResaltado` + `CodigoConResaltado` |
| `components/chat/panel-artefacto.tsx` | Panel lateral completo con cabecera, acciones, codigo/preview |
| `components/chat/contenedor-chat.tsx` | Layout split (chat + panel) condicionado a `artefactoActivo` |
| `app/page.tsx` | Monta `ProveedorArtefacto` envolviendo `ContenedorChat` |
| `app/globals.css` | Animacion `.animate-entrada-panel` (slide-in 200ms), scrollbar global fina (6px) usada en el panel |

### Decisiones de Diseno (Artefactos)

1. **Deteccion frontend-only (Opcion B):** Se eligio deteccion puramente en el frontend en vez de tags del modelo (Opcion A: `<artifact>`) o hibrida (Opcion C). La razon principal es que los modelos de OpenAI no estan entrenados para generar tags `<artifact>` como Claude, y modificar el system prompt para forzarlo produce resultados inconsistentes. La deteccion frontend funciona con cualquier modelo sin configuracion adicional.

2. **React Context vs Store global:** El artefacto activo se gestiona con React Context (`ContextoArtefacto`) en vez de añadirlo al store centralizado (`almacen-chat.ts`). El artefacto es estado de UI transiente: no se persiste, no afecta mensajes, y no necesita sobrevivir recargas. Usar Context evita re-renders innecesarios del store de conversaciones.

3. **Comunicacion via Context (no prop drilling):** `BloqueCodigoConResaltado` necesita abrir el panel, pero esta profundamente anidado en `renderizador-markdown.tsx` → `componentesMarkdown` (constante estatica fuera del componente para rendimiento). Pasar callbacks por props requeriria recrear `componentesMarkdown` en cada render, rompiendo la optimizacion de memo. Context permite comunicacion directa sin afectar el arbol de componentes.

4. **Umbral de 25 lineas:** Para deteccion puramente frontend (sin intencion del modelo), 25 lineas filtra snippets triviales (explicaciones, configuraciones cortas, ejemplos) sin perder codigo sustancial (funciones completas, componentes, clases). Claude Artifacts usa >10 con cooperacion del modelo; al no tener esa señal, un umbral mas alto evita falsos positivos.

5. **ID determinista estable durante streaming:** `generarIdArtefacto()` genera un hash de los primeros 100 caracteres del contenido para crear IDs estables. El muestreo corto (100 chars en vez de todo el contenido) garantiza que el ID no cambie durante streaming append-only: los tokens nuevos se agregan al final del codigo, pero los primeros 100 chars ya estan fijos. `BloqueCodigoConResaltado` usa este ID para detectar si el panel lateral muestra su artefacto y sincronizar el contenido en tiempo real via `actualizarContenidoArtefacto()`.

6. **Prop `deshabilitarArtefacto`:** `CodigoConResaltado` (usado dentro del panel) pasa `deshabilitarArtefacto={true}` implicito (no usa deteccion). Esto evita recursion infinita: el panel no intenta convertir su propio codigo en artefacto.

7. **Vista previa sandboxed:** El iframe usa `sandbox="allow-scripts"` sin `allow-same-origin`, previniendo que el HTML del usuario acceda al DOM de la aplicacion o a cookies/localStorage. SVGs se envuelven en HTML minimo con fondo claro (`#f9f9f9`) para consistencia con el tema light del panel.

8. **Layout responsive:** En desktop (≥1024px, breakpoint `lg` de Tailwind), el chat y el panel coexisten (55%/45%). En mobile, el panel ocupa 100% y el chat se oculta completamente (`hidden lg:flex`). El max-width de 700px en el panel previene que ocupe demasiado espacio en pantallas ultrawide.

---

## Sistema RAG (Retrieval-Augmented Generation)

### Que es RAG

RAG es una tecnica para dar a un LLM informacion que no tiene en su entrenamiento. Se usa cuando el usuario sube archivos grandes (PDFs, codigo fuente, documentos de texto) que no caben o no es eficiente enviar completos al modelo. En vez de enviar todo el documento, RAG extrae solo los fragmentos relevantes a la pregunta del usuario.

**RAG es para documentos, no para la conversacion.** La conversacion ya se envia completa al LLM como historial. RAG resuelve el problema de archivos grandes.

### Arquitectura RAG

```
Archivo subido por el usuario (base64)
    │
    ▼
┌─── motor-embeddings.ts (proxy) ──────────────────────────────────────┐
│  decodificarBase64() → ArrayBuffer                                   │
│  Transferable Object (zero-copy) ──────────────────────────┐         │
│                                                            │         │
│  ┌── worker-embeddings.ts (Web Worker) ────────────────────▼──────┐  │
│  │                                                                │  │
│  │  Pipeline streaming con async generators:                      │  │
│  │                                                                │  │
│  │  1. extraerPaginas()     2. fragmentarStream()   3. vectorizar │  │
│  │  ┌────────────────┐    ┌───────────────────┐    ┌────────────┐ │  │
│  │  │ async function*│    │ async function*   │    │ auto-batch │ │  │
│  │  │ PDF.js (sub-   │ →  │ yield chunks con  │ →  │ WebGPU: 64 │ │  │
│  │  │ Worker, 4 pags │    │ solapamiento      │    │ WASM: 16   │ │  │
│  │  │ en paralelo)   │    │ elastico:         │    │ ONNX(384)  │ │  │
│  │  │                │    │ normal: 2000/200  │    │ →MRL(256)  │ │  │
│  │  │ yield pagina   │    │ grande: 3000/300  │    │ →Bin(32B)  │ │  │
│  │  └────────────────┘    └───────────────────┘    └────────────┘ │  │
│  │                                                                │  │
│  │  Heuristicas: >5MB → chunks grandes, <100 chars → skip pag     │  │
│  │                                                                │  │
│  │  ──── Transferable Objects (embeddings binarios) ────────►     │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│                          ┌──────────────────┐                        │
│                          │ Almacen Vectores │                        │
│                          │ Map<convId, docs>│                        │
│                          │ + IndexedDB      │                        │
│                          └──────────────────┘                        │
└──────────────────────────────────────────────────────────────────────┘

Usuario hace una pregunta
    │
    ▼
┌───────────────────────────────────────────────────────────────────┐
│                    PIPELINE DE BUSQUEDA                           │
│                                                                   │
│  1. Embedding consulta    2. Similitud Hamming    3. Contexto     │
│  ┌──────────────────┐    ┌────────────────────┐   ┌──────────┐    │
│  │ "resume el doc"  │    │ Top-10 fragmentos  │   │ Prepende │    │
│  │ → Uint8Array[32] │ →  │ mas similares      │ → │ al msg   │    │
│  └──────────────────┘    │ (dist. Hamming,    │   │ del user │    │
│                          │  umbral > 0.55)    │   └──────────┘    │
│                          └────────────────────┘                   │
└───────────────────────────────────────────────────────────────────┘
    │
    ▼
LLM recibe: [contexto de fragmentos] + pregunta del usuario
```

### Archivos del Sistema RAG (`lib/rag/`)

#### `motor-embeddings.ts` + `worker-embeddings.ts` - Motor de Embeddings

Arquitectura en dos capas con tolerancia a fallos: `motor-embeddings.ts` es un proxy que delega el procesamiento a un **Web Worker dedicado** (`worker-embeddings.ts`). Si el Worker falla (CSP estrictos, Workers anidados incompatibles, falta de RAM), se activa un **pipeline fallback en el hilo principal** usando `extractor-texto.ts` y `fragmentador-texto.ts` via importaciones dinamicas (`await import()`).

**Modelo:** `mixedbread-ai/mxbai-embed-xsmall-v1` (~24MB q8, 384→256 dimensiones Matryoshka, 4096 tokens de contexto)

**Pipeline completo (en el Worker):**
```
archivo (ArrayBuffer)
    │
    ▼
extraerPaginas() ─── async function* ─── yield pagina por pagina
    │                                     (PDF.js con sub-Worker anidado)
    ▼
fragmentarStream() ── async function* ── yield chunks con solapamiento
    │                                     (elastico: 2000/200 o 3000/300)
    ▼
vectorizarYEnviarBatch() ── auto-batch ── ONNX(384) → MRL(256) → Bin(32B)
    │                                      (WebGPU: 64, WASM: 16)
    ▼
Transferable Objects → hilo principal (zero-copy)
```

**Worker-to-Worker Isolation:**
- Todo el pipeline se ejecuta dentro del Web Worker: extraccion (PDF.js), fragmentacion y vectorizacion
- El hilo principal solo envia el ArrayBuffer crudo y recibe mensajes de progreso + resultados finales
- PDF.js corre con `workerSrc` configurado a `/pdf.worker.min.mjs`, creando un sub-Worker anidado para el parsing
- React nunca se bloquea: la UI mantiene 60 FPS incluso procesando documentos grandes

**Pipeline streaming con async generators:**
- `extraerPaginas()`: `async function*` que yield paginas. Para PDFs, extrae en lotes paralelos de 4 paginas concurrentemente usando `Promise.all` (pdfjs usa su propio sub-Worker, permitiendo paralelismo real). Para texto plano, yield el contenido completo
- `fragmentarStream()`: `async function*` que consume el stream de paginas y yield chunks con solapamiento. Acumula texto en buffer. Para archivos de codigo, usa separadores jerarquicos por lenguaje (patron LangChain: funciones, clases, exports como puntos de corte prioritarios con umbral agresivo de 0.3). Para texto generico, corta en puntos naturales (parrafo > oracion > linea > espacio). Deja solapamiento para no perder contexto
- La vectorizacion consume chunks del stream y los acumula en batches. Cuando el batch se llena, vectoriza y envia resultados al hilo principal. Drena fragmentos restantes al final del documento

**Auto-tuning de batch size:**
- WebGPU (GPU): batch de 64 fragmentos (~10x mas rapido)
- WASM (CPU): batch de 16 fragmentos (mas granular para progreso continuo)
- Al finalizar el documento, los fragmentos restantes se procesan inmediatamente sin esperar a llenar el batch

**Heuristicas para archivos grandes (>5MB):**
- Chunks elasticos: 3000 chars con 300 de solapamiento (vs 2000/200 normal)
- Filtrado de paginas ruido: paginas con <100 caracteres se saltan (portadas, indices vacios, separadores)

**Aceleracion por hardware:**
- **WebGPU** (GPU, ~10x mas rapido): se detecta automaticamente via `navigator.gpu.requestAdapter()`. Usa `dtype: "fp32"` (optimo para GPU)
- **WASM** (CPU): si WebGPU no esta disponible. Usa `dtype: "q8"` (cuantizado, ~24MB)
- Si WebGPU falla en runtime, se reintenta automaticamente con WASM

**Truncamiento Matryoshka (MRL):**
- El modelo genera embeddings de 384 dimensiones
- Se truncan a **256 dimensiones** (el modelo esta entrenado con Matryoshka Representation Learning)
- Se renormalizan despues del truncamiento para mantener la propiedad de norma unitaria

**Cuantizacion binaria:**
- Cada dimension del vector Matryoshka (256 floats) se convierte en un bit: `>= 0 → 1`, `< 0 → 0`
- 256 bits se empaquetan en **32 bytes** (`Uint8Array[32]`)
- **Reduccion de memoria 32x**: 256 × 4 bytes (Float32) → 32 bytes (Uint8)
- Habilita busqueda ultra-rapida por distancia de Hamming (XOR + popcount)

**Web Worker + Transferable Objects:**
- Todo el pipeline se ejecuta fuera del hilo principal
- El hilo principal nunca se bloquea durante el procesamiento
- Los embeddings binarios se transfieren via **Transferable Objects** (`postMessage` con transferencia de `ArrayBuffer`). El buffer se mueve en **0ms** sin copiar datos (zero-copy)

**Cola de serializacion de archivos:**
- `procesarArchivoCompleto()` en `motor-embeddings.ts` serializa el envio de archivos al Worker mediante un mutex (`archivoEnProceso` + `colaArchivos`)
- Solo un archivo viaja al Worker a la vez; los demas esperan en cola FIFO
- La decodificacion base64 (`decodificarBase64()`) ocurre fuera de la cola (es rapida y libera la cadena base64 de memoria al transferir el ArrayBuffer)
- Cuando un archivo termina en el Worker, el bloque `finally` libera el mutex y despierta al siguiente en la cola
- Previene interleaving de inferencia ONNX concurrente: el runtime ONNX (WebGPU/WASM) no esta disenado para multiples llamadas simultaneas a `pipe()`

**Protocolo de mensajes Worker:**
| Mensaje | Direccion | Descripcion |
|---------|-----------|-------------|
| `inicializar` | → Worker | Carga modelo ONNX |
| `listo` | ← Worker | Modelo cargado, dispositivo detectado |
| `procesarArchivo` | → Worker | Envia ArrayBuffer + nombre + tipoMime |
| `progresoArchivo` | ← Worker | Fase actual + procesados + fragmentosEstimados |
| `progresoExtraccion` | ← Worker | Pagina actual / total paginas (PDF) |
| `batchProcesado` | ← Worker | Fragmentos + embeddings binarios (Transferable) |
| `archivoCompleto` | ← Worker | Pipeline terminado, total fragmentos |
| `embedSingle` | → Worker | Texto de consulta para embedding |
| `embedBatch` | → Worker | Multiples textos para embeddings |
| `resultadoBatch` | ← Worker | Embeddings binarios resultantes |
| `error` | ← Worker | Error con mensaje descriptivo |

**Caracteristicas:**
- Carga lazy (singleton): el modelo se descarga solo cuando se necesita por primera vez
- Se cachea en la Cache API del navegador (no se re-descarga en visitas futuras)
- Retorna `Uint8Array[32]` (embedding binario cuantizado)
- Sistema de suscripcion para reportar progreso de descarga
- Calcula porcentaje unificado de progreso (0-100%) combinando extraccion (0-30% para PDFs) y vectorizacion (30-100%), basado en `fragmentosEstimados` del Worker

**Funciones exportadas (motor-embeddings.ts):**
| Funcion | Descripcion |
|---------|-------------|
| `procesarArchivoCompleto(base64, nombre, mime, cb)` | Pipeline completo: archivo → fragmentos con embeddings. Delega al Worker |
| `generarEmbedding(texto)` | Genera un embedding binario `Uint8Array[32]` para un texto de consulta |
| `generarEmbeddingsBatch(textos)` | Genera embeddings binarios para multiples textos en un batch |
| `obtenerEstadoMotor()` | Retorna estado, error, dispositivo usado y si esta usando Worker o fallback |
| `precargarModelo()` | Inicia precarga del modelo sin bloquear |
| `suscribirseAProgresoCarga(cb)` | Suscribirse a progreso de descarga (retorna funcion para desuscribirse) |

#### `almacen-vectores.ts` - Almacen de Vectores con IndexedDB

Almacen en memoria indexado por conversacion con persistencia en IndexedDB. Cada conversacion tiene su propio set de documentos y fragmentos. Los datos sobreviven recargas de pagina (F5).

**Estructura:** `Map<conversacionId, DocumentoRAG[]>` (memoria) + IndexedDB `penguinchat-rag` (persistencia) + `Map<string, string>` de redirecciones (para callbacks asincrónicos post-transferencia)

**Persistencia en IndexedDB:**
- DB `penguinchat-rag`, store `documentos`, clave = conversacionId, valor = DocumentoRAG[]
- **Hidratacion al cargar el modulo:** al abrir la pagina, se cargan todos los documentos de IDB a memoria automaticamente. La hidratacion es asincrona pero se inicia inmediatamente
- **Escrituras fire-and-forget:** cuando un documento pasa a estado `"listo"`, se persiste en IDB sin bloquear. Eliminaciones y transferencias tambien actualizan IDB
- Solo se persisten documentos con estado `"listo"` (los que tienen embeddings completos)
- `esperarHidratacion()`: funcion exportada que retorna una promesa. Se usa en `buscarContextoRelevante()` para esperar que IDB termine de cargar antes de buscar
- **Persistencia garantizada:** Se solicita `navigator.storage.persist()` al inicializar el modulo para evitar que el navegador elimine datos de IndexedDB bajo presion de almacenamiento

**Busqueda con umbral de similitud y priorizacion:**
- Retorna los top-10 fragmentos mas similares (maximo)
- Aplica umbral de similitud minima (`0.55`) para filtrar ruido
- Resultados por debajo del umbral se descartan antes de seleccionar top-K
- Incluye `totalFragmentosDocumento` en cada resultado para dar contexto posicional
- **Boost de recencia:** acepta un `Set<string>` opcional de IDs de documentos recien adjuntados. Los fragmentos de esos documentos reciben un boost aditivo de `0.10` en su puntuacion de similitud, asegurando que documentos adjuntados con el mensaje actual se prioricen en los resultados

**Similitud binaria por distancia de Hamming:**
- Los embeddings son `Uint8Array[32]` (256 bits cuantizados)
- Se comparan bit a bit usando XOR + tabla popcount precalculada (256 entradas)
- Resultado normalizado 0..1 (1 = identicos, 0 = opuestos)
- ~100x mas rapido que producto punto sobre Float32Array[256]

**Limpieza al eliminar conversacion (`limpiarDatosConversacion`):**
- Elimina documentos del Map en memoria
- Elimina redirecciones que apuntan al ID de la conversacion (previene memory leak del mapa de redirecciones)
- Elimina datos de IndexedDB
- Se llama desde `contenedor-chat.tsx` via `manejarEliminarConversacion`

#### `extractor-texto.ts` - Extractor de Texto (Fallback)

Extractor de texto para el pipeline fallback en hilo principal. Se carga via `await import("./extractor-texto")` solo cuando el Web Worker no esta disponible. Importa `EXTENSIONES_SOPORTADAS` del registro centralizado para determinar compatibilidad.

**Soporta:**
- **Texto plano y codigo fuente** (~60 extensiones: `.ts`, `.tsx`, `.js`, `.py`, `.go`, `.rs`, `.java`, `.cpp`, `.rb`, `.php`, `.css`, `.html`, `.yaml`, `.sql`, `.graphql`, `.prisma`, y muchas mas): decodifica base64 a UTF-8. Usa el registro centralizado de `separadores-codigo.ts` para determinar compatibilidad
- **Archivos sin extension** conocidos: `Dockerfile`, `Makefile`, `Jenkinsfile`, etc.
- **Jupyter Notebooks** (`.ipynb`): parsea el JSON del notebook, extrae texto de celdas markdown (tal cual), celdas de codigo (envueltas en code fences con lenguaje del kernel) con sus salidas de texto (stdout, text/plain), y celdas raw. Separa celdas con `---`. Trunca salidas largas a 500 chars. Ignora salidas binarias (imagenes)
- **PDF** (via pdfjs-dist): extrae texto pagina por pagina reconstruyendo saltos de linea por posicion Y
- **Lista negra**: Rechaza archivos minificados (`.min.js`, `.min.css`), lockfiles (`package-lock.json`, `yarn.lock`), binarios (`.exe`, `.dll`, `.wasm`), multimedia y comprimidos

**Funcion principal:** `extraerTextoDeArchivo(contenidoBase64, tipoMime, nombre)` → `ResultadoExtraccion`

#### `fragmentador-texto.ts` - Fragmentador de Texto (Fallback)

Fragmentador de texto con solapamiento para el pipeline fallback. Se carga via `await import("./fragmentador-texto")` solo cuando el Web Worker no esta disponible.

**Funciones principales:**
- `fragmentarTexto(texto, opciones?)` → `Fragmento[]`: Fragmentacion generica para PDFs y texto plano
- `fragmentarCodigo(texto, nombreArchivo, opciones?)` → `Fragmento[]`: Fragmentacion inteligente por lenguaje. Detecta la extension del archivo y usa separadores jerarquicos del lenguaje (funciones, clases, exports) antes de caer a separadores genericos

**Algoritmo:**
- Fragmentos de 2000 chars con 200 de solapamiento (por defecto)
- Para codigo: primero intenta separadores de lenguaje (umbral 0.3), luego genéricos
- Puntos de corte naturales: parrafo > oracion > linea > espacio
- Limpieza de texto (saltos excesivos, espacios redundantes)

#### `separadores-codigo.ts` - Registro Centralizado de Extensiones

Modulo centralizado que define todas las extensiones soportadas, separadores por lenguaje y lista negra. Usado por: `worker-embeddings`, `fragmentador-texto`, `extractor-texto`, `procesador-rag`, `entrada-mensaje`.

**Extensiones soportadas (~60) agrupadas por familia:**

| Familia | Extensiones |
|---------|------------|
| Web/Frontend | `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.vue`, `.svelte`, `.astro`, `.css`, `.scss`, `.sass`, `.less`, `.html`, `.htm`, `.svg` |
| Backend/Sistemas | `.c`, `.cpp`, `.h`, `.hpp`, `.cc`, `.java`, `.cs`, `.go`, `.rs`, `.swift`, `.kt`, `.php`, `.rb`, `.dart` |
| Scripts/Datos | `.py`, `.pyw`, `.sh`, `.bash`, `.zsh`, `.bat`, `.ps1`, `.r`, `.csv`, `.tsv`, `.ipynb` |
| Configuracion | `.json`, `.yaml`, `.yml`, `.xml`, `.toml`, `.env`, `.ini`, `.cfg`, `.conf`, `.gitignore`, `.dockerignore`, `.editorconfig` |
| Documentacion | `.md`, `.mdx`, `.txt`, `.rst`, `.tex`, `.log` |
| DB/Consultas | `.sql`, `.graphql`, `.gql`, `.prisma` |
| Otros | `.pdf` (procesado con pdfjs-dist) |

**Archivos sin extension conocidos:** `Dockerfile`, `Makefile`, `Gemfile`, `Rakefile`, `Procfile`, `Vagrantfile`, `Jenkinsfile`

**Lista negra (archivos que se rechazan):**

| Tipo | Ejemplos |
|------|----------|
| Minificados | `.min.js`, `.min.css`, `.map` |
| Lockfiles | `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `composer.lock`, `cargo.lock` |
| Binarios | `.exe`, `.dll`, `.so`, `.class`, `.pyc`, `.wasm`, `.jar` |
| Multimedia | `.png`, `.jpg`, `.mp4`, `.mp3`, `.zip`, `.tar`, `.gz` |
| Bases de datos | `.sqlite`, `.db` |

**Separadores por lenguaje (patron LangChain RecursiveCharacterTextSplitter):**

Cada lenguaje tiene una lista jerarquica de separadores ordenados del mas especifico al menos especifico. Por ejemplo para TypeScript: `\nexport function ` → `\nexport class ` → `\nfunction ` → `\nclass ` → `\nconst ` → `\n\n` → `\n`. El algoritmo busca el separador mas especifico primero con un umbral agresivo (0.3 del tamano del fragmento) para mantener funciones y clases completas como unidades semanticas.

**Funciones exportadas:**

| Funcion | Descripcion |
|---------|-------------|
| `obtenerSeparadores(nombre)` | Retorna separadores de lenguaje para un archivo, o `null` si no tiene especificos |
| `esArchivoSoportado(nombre)` | Verifica si un archivo puede procesarse con RAG |
| `esArchivoProhibido(nombre)` | Verifica si un archivo esta en la lista negra |
| `extraerExtension(nombre)` | Extrae y normaliza la extension de un archivo |
| `generarAceptarExtensiones()` | Genera la cadena para el atributo `accept` del input de archivos HTML |

#### `procesador-rag.ts` - Orquestador del Pipeline

Coordina todo el pipeline RAG y expone las funciones principales. Delega el procesamiento pesado al motor de embeddings (`procesarArchivoCompleto()`), que a su vez lo delega al Web Worker.

**Pipeline de ingesta (`procesarDocumentoParaRAG`):**
```
pendiente → extrayendo → fragmentando → vectorizando → listo | error
```

- Delega el pipeline completo a `procesarArchivoCompleto()` del motor de embeddings
- Traduce el progreso del motor al formato del procesador (porcentaje 0-100%)
- Convierte `FragmentoProcesado[]` (del motor) a `FragmentoDocumento[]` (del almacen)
- Actualiza el almacen de vectores en cada cambio de estado
- El Web Worker maneja batching, heuristicas y streaming internamente

**Pipeline de busqueda (`buscarContextoRelevante`):**
1. Espera hidratacion de IndexedDB (`await esperarHidratacion()`, no-op si ya completo)
2. Verifica que hay fragmentos listos en la conversacion
3. Genera embedding binario de la consulta del usuario
4. Busca los 10 fragmentos mas similares por distancia de Hamming (con umbral 0.55)
5. Retorna resultados con similitud, nombre del documento y total de fragmentos

**Construccion de contexto (`construirContextoParaPrompt`):**
- Fusiona fragmentos adyacentes del mismo documento (indices consecutivos)
- Usa estructura XML para marcadores fuertes que los LLMs atienden mejor
- Incluye posicion en el documento como atributos XML
- Instruccion posicionada al final (recencia) para maxima atencion del modelo (paper "Lost in the Middle", Liu et al. 2023)
```xml
<contexto-documentos>
<fragmento indice="1" fuente="documento.pdf" posicion="seccion 15 de 487">
<texto del fragmento>
</fragmento>

<fragmento indice="2" fuente="documento.pdf" posicion="secciones 45-47 de 487">
<texto fusionado de fragmentos adyacentes>
</fragmento>
</contexto-documentos>

<instruccion>Usa la informacion de los fragmentos anteriores para responder la pregunta del usuario. Cita las fuentes cuando sea relevante.</instruccion>

<mensaje original del usuario>
```

### Integracion con el Chat

**`contenedor-chat.tsx`** gestiona la integracion RAG:

1. **Al adjuntar archivo:** `manejarAdjuntoRAG()` procesa inmediatamente:
   - Solo archivos soportados (~60 extensiones de codigo, PDFs, documentos) → pipeline RAG completo
   - Archivos en lista negra (minificados, lockfiles, binarios) se rechazan automaticamente
   - Imagenes se ignoran (pasan directo a la API al enviar)
   - Si no hay conversacion activa, usa un ID temporal (`idRAGTemporal`)
   - El boton de enviar se bloquea hasta que la indexacion termine (`estaIndexandoRAG`)

2. **Al enviar mensaje:** `manejarEnvio()`:
   - Si hay ID temporal de RAG, crea la conversacion y transfiere los documentos (`transferirDocumentos`)
   - Separa imagenes (para API) de documentos (ya indexados) usando `debeUsarRAG()`
   - Busca contexto RAG relevante con `obtenerContenidoConContextoRAG()`
   - Cuenta tokens del contexto RAG y calcula presupuesto dinamico del modelo
   - Trunca el historial si excede el presupuesto con `truncarHistorial()`

3. **En edicion, reenvio y regeneracion:** el contexto RAG se re-busca con cada mensaje para mantener relevancia

4. **Al eliminar adjunto:** `manejarEliminarDocumentoRAG()`:
   - Busca el documento RAG asociado al adjunto via `adjuntoId`
   - Llama a `eliminarDocumento()` del almacen de vectores
   - Actualiza el estado UI de documentos RAG
   - Funciona incluso si el documento esta aun en proceso de indexacion

5. **UI (indicador-rag.tsx):** muestra en la entrada de mensaje:
   - Documentos en proceso (con spinner y porcentaje)
   - Documentos indexados (badge verde con total de fragmentos)
   - Documentos con error (badge rojo con tooltip de error)

### Configuracion de Next.js para RAG (`next.config.ts`)

```typescript
// Excluir dependencias de Node.js que no se usan en el navegador
turbopack: {
  resolveAlias: {
    sharp: { browser: "" },           // No se necesita en browser
    "onnxruntime-node": { browser: "" }, // Usa onnxruntime-web automaticamente
  },
},
webpack: (config) => {
  config.resolve.alias = {
    ...config.resolve.alias,
    "sharp$": false,
    "onnxruntime-node$": false,
  };
  return config;
},
```

### Decisiones de Diseno

1. **Sin CDN:** Todo se sirve localmente. El worker de PDF.js se copia a `public/`. El modelo de embeddings se descarga de HuggingFace Hub y se cachea en el navegador.

2. **Uint8Array binario nativo:** Los embeddings se almacenan como `Uint8Array[32]` (cuantizados desde Float32Array[256]). Reduce memoria 32x respecto a Float32Array y habilita busqueda por distancia de Hamming (XOR + popcount, ~100x mas rapido que producto punto).

3. **Umbral de similitud 0.55:** Los resultados con similitud binaria por debajo de 0.55 se descartan (con 256 bits, vectores aleatorios promedian ~0.5 de similitud, asi que 0.55 filtra solo ruido). Se retornan hasta 10 fragmentos (top-K=10) para dar cobertura adecuada en documentos grandes. Fragmentos adyacentes del mismo documento se fusionan automaticamente para dar contexto continuo al LLM.

4. **Importaciones dinamicas:** `pdfjs-dist` y `@huggingface/transformers` se importan dinamicamente (`await import(...)`) para evitar errores SSR (ambas librerias requieren APIs del navegador como `DOMMatrix`, `Worker`, etc.).

5. **Per-conversacion con persistencia:** Los vectores viven en un `Map<conversacionId, DocumentoRAG[]>` en memoria, respaldado por IndexedDB (`penguinchat-rag`). Al recargar la pagina (F5), los documentos indexados se rehidratan automaticamente desde IDB. Al cambiar de conversacion, los documentos se mantienen en memoria.

6. **Indexacion al adjuntar (no al enviar):** Los documentos se procesan inmediatamente cuando el usuario los adjunta, no cuando envia el mensaje. Esto elimina la espera al enviar y permite que el usuario vea el progreso antes de escribir. El boton de enviar se bloquea hasta que la indexacion termine.

7. **ID temporal de RAG:** Cuando el usuario adjunta un archivo antes de crear una conversacion (pantalla de inicio), se genera un ID temporal para almacenar los vectores. Al enviar el primer mensaje, los documentos se transfieren al ID real de la conversacion via `transferirDocumentos()`.

8. **Presupuesto dinamico de tokens por modelo:** El historial de mensajes se trunca usando un presupuesto calculado como `ventanaContexto - maxTokensSalida - tokensSystemPrompt - tokensRAG - margenSeguridad(512)`. El presupuesto es especifico por modelo: GPT-4o tiene ventana de 128K con max salida 16K, GPT-5.2 tiene 200K con 32K, GPT-4.1 tiene 1M con 32K. Los tokens del system prompt se cuentan una sola vez (es estatico, ~500 tokens) y se cachean en `tokensSystemPromptCache`. Los tokens del contexto RAG se cuentan en cada envio (varian por consulta). Los mensajes mas antiguos se recortan en pares completos (usuario+asistente). Siempre se conservan al menos los ultimos 4 mensajes (2 intercambios completos). Los conteos de tokens se cachean por contenido de mensaje (Map con FIFO eviction, max 500 entradas) para evitar recontar en cada envio. `countTokens` se llama con `{ allowedSpecial: 'all' }` para tolerar tokens especiales literales (como `<|endoftext|>`) que pueden aparecer en conversaciones sobre tokenizacion o prompts.

9. **Modelo de embeddings optimizado:** Se usa `mixedbread-ai/mxbai-embed-xsmall-v1` en vez de `all-MiniLM-L6-v2` porque tiene la misma dimension base (384) y tamano (~24MB int8) pero con ventana de contexto de 4096 tokens vs 256. Esto permite codificar fragmentos completos sin truncamiento. En WASM se carga con `dtype: "q8"` (cuantizado). En WebGPU se usa `dtype: "fp32"` (optimo para GPU).

10. **Fragmentos de 2000 chars con 200 de solapamiento (normal) / 3000 chars con 300 (archivos grandes):** En modo normal, los fragmentos de 2000 caracteres (~500-800 tokens) encajan dentro de la ventana del modelo de embeddings (4096 tokens) con margen amplio. Para archivos >5MB, se usan chunks de 3000 chars para reducir el numero total de fragmentos y acelerar el procesamiento. El solapamiento (10%) evita perder contexto en los bordes. Puntos de corte inteligentes respetan limites de parrafo y oracion.

11. **Eliminacion de documentos RAG:** Al quitar un adjunto via el boton X, se elimina automaticamente su indice del almacen de vectores usando el campo `adjuntoId` que correlaciona adjuntos con documentos RAG. Si el documento esta aun indexandose, el callback de progreso hace no-op al no encontrar la entrada en el estado UI.

12. **Web Worker con pipeline completo, Transferable Objects y fallback:** Todo el pipeline RAG (extraccion PDF.js + fragmentacion + vectorizacion ONNX) se ejecuta en un Web Worker dedicado. El hilo principal solo envia el ArrayBuffer crudo del archivo y recibe mensajes de progreso y resultados. Los embeddings binarios se transfieren via **Transferable Objects** (cero copias, 0ms de transferencia). El ArrayBuffer se mueve, no se copia, y queda inaccesible en el Worker tras la transferencia. La decodificacion de base64 a ArrayBuffer usa `fetch(dataUrl)` que delega al decodificador nativo del navegador (mucho mas rapido que un loop manual). **Si el Worker falla** (CSP estrictos, Workers anidados incompatibles, falta de RAM), se activa un pipeline fallback en el hilo principal que carga `extractor-texto.ts` y `fragmentador-texto.ts` via `await import()` dinamico — solo se descargan si se necesitan, sin aumentar el bundle principal.

13. **Aceleracion WebGPU:** El Worker detecta automaticamente si WebGPU esta disponible via `navigator.gpu.requestAdapter()`. Si lo esta, usa la GPU para inferencia (~10x mas rapido que WASM). Si no, usa WASM (CPU). Si WebGPU falla en runtime, reintenta con WASM automaticamente.

14. **Truncamiento Matryoshka (MRL):** Los embeddings de 384 dimensiones se truncan a 256 dimensiones usando Matryoshka Representation Learning. El modelo esta entrenado para que las primeras N dimensiones sean un embedding valido. Tras truncar, se renormaliza el vector. Resultado: 33% menos memoria por embedding, 33% mas rapido en busqueda por similitud, sin perdida significativa de calidad.

15. **Cuantizacion binaria:** Despues del truncamiento Matryoshka, cada dimension float se convierte en un bit (>= 0 → 1, < 0 → 0). Los 256 bits se empaquetan en 32 bytes (`Uint8Array[32]`). Reduccion total: 384 floats (1536 bytes) → 32 bytes (**48x**). La busqueda por distancia de Hamming (XOR + popcount con tabla precalculada de 256 entradas) es ~100x mas rapida que el producto punto sobre Float32Array. La cuantizacion se aplica en el Worker para minimizar la transferencia de datos.

16. **Persistencia en IndexedDB:** Los documentos indexados (estado `"listo"` con embeddings) se persisten automaticamente en IndexedDB (DB `penguinchat-rag`). Al recargar la pagina, el modulo se rehidrata automaticamente cargando todos los datos de IDB a memoria. Las escrituras son fire-and-forget (no bloquean). El `procesador-rag` espera la hidratacion (`await esperarHidratacion()`) antes de buscar contexto, garantizando que los datos persistidos esten disponibles sin race conditions.

17. **Pipeline streaming con async generators:** El Worker usa `async function*` (async generators) para crear un pipeline streaming de tres etapas: `extraerPaginas() → fragmentarStream() → vectorizar`. Cada pagina se extrae y fragmenta bajo demanda (lazy evaluation). Los fragmentos se acumulan en batches y se vectorizan cuando el batch se llena. Esto permite que el progreso empiece a reportarse en menos de 1 segundo incluso para documentos grandes: no es necesario extraer todo el texto antes de empezar a fragmentar y vectorizar.

18. **Auto-tuning de batch size por hardware:** El tamano de batch para vectorizacion se ajusta automaticamente segun el hardware detectado: 64 fragmentos para WebGPU y 16 para WASM. Los batches pequenos en WASM dan actualizaciones de progreso mas frecuentes sin penalizar velocidad (CPU procesa tokens secuencialmente). Al final del documento, los fragmentos restantes se drenan inmediatamente sin esperar a llenar el batch.

19. **Heuristicas para archivos grandes:** Archivos >5MB activan optimizaciones automaticas: chunks elasticos de 3000 chars con 300 de solapamiento (vs 2000/200 normal) para reducir el numero total de fragmentos. Para PDFs, las paginas con <100 caracteres se saltan automaticamente (portadas, indices vacios, separadores) para evitar fragmentos de ruido que contaminen los resultados de busqueda.

20. **PDF.js con sub-Worker anidado y extraccion paralela:** Dentro del Web Worker, PDF.js requiere `GlobalWorkerOptions.workerSrc` configurado explicitamente (pdfjs-dist v5 no tiene fallback a "fake worker" mode). Se configura a `/pdf.worker.min.mjs` (servido desde `public/`, copiado via postinstall). PDF.js crea un sub-Worker anidado para el parsing pesado. La extraccion de paginas se hace en lotes paralelos de 4 usando `Promise.all`, aprovechando que pdfjs delega al sub-Worker. Cada pagina usa `getTextContent({ disableNormalization: true })` para evitar normalizacion redundante (ya se hace en `limpiarTexto()`).

21. **Separacion de responsabilidades en tres capas con fallback:** El procesamiento RAG sigue una arquitectura de tres capas: `procesador-rag.ts` (orquestador, gestiona estado y callbacks) → `motor-embeddings.ts` (proxy, convierte base64 a ArrayBuffer via `fetch`, gestiona Worker y fallback) → `worker-embeddings.ts` (ejecucion, pipeline completo). Si el Worker no esta disponible, `motor-embeddings.ts` activa el pipeline fallback en el hilo principal usando `extractor-texto.ts` (extraccion de texto) y `fragmentador-texto.ts` (fragmentacion), cargados via `await import()` dinamico para no penalizar el bundle principal. Esta separacion permite que cada capa evolucione independientemente y que la app funcione incluso en entornos restrictivos.

22. **Progreso como porcentaje unificado (0-100%):** El Worker estima el total de fragmentos antes de procesar: para PDFs usa `numPaginas * 1800 / avanceEfectivo`, para texto usa la longitud en caracteres del texto decodificado (`new TextDecoder("utf-8").decode(archivo).length / avanceEfectivo`). El motor combina progreso de extraccion (0-30% para PDFs, basado en paginas) y vectorizacion (30-100%, basado en fragmentos procesados vs estimados) en un porcentaje unico. Se limita a 99% hasta la confirmacion de completado, que envia un 100% explicito antes de resolver.

23. **Fusion de fragmentos adyacentes en contexto:** Cuando multiples fragmentos consecutivos del mismo documento son relevantes, se fusionan en un solo bloque antes de enviarse al LLM. Esto reduce la duplicacion del texto de solapamiento entre fragmentos y da al modelo una vision mas coherente y continua del contenido. Los fragmentos se presentan con su posicion relativa (seccion X de Y) para dar contexto espacial dentro del documento.

24. **Barra de progreso animada con CSS transition:** El indicador RAG muestra una barra de progreso visual con `transition-all duration-700 ease-out`. Cuando el porcentaje salta entre valores reales (ej: 30% → 52%), la barra crece suavemente durante 700ms con easing. Esto da sensacion de progreso continuo sin datos falsos, complementando los batches mas pequenos (16 WASM / 64 GPU) que proveen actualizaciones mas frecuentes.

25. **Fragmentacion inteligente por lenguaje (patron LangChain):** El sistema RAG detecta el lenguaje del archivo por su extension y usa separadores jerarquicos especificos para fragmentar el codigo en limites semanticos naturales. Para TypeScript/JavaScript se prioriza cortar en `\nexport function `, `\nclass `, `\ninterface `, etc. Para Python en `\nclass `, `\ndef `, `\nasync def `. Para Rust en `\nfn `, `\nstruct `, `\nimpl `. Se soportan 20+ lenguajes con separadores especificos. El umbral de corte es agresivo (0.3 vs 0.7 del generico) para mantener funciones y clases completas como unidades semanticas. Si no se encuentra un separador de lenguaje, cae al algoritmo generico (parrafo > oracion > linea > espacio). Cero dependencias nuevas: los separadores son arrays de strings, sin WASM ni parsers externos.

26. **Registro centralizado de extensiones (`separadores-codigo.ts`):** Todas las extensiones soportadas, la lista negra y los separadores por lenguaje viven en un unico modulo centralizado. Esto elimina la duplicacion: `worker-embeddings`, `fragmentador-texto`, `extractor-texto`, `procesador-rag` y `entrada-mensaje` importan de la misma fuente de verdad. Agregar un nuevo lenguaje es agregar una entrada al mapa de separadores y la extension a la lista.

27. **Priorizacion de documentos recien adjuntados (boost de recencia):** Cuando el usuario adjunta documentos con su mensaje, la busqueda RAG aplica un boost aditivo de `0.10` a los fragmentos de esos documentos. El patron esta inspirado en el `TimeWeightedVectorStoreRetriever` de LangChain (`puntuacion_final = similitud + boost`). El boost se propaga desde `contenedor-chat.tsx` → `procesador-rag.ts` → `almacen-vectores.ts` usando un `Set<string>` con los IDs de documentos recientes. Solo se aplica en `manejarEnvio()` — las acciones de edicion, reenvio y regeneracion no aplican boost (no hay adjuntos nuevos). Con embeddings binarios de 256 bits (donde vectores aleatorios promedian ~0.5 de similitud), un boost de 0.10 es suficiente para elevar significativamente los fragmentos relevantes del documento recien adjuntado sin desplazar completamente resultados de alta similitud de otros documentos.

28. **Soporte de Jupyter Notebooks (.ipynb):** Los archivos `.ipynb` son JSON con un array `cells`. El parser extrae texto semantico de cada celda: markdown se preserva tal cual, codigo se envuelve en code fences (con lenguaje detectado del `metadata.kernelspec.language`, default `python`), y se concatenan salidas de texto (stdout, text/plain de execute_result). Las celdas se separan con `---` como puntos de corte naturales para el fragmentador. Salidas largas se truncan a 500 chars. Salidas binarias (imagenes) se ignoran. El parser existe duplicado en `extractor-texto.ts` (fallback hilo principal) y `worker-embeddings.ts` (Worker) porque el Worker no puede importar del extractor. Los separadores de fragmentacion combinan markdown (headings) y Python (class, def) para respetar limites semanticos del contenido mixto de notebooks.

29. **Liberacion de memoria PDF.js (`docPDF.destroy()`):** Despues de extraer texto de un PDF, el Web Worker llama `docPDF.destroy()` en un bloque `finally` para liberar caches internas de PDF.js (paginas, fuentes, imagenes decodificadas). Sin esta llamada, cada PDF procesado acumula memoria que nunca se libera — con PDFs grandes (100+ paginas con imagenes), esto puede consumir cientos de MB. El `.catch(() => {})` en destroy previene que un error en la limpieza oculte el error original del pipeline.

30. **Persistencia `navigator.storage.persist()`:** Al inicializar el modulo `almacen-vectores.ts`, se solicita persistencia de almacenamiento al navegador via `navigator.storage.persist()`. Esto previene que el navegador elimine silenciosamente los datos de IndexedDB bajo presion de almacenamiento. Es fire-and-forget (no bloquea), y los navegadores modernos suelen auto-conceder para sitios con engagement frecuente.

31. **Contexto RAG con estructura XML (mitigacion "Lost in the Middle"):** El contexto RAG inyectado al prompt usa tags XML (`<contexto-documentos>`, `<fragmento>`, `<instruccion>`) en vez de delimitadores de texto plano. Segun el paper "Lost in the Middle" (Liu et al., 2023), los LLMs atienden mas al inicio y final del contexto. Los tags XML crean limites estructurales que mejoran la atencion. La instruccion de uso se coloca despues de los fragmentos (posicion de recencia). Los atributos XML (`fuente`, `posicion`) dan metadata estructurada al modelo sin texto redundante.
