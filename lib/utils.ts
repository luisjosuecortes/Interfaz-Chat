import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Combina clases de Tailwind de forma segura */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Genera un ID unico basado en timestamp y aleatorio */
export function generarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9)
}
