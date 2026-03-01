import { ContenedorChat } from "@/components/chat/contenedor-chat"
import { ProveedorArtefacto } from "@/lib/contexto-artefacto"

export default function Home() {
  return (
    <ProveedorArtefacto>
      <ContenedorChat />
    </ProveedorArtefacto>
  )
}
