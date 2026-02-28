"use client"

import { memo } from "react"
import { FileText, FileCode, FileSpreadsheet, File, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Adjunto } from "@/lib/tipos"
import { useMiniaturaPDF } from "@/lib/use-miniatura-pdf"

// Categorias de archivo por extension
type CategoriaArchivo = "pdf" | "codigo" | "datos" | "config" | "texto" | "imagen"

const ICONOS_CATEGORIA: Record<CategoriaArchivo, typeof FileText> = {
  pdf: FileText,
  codigo: FileCode,
  datos: FileSpreadsheet,
  config: File,
  texto: FileText,
  imagen: File,
}

const EXTENSIONES_CATEGORIA: Record<string, CategoriaArchivo> = {
  ".pdf": "pdf",
  ".js": "codigo", ".ts": "codigo", ".tsx": "codigo", ".jsx": "codigo",
  ".py": "codigo", ".css": "codigo", ".html": "codigo",
  ".csv": "datos", ".json": "datos", ".xml": "datos",
  ".md": "texto", ".txt": "texto",
  ".png": "imagen", ".jpg": "imagen", ".jpeg": "imagen", ".gif": "imagen", ".webp": "imagen",
}

function obtenerCategoria(nombre: string): CategoriaArchivo {
  const ext = nombre.toLowerCase().slice(nombre.lastIndexOf("."))
  return EXTENSIONES_CATEGORIA[ext] ?? "texto"
}

function obtenerExtension(nombre: string): string {
  const ext = nombre.slice(nombre.lastIndexOf("."))
  return ext.toUpperCase()
}

// --- Componente interno con hook de miniatura PDF ---
interface PropiedadesTarjetaConMiniatura {
  adjunto: Adjunto
  variante: "compacta" | "expandida"
  alEliminar?: () => void
}

/** Wrapper que permite usar el hook useMiniaturaPDF dentro de un .map() */
export const TarjetaArchivoConMiniatura = memo(function TarjetaArchivoConMiniatura({
  adjunto,
  variante,
  alEliminar,
}: PropiedadesTarjetaConMiniatura) {
  const esPDF = adjunto.nombre.toLowerCase().endsWith(".pdf")
  const miniaturaPDF = useMiniaturaPDF(
    esPDF ? adjunto.id : undefined,
    esPDF ? adjunto.contenido : undefined,
    esPDF
  )

  return (
    <TarjetaArchivo
      nombre={adjunto.nombre}
      tipo={adjunto.tipo}
      contenido={adjunto.contenido}
      variante={variante}
      miniaturaPDF={miniaturaPDF}
      alEliminar={alEliminar}
    />
  )
})

// --- Componente principal ---
interface PropiedadesTarjeta {
  nombre: string
  tipo: "imagen" | "archivo"
  contenido?: string
  variante: "compacta" | "expandida"
  miniaturaPDF?: string | null
  alEliminar?: () => void
}

export const TarjetaArchivo = memo(function TarjetaArchivo({
  nombre,
  tipo,
  contenido,
  variante,
  miniaturaPDF,
  alEliminar,
}: PropiedadesTarjeta) {
  const categoria = obtenerCategoria(nombre)
  const Icono = ICONOS_CATEGORIA[categoria]
  const extension = obtenerExtension(nombre)
  const esImagen = tipo === "imagen"
  const esCompacta = variante === "compacta"

  // Imagenes: miniatura directa
  if (esImagen && contenido) {
    return (
      <div className={cn(
        "relative group rounded-lg overflow-hidden border border-[var(--color-claude-input-border)]",
        esCompacta ? "h-12 w-12" : "h-24 w-24"
      )}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={contenido} alt={nombre} className="h-full w-full object-cover" />
        {alEliminar && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-0.5 right-0.5 h-5 w-5 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={alEliminar}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    )
  }

  // PDFs con miniatura generada
  if (miniaturaPDF) {
    return (
      <div className={cn(
        "relative group rounded-lg overflow-hidden border border-[var(--color-claude-input-border)]",
        esCompacta ? "w-[100px]" : "w-[130px]"
      )}>
        <div className={cn(
          "overflow-hidden bg-[var(--color-claude-sidebar)]",
          esCompacta ? "h-12" : "h-16"
        )}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={miniaturaPDF} alt={nombre} className="w-full h-full object-cover object-top" />
        </div>
        <div className="flex items-center gap-1 px-1.5 py-1 bg-white border-t border-[var(--color-claude-input-border)]">
          <span className="text-[10px] text-[var(--color-claude-texto)] truncate flex-1">{nombre}</span>
        </div>
        {alEliminar && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-0.5 right-0.5 h-5 w-5 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={alEliminar}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    )
  }

  // Archivos genericos: chip minimalista
  return (
    <div className={cn(
      "relative group flex items-center gap-2 rounded-lg border border-[var(--color-claude-input-border)] bg-[var(--color-claude-sidebar)]",
      esCompacta ? "h-9 px-2.5" : "h-10 px-3"
    )}>
      <Icono className="h-3.5 w-3.5 shrink-0 text-[var(--color-claude-texto-secundario)]" />
      <span className={cn(
        "text-[var(--color-claude-texto)] truncate min-w-0 flex-1",
        esCompacta ? "text-xs" : "text-[13px]"
      )}>
        {nombre}
      </span>
      <span className="text-[10px] text-[var(--color-claude-texto-secundario)] shrink-0">
        {extension}
      </span>
      {alEliminar && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 text-[var(--color-claude-texto-secundario)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity -mr-0.5"
          onClick={alEliminar}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
})
