# PenguinChat - Documentacion Tecnica

## Descripcion General

PenguinChat es un asistente de inteligencia artificial construido con **Next.js 16**, **React 19** y **TypeScript 5**. Se conecta a la API de OpenAI (Responses API) y soporta streaming en tiempo real, busqueda web, razonamiento (reasoning), adjuntos multimodales y multiples modelos GPT. La arquitectura de proveedores es extensible para soportar Anthropic, Google y otros en el futuro.

---

## Estructura del Proyecto

```
chatslm/
├── app/                          # App Router de Next.js
│   ├── api/                      # Rutas de API (Server-side)
│   │   ├── chat/
│   │   │   └── route.ts          # API de streaming para chat con OpenAI
│   │   └── titulo/
│   │       └── route.ts          # API para generar titulos de conversaciones
│   ├── globals.css               # Estilos globales, tema y animaciones
│   ├── layout.tsx                # Layout raiz (fuentes, providers, metadata)
│   └── page.tsx                  # Pagina principal (renderiza ContenedorChat)
│
├── components/                   # Componentes de React
│   ├── chat/                     # Componentes especificos del chat
│   │   ├── area-chat.tsx         # Area de mensajes con titulo flotante y boton de sidebar
│   │   ├── barra-lateral.tsx     # Sidebar con branding "PenguinChat" (tipografia serif) y lista de conversaciones
│   │   ├── bloque-codigo.tsx     # Bloque de codigo con syntax highlighting
│   │   ├── burbuja-mensaje.tsx   # Mensaje individual (usuario/asistente)
│   │   ├── contenedor-chat.tsx   # Componente orquestador principal
│   │   ├── entrada-mensaje.tsx   # Input con selector de modelos (Popover dos paneles) y adjuntos
│   │   ├── indicador-busqueda.tsx    # Indicador de busqueda web activa
│   │   ├── indicador-pensamiento.tsx # Indicador de reasoning/pensamiento
│   │   ├── indicador-rag.tsx     # Indicador de estado de documentos RAG
│   │   ├── pantalla-inicio.tsx   # Pantalla inicial de bienvenida
│   │   ├── renderizador-markdown.tsx # Procesador de Markdown
│   │   └── tarjetas-citacion.tsx # Tarjetas de fuentes citadas
│   └── ui/                       # Componentes de UI reutilizables (shadcn)
│       ├── avatar.tsx
│       ├── button.tsx            # Boton con variantes (CVA)
│       ├── dropdown-menu.tsx     # Menu desplegable (Radix UI)
│       ├── icono-sparkle.tsx     # Icono sparkle y avatar del asistente
│       ├── iconos-proveedor.tsx  # Iconos SVG de proveedores de IA (OpenAI, etc.)
│       ├── popover.tsx           # Popover accesible (Radix UI)
│       ├── scroll-area.tsx       # Area de scroll personalizada (con fix para Radix issue #926)
│       ├── separator.tsx
│       ├── sheet.tsx             # Panel lateral/drawer
│       └── tooltip.tsx           # Tooltips accesibles
│
├── lib/                          # Logica de negocio y utilidades
│   ├── rag/                      # Sistema RAG (Retrieval-Augmented Generation)
│   │   ├── almacen-vectores.ts   # Almacen de vectores binarios + IndexedDB persistente
│   │   ├── extractor-texto.ts   # Extractor de texto (fallback hilo principal)
│   │   ├── fragmentador-texto.ts # Fragmentador de texto (fallback hilo principal)
│   │   ├── motor-embeddings.ts   # Proxy hacia Web Worker con fallback a hilo principal
│   │   ├── worker-embeddings.ts  # Web Worker: pipeline streaming con async generators
│   │   └── procesador-rag.ts     # Orquestador RAG (delega al motor)
│   ├── almacen-chat.ts           # Store global (useSyncExternalStore)
│   ├── cliente-chat.ts           # Cliente de streaming para la API
│   ├── hooks.ts                  # Hooks personalizados reutilizables
│   ├── modelos.ts                # Catalogo de modelos y proveedores de IA
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
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼──────┐ ┌─────▼────┐ ┌───────▼───────┐
     │  BarraLateral │ │ AreaChat │ │ PantallaInicio│
     │ (sidebar)     │ │ (msgs)   │ │ (bienvenida)  │
     └───────────────┘ └────┬─────┘ └───────────────┘
                            │
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
    ├── 5. Trunca historial si excede limite de caracteres (truncarHistorial)
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
- Streaming con throttle de 30ms para limitar re-renders
- **Indexacion RAG al adjuntar** (`manejarAdjuntoRAG`): procesa documentos inmediatamente al adjuntarlos, no al enviar
- **ID temporal de RAG** (`idRAGTemporal`): almacena vectores antes de crear la conversacion, luego transfiere
- **Bloqueo de envio** (`estaIndexandoRAG`): impide enviar mientras se indexan documentos
- **Inyeccion de contexto RAG** (`obtenerContenidoConContextoRAG`): busca fragmentos relevantes y los prepende al mensaje
- **Truncamiento de historial** (`truncarHistorial`): recorta mensajes antiguos cuando el historial excede ~150K caracteres

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

### `cliente-chat.ts` - Cliente de Streaming

Funcion `enviarMensajeConStreaming()` que:
- Envia peticion POST a `/api/chat`
- Lee el stream con `ReadableStream` y `TextDecoder`
- Parsea eventos SSE (Server-Sent Events) linea por linea
- Maneja buffer incompleto para chunks parciales
- Despacha callbacks tipados: `alActualizar`, `alBusquedaIniciada`, `alCitacion`, etc.

### `burbuja-mensaje.tsx` - Mensaje Individual

Renderiza un mensaje completo con:
- Avatar del asistente (componente `AvatarAsistente`)
- Contenido en Markdown (asistente) o texto plano (usuario)
- Indicadores de pensamiento y busqueda web
- Tarjetas de citacion
- Adjuntos (imagenes y archivos)
- Modo edicion inline para mensajes del usuario
- Botones de accion: copiar, editar, reenviar, regenerar
- Nombre del modelo que genero la respuesta (en asistente)

### `renderizador-markdown.tsx` - Procesador Markdown

Usa `react-markdown` con plugins:
- `remark-gfm`: Tablas, task lists, tachado
- `remark-math` + `rehype-katex`: Formulas matematicas con LaTeX
- Componentes personalizados para codigo, enlaces y tablas

### `bloque-codigo.tsx` - Syntax Highlighting

Usa `react-syntax-highlighter` con PrismLight para:
- Resaltado de 30+ lenguajes de programacion
- Tema `oneDark`
- Boton de copiar con retroalimentacion visual
- Etiqueta del lenguaje en la barra superior

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
data: [FIN]
```

**Caracteristicas:**
- Convierte roles del español al ingles (`usuario` → `user`)
- Soporta contenido multimodal (imagenes y archivos en el ultimo mensaje)
- Herramienta de busqueda web habilitada por defecto
- Reasoning habilitado para modelos con `tieneReasoning: true` (definido en `modelos.ts`)
- `max_output_tokens: 4096`

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
| `ModeloDisponible` | Definicion de un modelo con id, nombre, descripcion, proveedor, categoria y `tieneReasoning` |
| `ProveedorIA` | Definicion de un proveedor de IA con id y nombre |
| `EstadoChat` | Estado global de la aplicacion |
| `AccionesChat` | Todas las acciones disponibles del store |

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

| Modelo | Proveedor | Categoria | Reasoning | Descripcion |
|--------|-----------|-----------|-----------|-------------|
| `gpt-5.2` | OpenAI | gpt-5.2 | Si | El mas reciente y capaz |
| `gpt-5.1` | OpenAI | gpt-5.1 | Si | Ideal para codigo y razonamiento |
| `gpt-5` | OpenAI | gpt-5 | Si | Proposito general de la familia GPT-5 |
| `gpt-5-mini` | OpenAI | gpt-5 | Si | Version rapida de GPT-5 |
| `gpt-5-nano` | OpenAI | gpt-5 | Si | Ultra-rapido y economico |
| `gpt-4.1` | OpenAI | gpt-4.1 | No | Versatil y preciso |
| `gpt-4.1-mini` | OpenAI | gpt-4.1 | No | Compacto y economico |
| `gpt-4o` | OpenAI | gpt-4o | No | Multimodal de proposito general |
| `gpt-4o-mini` | OpenAI | gpt-4o | No | Compacto y economico (modelo por defecto) |

---

## Hooks Personalizados (`lib/hooks.ts`)

### `useCopiarAlPortapapeles(duracionMs?)`

Hook para copiar texto al portapapeles con retroalimentacion visual temporal.

```typescript
const { haCopiado, copiar } = useCopiarAlPortapapeles(2000)
// haCopiado: boolean - se activa 2s despues de copiar
// copiar: (texto: string) => Promise<void>
```

Usado en: `burbuja-mensaje.tsx`, `bloque-codigo.tsx`

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
| `--color-claude-bg` | `#f3f0e8` | Fondo principal (crema) |
| `--color-claude-sidebar` | `#ebe5d5` | Fondo del sidebar (beige) |
| `--color-claude-sidebar-hover` | `#ddd7c7` | Hover en sidebar |
| `--color-claude-input` | `#ffffff` | Fondo de inputs |
| `--color-claude-input-border` | `#d4cdbf` | Borde de inputs |
| `--color-claude-texto` | `#2d2b28` | Texto principal (oscuro) |
| `--color-claude-texto-secundario` | `#6b6560` | Texto secundario (gris) |
| `--color-claude-acento` | `#d97757` | Color de acento (ocre/naranja) |
| `--color-claude-acento-hover` | `#c4613f` | Hover del acento |
| `--color-claude-usuario-burbuja` | `#ebe5d5` | Fondo burbuja del usuario |

### Tipografia

- **Sans-serif:** Geist Sans (fuente principal)
- **Monospace:** Geist Mono (bloques de codigo)
- **Serif:** Instrument Serif (branding PenguinChat)

### Animaciones CSS

| Clase | Efecto |
|-------|--------|
| `.cursor-parpadeo` | Cursor parpadeante durante streaming |
| `.icono-busqueda-pulsando` | Pulsacion del icono de busqueda web |
| `.puntos-animados` | Secuencia "..." animada |
| `.icono-pensamiento-girando` | Rotacion del spinner de reasoning |

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
3. **Streaming en tiempo real** con throttle de 30ms para rendimiento optimo
4. **Busqueda web integrada** con indicador visual y fuentes citadas
5. **Reasoning/Pensamiento** visible con summary en streaming
6. **Adjuntos multimodales** (imagenes y archivos de texto)
7. **RAG local en el navegador**: procesamiento de documentos (PDF, TXT, etc.) con pipeline streaming completo en Web Worker (async generators), embeddings binarios via WebGPU/WASM, pipeline Matryoshka (384→256 dims) → cuantizacion binaria (256 bits → 32 bytes), auto-tuning de batch size (WebGPU: 128, WASM: 32), heuristicas para archivos grandes (chunks elasticos, filtrado de paginas ruido), busqueda por distancia de Hamming, persistencia en IndexedDB e inyeccion de contexto relevante al LLM
8. **Indexacion inmediata al adjuntar**: los documentos se procesan al adjuntarlos, no al enviar el mensaje, con indicador visual de progreso
9. **Bloqueo de envio durante indexacion**: el boton de enviar se deshabilita mientras hay documentos RAG en proceso
10. **Truncamiento inteligente del historial**: recorte automatico de mensajes antiguos cuando la conversacion excede ~150K caracteres, conservando al menos los ultimos 4 mensajes
11. **Eliminacion de documentos RAG**: al quitar un adjunto, se elimina tambien su indice del almacen de vectores
12. **Edicion de mensajes** del usuario con recorte automatico del historial
13. **Regeneracion de respuestas** manteniendo contexto
14. **Reenvio de mensajes** con nueva respuesta
15. **Gestion de conversaciones** (crear, renombrar, eliminar, creacion lazy al enviar primer mensaje)
16. **Generacion automatica de titulos** en el primer intercambio
17. **Titulo flotante editable** sin header fijo, como boton absolute sobre el area de chat
18. **Markdown completo** con GFM, matematicas KaTeX y highlighting de codigo
19. **Nombre del modelo** visible junto a los botones de accion del asistente
20. **Branding PenguinChat** con tipografia serif en la cabecera del sidebar
21. **Tarjetas de citacion** con preview de YouTube y favicons
22. **UI/UX moderna** estilo chat premium con tema ocre/beige
23. **Truncado fiable en sidebar** con cadena defensiva de overflow y workaround para Radix UI ScrollArea issue #926

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

**UI del selector:** El trigger muestra solo `Nombre Modelo ▼` (sin icono), posicionado a la derecha del input junto al boton de enviar. Al hacer click se abre un Popover (`align="end"`) con dos paneles:
- **Panel izquierdo (w-12):** Sidebar vertical con iconos de proveedores (boton por cada proveedor), el activo se resalta con fondo hover
- **Panel derecho:** Lista de modelos agrupados por categoria del proveedor seleccionado, con check en el modelo activo

El `proveedorActivo` se maneja con estado local dentro de `EntradaMensaje`. Al seleccionar un modelo, el Popover se cierra automaticamente.

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

---

## Sistema RAG (Retrieval-Augmented Generation)

### Que es RAG

RAG es una tecnica para dar a un LLM informacion que no tiene en su entrenamiento. Se usa cuando el usuario sube archivos grandes (PDFs, documentos de texto) que no caben o no es eficiente enviar completos al modelo. En vez de enviar todo el documento, RAG extrae solo los fragmentos relevantes a la pregunta del usuario.

**RAG es para documentos, no para la conversacion.** La conversacion ya se envia completa al LLM como historial. RAG resuelve el problema de archivos grandes.

### Arquitectura RAG

```
Archivo subido por el usuario (base64)
    │
    ▼
┌─── motor-embeddings.ts (proxy) ──────────────────────────────────┐
│  decodificarBase64() → ArrayBuffer                               │
│  Transferable Object (zero-copy) ──────────────────────────┐     │
│                                                             │     │
│  ┌── worker-embeddings.ts (Web Worker) ────────────────────▼────┐│
│  │                                                               ││
│  │  Pipeline streaming con async generators:                     ││
│  │                                                               ││
│  │  1. extraerPaginas()     2. fragmentarStream()   3. vectorizar││
│  │  ┌────────────────┐    ┌───────────────────┐    ┌────────────┐││
│  │  │ async function*│    │ async function*   │    │ auto-batch │││
│  │  │ PDF.js (sub-   │ →  │ yield chunks con  │ →  │ WebGPU: 64 │││
│  │  │ Worker, 4 pags │    │ solapamiento      │    │ WASM: 16   │││
│  │  │ en paralelo)   │    │ elastico:         │    │ ONNX(384)  │││
│  │  │                │    │ normal: 2000/200  │    │ →MRL(256)  │││
│  │  │ yield pagina   │    │ grande: 3000/300  │    │ →Bin(32B)  │││
│  │  └────────────────┘    └───────────────────┘    └────────────┘││
│  │                                                               ││
│  │  Heuristicas: >5MB → chunks grandes, <100 chars → skip pag   ││
│  │                                                               ││
│  │  ──── Transferable Objects (embeddings binarios) ────────►    ││
│  └───────────────────────────────────────────────────────────────┘│
│                              │                                    │
│                              ▼                                    │
│                          ┌──────────────────┐                    │
│                          │ Almacen Vectores │                    │
│                          │ Map<convId, docs>│                    │
│                          │ + IndexedDB      │                    │
│                          └──────────────────┘                    │
└──────────────────────────────────────────────────────────────────┘

Usuario hace una pregunta
    │
    ▼
┌──────────────────────────────────────────────────────────────────┐
│                    PIPELINE DE BUSQUEDA                          │
│                                                                  │
│  1. Embedding consulta     2. Similitud Hamming      3. Contexto   │
│  ┌──────────────────┐    ┌────────────────────┐   ┌──────────┐   │
│  │ "resume el doc"  │    │ Top-10 fragmentos  │   │ Prepende │   │
│  │ → Uint8Array[32] │ →  │ mas similares      │ → │ al msg   │   │
│  └──────────────────┘    │ (dist. Hamming,    │   │ del user │   │
│                          │  umbral > 0.55)    │   └──────────┘   │
│                          └────────────────────┘                  │
└──────────────────────────────────────────────────────────────────┘
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
- `fragmentarStream()`: `async function*` que consume el stream de paginas y yield chunks con solapamiento. Acumula texto en buffer, corta en puntos naturales (parrafo > oracion > linea > espacio), y deja solapamiento para no perder contexto
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

**Estructura:** `Map<conversacionId, DocumentoRAG[]>` (memoria) + IndexedDB `penguinchat-rag` (persistencia)

**Persistencia en IndexedDB:**
- DB `penguinchat-rag`, store `documentos`, clave = conversacionId, valor = DocumentoRAG[]
- **Hidratacion al cargar el modulo:** al abrir la pagina, se cargan todos los documentos de IDB a memoria automaticamente. La hidratacion es asincrona pero se inicia inmediatamente
- **Escrituras fire-and-forget:** cuando un documento pasa a estado `"listo"`, se persiste en IDB sin bloquear. Eliminaciones y transferencias tambien actualizan IDB
- Solo se persisten documentos con estado `"listo"` (los que tienen embeddings completos)
- `esperarHidratacion()`: funcion exportada que retorna una promesa. Se usa en `buscarContextoRelevante()` para esperar que IDB termine de cargar antes de buscar

**Busqueda con umbral de similitud:**
- Retorna los top-10 fragmentos mas similares (maximo)
- Aplica umbral de similitud minima (`0.55`) para filtrar ruido
- Resultados por debajo del umbral se descartan antes de seleccionar top-K
- Incluye `totalFragmentosDocumento` en cada resultado para dar contexto posicional

**Similitud binaria por distancia de Hamming:**
- Los embeddings son `Uint8Array[32]` (256 bits cuantizados)
- Se comparan bit a bit usando XOR + tabla popcount precalculada (256 entradas)
- Resultado normalizado 0..1 (1 = identicos, 0 = opuestos)
- ~100x mas rapido que producto punto sobre Float32Array[256]

#### `extractor-texto.ts` - Extractor de Texto (Fallback)

Extractor de texto para el pipeline fallback en hilo principal. Se carga via `await import("./extractor-texto")` solo cuando el Web Worker no esta disponible.

**Soporta:**
- **Texto plano** (.txt, .md, .csv, .json, .xml, .html, .css, .js, .ts, .py): decodifica base64 a UTF-8
- **PDF** (via pdfjs-dist): extrae texto pagina por pagina reconstruyendo saltos de linea por posicion Y

**Funcion principal:** `extraerTextoDeArchivo(contenidoBase64, tipoMime, nombre)` → `ResultadoExtraccion`

#### `fragmentador-texto.ts` - Fragmentador de Texto (Fallback)

Fragmentador de texto con solapamiento para el pipeline fallback. Se carga via `await import("./fragmentador-texto")` solo cuando el Web Worker no esta disponible.

**Funcion principal:** `fragmentarTexto(texto, opciones?)` → `Fragmento[]`
- Fragmentos de 2000 chars con 200 de solapamiento (por defecto)
- Puntos de corte naturales: parrafo > oracion > linea > espacio
- Limpieza de texto (saltos excesivos, espacios redundantes)

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
- Incluye posicion en el documento (seccion X de Y)
```
--- CONTEXTO DE DOCUMENTOS SUBIDOS ---

Usa la siguiente informacion extraida de los documentos del usuario...
Los fragmentos estan ordenados por posicion en el documento...

[Fragmento 1] (Fuente: documento.pdf, seccion 15 de 487)
<texto del fragmento>

[Fragmento 2] (Fuente: documento.pdf, secciones 45-47 de 487)
<texto fusionado de fragmentos adyacentes>

--- FIN DEL CONTEXTO ---

Pregunta del usuario:
<mensaje original del usuario>
```

### Integracion con el Chat

**`contenedor-chat.tsx`** gestiona la integracion RAG:

1. **Al adjuntar archivo:** `manejarAdjuntoRAG()` procesa inmediatamente:
   - Solo archivos de documento (PDF, TXT, etc.) → pipeline RAG completo
   - Imagenes se ignoran (pasan directo a la API al enviar)
   - Si no hay conversacion activa, usa un ID temporal (`idRAGTemporal`)
   - El boton de enviar se bloquea hasta que la indexacion termine (`estaIndexandoRAG`)

2. **Al enviar mensaje:** `manejarEnvio()`:
   - Si hay ID temporal de RAG, crea la conversacion y transfiere los documentos (`transferirDocumentos`)
   - Separa imagenes (para API) de documentos (ya indexados) usando `debeUsarRAG()`
   - Busca contexto RAG relevante con `obtenerContenidoConContextoRAG()`
   - Trunca el historial si excede el limite con `truncarHistorial()` (~150K chars)

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

8. **Truncamiento inteligente de historial:** Cuando la conversacion es muy larga (>150K caracteres), los mensajes mas antiguos se recortan automaticamente antes de enviar a la API. Siempre se conservan al menos los ultimos 4 mensajes (2 intercambios completos) para mantener el contexto inmediato.

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

22. **Progreso como porcentaje unificado (0-100%):** El Worker estima el total de fragmentos antes de procesar: para PDFs usa `numPaginas * 1800 / avanceEfectivo`, para texto usa `byteLength / avanceEfectivo`. El motor combina progreso de extraccion (0-30% para PDFs, basado en paginas) y vectorizacion (30-100%, basado en fragmentos procesados vs estimados) en un porcentaje unico. Se limita a 99% hasta la confirmacion de completado, que envia un 100% explicito antes de resolver.

23. **Fusion de fragmentos adyacentes en contexto:** Cuando multiples fragmentos consecutivos del mismo documento son relevantes, se fusionan en un solo bloque antes de enviarse al LLM. Esto reduce la duplicacion del texto de solapamiento entre fragmentos y da al modelo una vision mas coherente y continua del contenido. Los fragmentos se presentan con su posicion relativa (seccion X de Y) para dar contexto espacial dentro del documento.

24. **Barra de progreso animada con CSS transition:** El indicador RAG muestra una barra de progreso visual con `transition-all duration-700 ease-out`. Cuando el porcentaje salta entre valores reales (ej: 30% → 52%), la barra crece suavemente durante 700ms con easing. Esto da sensacion de progreso continuo sin datos falsos, complementando los batches mas pequenos (16 WASM / 64 GPU) que proveen actualizaciones mas frecuentes.
