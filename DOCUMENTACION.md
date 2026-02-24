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
│   ├── almacen-chat.ts           # Store global (useSyncExternalStore)
│   ├── cliente-chat.ts           # Cliente de streaming para la API
│   ├── hooks.ts                  # Hooks personalizados reutilizables
│   ├── modelos.ts                # Catalogo de modelos y proveedores de IA
│   ├── tipos.ts                  # Tipos e interfaces TypeScript
│   └── utils.ts                  # Utilidades (cn, generarId)
│
├── .env.local                    # Variables de entorno (OPENAI_API_KEY)
├── components.json               # Configuracion de shadcn/ui
├── next.config.ts                # Configuracion de Next.js
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
     ┌────────▼──────┐ ┌────▼─────┐ ┌──────▼────────┐
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
Usuario escribe → EntradaMensaje → ContenedorChat.manejarEnvio()
    │
    ├── 1. Crea conversacion si no existe (almacen-chat)
    ├── 2. Agrega mensaje del usuario al store
    ├── 3. Llama a enviarConsultaAlModelo()
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

---

## Funcionalidades

1. **Chat conversacional** con multiples modelos y proveedores de IA
2. **Selector de modelos con panel de proveedores** (Popover): trigger a la derecha, panel con sidebar de iconos de proveedores a la izquierda y modelos agrupados por categoria a la derecha
3. **Streaming en tiempo real** con throttle de 30ms para rendimiento optimo
4. **Busqueda web integrada** con indicador visual y fuentes citadas
5. **Reasoning/Pensamiento** visible con summary en streaming
6. **Adjuntos multimodales** (imagenes y archivos de texto)
7. **Edicion de mensajes** del usuario con recorte automatico del historial
8. **Regeneracion de respuestas** manteniendo contexto
9. **Reenvio de mensajes** con nueva respuesta
10. **Gestion de conversaciones** (crear, renombrar, eliminar, creacion lazy al enviar primer mensaje)
11. **Generacion automatica de titulos** en el primer intercambio
12. **Titulo flotante editable** sin header fijo, como boton absolute sobre el area de chat
13. **Markdown completo** con GFM, matematicas KaTeX y highlighting de codigo
14. **Nombre del modelo** visible junto a los botones de accion del asistente
15. **Branding PenguinChat** con tipografia serif en la cabecera del sidebar
16. **Tarjetas de citacion** con preview de YouTube y favicons
17. **UI/UX moderna** estilo chat premium con tema ocre/beige
18. **Truncado fiable en sidebar** con cadena defensiva de overflow y workaround para Radix UI ScrollArea issue #926

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
