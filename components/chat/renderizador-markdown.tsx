"use client"

import { memo, useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import type { Components } from "react-markdown"
import { BloqueCodigoConResaltado } from "@/components/chat/bloque-codigo"
import { useMensaje } from "@/lib/contexto-mensaje"

interface PropiedadesRenderizador {
  contenido: string
}

// ===== Pre-procesamiento de formulas matematicas =====

// Patron de llaves anidadas (hasta 2 niveles): {C_{out} × C_{in}}
const LLAVES = '\\{(?:[^{}]|\\{(?:[^{}]|\\{[^{}]*\\})*\\})*\\}'

/**
 * Regex para tokens con ^{...} o _{...} (con llaves) sin delimitadores $.
 * Captura tokens como: W^{(1)}, Conv^{(l)}, Σ_{l=1}^L, ∂L/∂W^{(l)}
 *
 * Patron combinado: (protegido)|(token_math)
 * - Grupo 1: codigo/math existente → devolver intacto
 * - Grupo 2: token sin delimitadores → envolver en $...$
 */
const REGEX_MATH_SIN_DELIMITADORES = new RegExp(
  '(```[\\s\\S]*?```|`[^`]+`|\\$\\$[\\s\\S]*?\\$\\$|\\$(?!\\$)[^\\n$]*?\\$(?!\\$))' +
  '|' +
  '(?<!\\$)' +
  '([^\\s\\^_$(),;.:\\[\\]→←×·≠≤≥∈]*' +
  '[\\^_]' + LLAVES +
  '(?:[\\^_](?:' + LLAVES + '|\\w))*' +
  ')',
  'g'
)

/**
 * Regex para subscripts/superscripts "desnudos" sin llaves ni delimitadores $.
 * Captura tokens como: h_t, S_t, W_x, C_in, C_out, x^2, n^L, σ_i, h_t^{(l)}
 *
 * Requiere base de una sola letra (latina o griega) para evitar falsos
 * positivos con identificadores de codigo como my_variable o file_name.
 *
 * Patron combinado: (protegido)|(token_bare_math)
 * - Grupo 1: codigo/math existente → devolver intacto
 * - Grupo 2: token con sub/super desnudo → envolver en $...$ con llaves
 */
const REGEX_BARE_SUB_SUPER = new RegExp(
  // Grupo 1: bloques protegidos
  '(```[\\s\\S]*?```|`[^`]+`|\\$\\$[\\s\\S]*?\\$\\$|\\$(?!\\$)[^\\n$]*?\\$(?!\\$))' +
  '|' +
  // Grupo 2: token matematico con subscript/superscript desnudo
  '(?<![A-Za-z0-9_\\\\$])' +                    // no precedido por word char, \, $
  '(' +
  '[A-Za-z\\u0391-\\u03C9]' +                  // base: una sola letra (latina o griega)
  '(?:' +
  '[_^]' +                                    // operador sub/superscript
  '(?:' + LLAVES + '|[A-Za-z0-9]{1,4})' +   // contenido con llaves O 1-4 chars desnudos
  ')+' +                                        // una o mas parejas encadenadas
  ')' +
  '(?![A-Za-z0-9_{\\\\])',                       // no seguido por word char, {, \
  'g'
)

/**
 * Pre-procesa el contenido para mejorar el renderizado de formulas matematicas.
 *
 * Pipeline de 5 pasos que resuelve incompatibilidades entre LLMs y remark-math:
 * 1. Convierte \[...\] → $$...$$ y \(...\) → $...$
 * 2. Envuelve entornos \begin{env}...\end{env} huerfanos en $$
 * 3. Auto-detecta subscripts/superscripts desnudos (h_t, x^2, C_in) y los envuelve en $
 * 4. Auto-detecta tokens con ^{...}/_{...} sin delimitadores y los envuelve en $
 * 5. Reemplaza | por \vert{} dentro de formulas para evitar conflicto con tablas GFM
 *
 * Cada paso usa un patron combinado (protegido|transformar) para preservar
 * bloques de codigo y math existente sin marcadores temporales.
 */
function preprocesarMatematicas(contenido: string): string {
  if (!contenido) return contenido
  let texto = contenido

  // PASO 1: Convertir \[...\] y \(...\) a $$ y $
  texto = texto.replace(
    /(```[\s\S]*?```|`[^`]+`)|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g,
    (coincidencia, codigo, display, inline) => {
      if (codigo !== undefined) return codigo
      if (display !== undefined) return `\n$$\n${display.trim()}\n$$\n`
      if (inline !== undefined) return `$${inline}$`
      return coincidencia
    }
  )

  // PASO 2: Envolver \begin{env}...\end{env} huerfanos en $$
  texto = texto.replace(
    /(```[\s\S]*?```|`[^`]+`|\$\$[\s\S]*?\$\$|\$(?!\$)[^\n$]*?\$(?!\$))|(\\begin\{(\w+\*?)\}[\s\S]*?\\end\{\3\})/g,
    (coincidencia, protegido, entorno) => {
      if (protegido !== undefined) return protegido
      if (entorno !== undefined) return `\n$$\n${entorno}\n$$\n`
      return coincidencia
    }
  )

  // PASO 3: Auto-detectar subscripts/superscripts desnudos (sin llaves ni $)
  // Ejemplo: h_t → $h_{t}$, C_in → $C_{in}$, x^2 → $x^{2}$, W_x^2 → $W_{x}^{2}$
  texto = texto.replace(
    REGEX_BARE_SUB_SUPER,
    (coincidencia, protegido: string | undefined, tokenBare: string | undefined) => {
      if (protegido !== undefined) return protegido
      if (tokenBare !== undefined) {
        // Añadir llaves a subscripts/superscripts desnudos para KaTeX
        const conLlaves = tokenBare.replace(/([_^])([A-Za-z0-9]{1,4})/g, '$1{$2}')
        return `$${conLlaves}$`
      }
      return coincidencia
    }
  )

  // PASO 4: Auto-detectar tokens con ^{...} o _{...} sin delimitadores $
  // Ejemplo: W^{(1)} → $W^{(1)}$, Σ_{l=1}^L → $Σ_{l=1}^L$
  texto = texto.replace(
    REGEX_MATH_SIN_DELIMITADORES,
    (coincidencia, protegido: string | undefined, tokenMath: string | undefined) => {
      if (protegido !== undefined) return protegido
      if (tokenMath !== undefined) return `$${tokenMath}$`
      return coincidencia
    }
  )

  // PASO 5: Reemplazar | por \vert{} dentro de formulas inline/display
  texto = texto.replace(
    /(```[\s\S]*?```|`[^`]+`)|(\$\$[\s\S]*?\$\$)|(\$(?!\$)(?:[^$\n]|\\\$)*?\$(?!\$))/g,
    (coincidencia, codigo, displayMath, inlineMath) => {
      if (codigo !== undefined) return codigo
      if (displayMath !== undefined) return displayMath.replace(/(?<!\\)\|/g, "\\vert{}")
      if (inlineMath !== undefined) return inlineMath.replace(/(?<!\\)\|/g, "\\vert{}")
      return coincidencia
    }
  )

  return texto
}

// Opciones de KaTeX: tolerante a errores durante streaming, accesible, con macros comunes
const opcionesKatex = {
  throwOnError: false,
  strict: false,
  output: "htmlAndMathml" as const,
  minRuleThickness: 0.06,
  macros: {
    "\\R": "\\mathbb{R}",
    "\\N": "\\mathbb{N}",
    "\\Z": "\\mathbb{Z}",
    "\\C": "\\mathbb{C}",
    "\\Q": "\\mathbb{Q}",
    "\\argmin": "\\operatorname{arg\\,min}",
    "\\argmax": "\\operatorname{arg\\,max}",
    "\\softmax": "\\operatorname{softmax}",
    "\\sigmoid": "\\operatorname{sigmoid}",
    "\\ReLU": "\\operatorname{ReLU}",
    "\\grad": "\\nabla",
    "\\diag": "\\operatorname{diag}",
    "\\tr": "\\operatorname{tr}",
    "\\rank": "\\operatorname{rank}",
    "\\sign": "\\operatorname{sign}",
    "\\KL": "\\operatorname{KL}",
  },
  maxSize: 500,
  maxExpand: 500,
}

// remarkMath PRIMERO para que parsee $...$ antes de que GFM interprete | como tabla
const pluginsRemark = [remarkMath, remarkGfm]
const pluginsRehype = [[rehypeKatex, opcionesKatex]] as Parameters<typeof ReactMarkdown>[0]["rehypePlugins"]

// Componentes personalizados base (fuera de renderizado para no recrear)
const baseComponentes: Pick<Components, "pre" | "a" | "table"> = {
  // Pre: passthrough porque BloqueCodigoConResaltado maneja su propio contenedor
  pre({ children }) {
    return <>{children}</>
  },
  // Enlaces: abrir en nueva pestaña
  a({ children, href, ...resto }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...resto}>
        {children}
      </a>
    )
  },
  // Tablas: con scroll horizontal para tablas anchas
  table({ children }) {
    return (
      <div className="overflow-x-auto my-3">
        <table>{children}</table>
      </div>
    )
  },
}

export const RenderizadorMarkdown = memo(function RenderizadorMarkdown({ contenido }: PropiedadesRenderizador) {
  const { estaGenerandose } = useMensaje()

  if (!contenido) return null

  const contenidoProcesado = preprocesarMatematicas(contenido)

  // Memoizamos los componentes que dependen de props/estado (code) combinado con los base
  const componentesMarkdown = useMemo<Components>(() => ({
    ...baseComponentes,
    code(props) {
      const { children, className, node, ...resto } = props
      const coincidenciaLenguaje = /language-([\w:.+-]+)/.exec(className || "")

      // Si tiene clase de lenguaje, es un bloque de codigo (fenced)
      if (coincidenciaLenguaje) {
        let estaCerrado = true

        // Determinar dinamicamente si el bloque ha terminado de ser emitido
        // inspeccionando el texto crudo. El AST siempre asume que un bloque
        // huerfano al final del stream se cierra automaticamente.
        if (estaGenerandose && node?.position?.start?.offset !== undefined) {
          const offset = node.position.start.offset
          const textoDesdeElBloque = contenidoProcesado.slice(offset)
          // Si el string residual luego de las primeras tildes contiene otras tildes (```), el bloque esta cerrado.
          const textoPostApertura = textoDesdeElBloque.replace(/^```[\w:.+-]*\s*/, "")
          estaCerrado = textoPostApertura.includes("```")
        }

        return (
          <BloqueCodigoConResaltado
            codigo={String(children).replace(/\n$/, "")}
            lenguaje={coincidenciaLenguaje[1]}
            posicionOrigen={node?.position?.start?.offset}
            estaCerrado={estaCerrado}
          />
        )
      }

      // Codigo inline
      return (
        <code
          className="bg-[#f3f4f6] text-[#1a1a1a] px-1.5 py-0.5 rounded text-[0.85em] font-mono font-medium"
          {...resto}
        >
          {children}
        </code>
      )
    }
  }), [estaGenerandose, contenidoProcesado])

  return (
    <ReactMarkdown
      remarkPlugins={pluginsRemark}
      rehypePlugins={pluginsRehype}
      components={componentesMarkdown}
    >
      {contenidoProcesado}
    </ReactMarkdown>
  )
})
