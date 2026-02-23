// Respuestas simuladas para el chat (simula una IA respondiendo)

const RESPUESTAS_GENERICAS = [
  "¡Esa es una excelente pregunta! Permíteme explicarte en detalle.\n\nLo que mencionas es un tema fascinante que tiene múltiples perspectivas. En esencia, se trata de comprender cómo los diferentes elementos interactúan entre sí para crear resultados significativos.\n\nAquí hay algunos puntos clave a considerar:\n\n1. **Contexto**: Es importante entender el contexto completo antes de sacar conclusiones\n2. **Análisis**: Un análisis cuidadoso nos permite ver patrones que de otra forma pasarían desapercibidos\n3. **Aplicación**: Los conocimientos teóricos cobran valor cuando se aplican en la práctica\n\n¿Te gustaría que profundice en alguno de estos aspectos?",

  "Claro, con gusto te ayudo con eso.\n\nPara abordar tu consulta de manera efectiva, podemos dividirla en pasos más manejables:\n\n**Paso 1**: Identificar los requisitos principales\n**Paso 2**: Analizar las opciones disponibles\n**Paso 3**: Implementar la solución más adecuada\n\nCada uno de estos pasos es crucial para garantizar un resultado óptimo. La clave está en no saltarse ningún paso y validar los resultados en cada etapa.\n\n¿Necesitas que entre en más detalle sobre algún paso específico?",

  "Interesante planteamiento. Déjame compartir mi perspectiva al respecto.\n\nEn mi experiencia, este tipo de situaciones se benefician enormemente de un enfoque estructurado. Aquí te comparto una guía:\n\n```\n1. Define claramente el objetivo\n2. Investiga las alternativas\n3. Evalúa pros y contras\n4. Toma una decisión informada\n5. Itera y mejora\n```\n\nRecuerda que no existe una solución perfecta, sino la más adecuada para tu contexto particular. Lo importante es mantener una mentalidad abierta y estar dispuesto a ajustar el rumbo según sea necesario.",

  "¡Por supuesto! Me encanta ayudar con este tipo de cosas.\n\nPrimero, es fundamental tener una visión clara de lo que quieres lograr. Una vez que tengas eso definido, el camino se vuelve mucho más claro.\n\nAlgunos consejos prácticos:\n\n- **Empieza simple**: No intentes resolver todo de una vez\n- **Documenta tu proceso**: Te será útil en el futuro\n- **Pide retroalimentación**: Otras perspectivas enriquecen el resultado\n- **Sé paciente**: Los buenos resultados toman tiempo\n\nEspero que esto te sea útil. No dudes en preguntarme cualquier cosa adicional.",

  "Eso es algo que merece una respuesta bien pensada.\n\nPara darte la mejor orientación posible, consideremos los siguientes aspectos:\n\n### Análisis del problema\nLo que describes es un desafío común que muchas personas enfrentan. La solución generalmente involucra una combinación de técnicas y herramientas.\n\n### Solución propuesta\nMi recomendación es seguir un enfoque iterativo:\n\n1. Prototipa rápidamente una primera versión\n2. Prueba con casos reales\n3. Recoge retroalimentación\n4. Refina y mejora\n\n### Próximos pasos\nSi estás de acuerdo con este enfoque, podemos empezar a detallar cada fase. ¿Qué te parece?",
]

// Simular respuesta con delay tipo "escritura"
export async function simularRespuestaIA(
  mensajeUsuario: string,
  alActualizar: (textoActual: string) => void,
  alFinalizar: () => void,
): Promise<void> {
  const respuesta = RESPUESTAS_GENERICAS[Math.floor(Math.random() * RESPUESTAS_GENERICAS.length)]
  const caracteres = respuesta.split("")
  let textoActual = ""

  for (let i = 0; i < caracteres.length; i++) {
    textoActual += caracteres[i]
    alActualizar(textoActual)
    // Velocidad variable para simular escritura natural
    const velocidad = caracteres[i] === "\n" ? 80 : Math.random() * 20 + 5
    await new Promise((resolver) => setTimeout(resolver, velocidad))
  }

  alFinalizar()
}
