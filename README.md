    # PenguinLabs - Asistente de IA

PenguinLabs es una interfaz de chat avanzada y completa, diseñada para ofrecer una experiencia de usuario premium con capacidades modernas de inteligencia artificial.

## Caracteristicas Principales

- **Interfaz de Chat Completa**: Diseno moderno, responsivo y elegante con soporte para Markdown, LaTeX y syntax highlighting de 50+ lenguajes.
- **Historial de Chats**: Gestion eficiente de conversaciones con almacenamiento local via IndexedDB.
- **Busqueda Web**: Integracion con la API de OpenAI Responses para busqueda e interaccion con informacion en tiempo real.
- **Panel de Artefactos**: Bloques de codigo grandes (>=25 lineas), HTML, SVG, Markdown y LaTeX se abren en un panel lateral con vista previa en vivo, edicion inline y ejecucion de codigo.
- **Ejecucion de Codigo Local**: Ejecuta JavaScript/TypeScript y Python directamente en el navegador sin backend. Los resultados se muestran en el panel de artefactos con tema claro consistente.
- **Herramienta AI de Ejecucion**: Los modelos pueden invocar `ejecutar_codigo` via function calling para verificar calculos y probar logica antes de responder.
- **Cache Persistente de Pyodide**: El runtime de Python (~11MB) y paquetes se cachean via Cache API del navegador, persistiendo entre sesiones.
- **RAG (Retrieval-Augmented Generation)**: Sube documentos y archivos de codigo para busqueda semantica en dos fases (Hamming binario + Cosine re-ranking) usando embeddings WASM locales.
- **Soporte Multi-Proveedor**: OpenAI, Anthropic, Google y xAI con selector visual de modelos.
- **Estetica Premium**: Micro-animaciones, modo claro y diseno tipo Claude/ChatGPT.

## Instalacion y Configuracion

### Requisitos Previos

- [Node.js](https://nodejs.org/) (version 18 o superior)
- npm, yarn, pnpm o bun

### Pasos de Instalacion

1.  **Clonar el repositorio**:
    ```bash
    git clone https://github.com/luisjosuecortes/Interfaz-Chat.git
    cd Interfaz-Chat
    ```
2.  **Instalar dependencias**:
    ```bash
    npm install
    ```
3.  **Configurar variables de entorno**:
    Crea un archivo `.env.local` en la raiz del proyecto:
    ```env
    OPENAI_API_KEY=tu-clave-openai
    ANTHROPIC_API_KEY=tu-clave-anthropic     # opcional
    GOOGLE_API_KEY=tu-clave-google           # opcional
    ```

## Desarrollo

```bash
# Iniciar servidor de desarrollo
npm run dev

# Build de produccion
npm run build

# Iniciar build de produccion
npm start
```

## Stack Tecnologico

- **Framework**: Next.js 16 (App Router, Turbopack)
- **UI**: React 19, Tailwind CSS 4, Radix UI, Shadcn/UI
- **Lenguaje**: TypeScript strict
- **Streaming**: OpenAI Responses API via SSE
- **Embeddings**: HuggingFace Transformers.js (ONNX/WASM)
- **Ejecucion Python**: Pyodide (CPython WASM, cargado desde CDN)
- **Almacenamiento**: IndexedDB (idb-keyval), useSyncExternalStore
- **Syntax Highlighting**: react-syntax-highlighter (Prism, 50+ lenguajes)
- **Matematicas**: KaTeX (renderizado LaTeX)

## Desarrollador
- Luis Cortes
