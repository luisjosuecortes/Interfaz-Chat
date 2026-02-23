"use client"

import { useAlmacenChat } from "@/lib/almacen-chat"
import { BarraLateral } from "@/components/chat/barra-lateral"
import { AreaChat } from "@/components/chat/area-chat"
import { PantallaInicio } from "@/components/chat/pantalla-inicio"

export function ContenedorChat() {
  const {
    conversacionActual,
    estaBarraLateralAbierta,
    conversaciones,
    estaEscribiendo,
    crearConversacion,
    eliminarConversacion,
    seleccionarConversacion,
    agregarMensaje,
    actualizarUltimoMensaje,
    alternarBarraLateral,
    establecerEscribiendo,
    renombrarConversacion,
    conversacionActiva,
  } = useAlmacenChat()

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--color-claude-bg)]">
      {/* Barra lateral */}
      <BarraLateral
        estaAbierta={estaBarraLateralAbierta}
        conversaciones={conversaciones}
        conversacionActiva={conversacionActiva}
        alAlternar={alternarBarraLateral}
        alNuevaConversacion={crearConversacion}
        alSeleccionarConversacion={seleccionarConversacion}
        alEliminarConversacion={eliminarConversacion}
        alRenombrarConversacion={renombrarConversacion}
      />

      {/* Área principal */}
      <main className="flex flex-1 flex-col min-w-0">
        {conversacionActual ? (
          <AreaChat
            conversacion={conversacionActual}
            estaEscribiendo={estaEscribiendo}
            estaBarraLateralAbierta={estaBarraLateralAbierta}
            alEnviarMensaje={(contenido: string) => {
              agregarMensaje(conversacionActual.id, {
                rol: "usuario",
                contenido,
              })
            }}
            alActualizarUltimoMensaje={(contenido: string) => {
              actualizarUltimoMensaje(conversacionActual.id, contenido)
            }}
            alAgregarMensajeAsistente={(contenido: string) => {
              agregarMensaje(conversacionActual.id, {
                rol: "asistente",
                contenido,
              })
            }}
            alEstablecerEscribiendo={establecerEscribiendo}
            alAlternarBarraLateral={alternarBarraLateral}
          />
        ) : (
          <PantallaInicio
            estaBarraLateralAbierta={estaBarraLateralAbierta}
            alNuevaConversacion={crearConversacion}
            alAlternarBarraLateral={alternarBarraLateral}
          />
        )}
      </main>
    </div>
  )
}
