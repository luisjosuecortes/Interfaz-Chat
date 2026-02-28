/** Icono sparkle (estrella de 4 puntas) usado como avatar del asistente */
export function IconoSparkle({ tamano = 12 }: { tamano?: number }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 1L6.5 6.5L1 8L6.5 9.5L8 15L9.5 9.5L15 8L9.5 6.5L8 1Z" fill="white" />
    </svg>
  )
}

interface PropiedadesAvatarAsistente {
  tamano?: "sm" | "md" | "lg"
}

/** Avatar circular con gradiente y sparkle para el asistente */
export function AvatarAsistente({ tamano = "sm" }: PropiedadesAvatarAsistente) {
  const clasesTamano = {
    sm: "h-7 w-7",
    md: "h-14 w-14",
    lg: "h-16 w-16",
  }

  const tamanoIcono = {
    sm: 12,
    md: 24,
    lg: 28,
  }

  return (
    <div className={`${clasesTamano[tamano]} shrink-0 rounded-full bg-gradient-to-br from-[#1a1a1a] to-[#374151] flex items-center justify-center shadow-sm`}>
      <IconoSparkle tamano={tamanoIcono[tamano]} />
    </div>
  )
}
