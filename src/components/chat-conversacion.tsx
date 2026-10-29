import { fechaHora, type MensajeIg } from "@/lib/conversaciones";

/** Un chat del bot en burbujas: el cliente a la izquierda y el bot a la derecha. */
export function ChatConversacion({ mensajes }: { mensajes: MensajeIg[] }) {
  return (
    <ol className="space-y-3" aria-label="Mensajes">
      {mensajes.map((m, i) => {
        const delCliente = m.role === "user";
        const fallo = delCliente && m.nota === "no_entendido";
        return (
          <li key={`${m.created_at}-${i}`} className={`flex ${delCliente ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[85%] sm:max-w-[70%] ${delCliente ? "" : "text-right"}`}>
              <p
                className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-left text-sm leading-6 ${
                  delCliente
                    ? "rounded-bl-sm bg-car-gray2 text-car-white"
                    : "rounded-br-sm border border-car-gold/30 bg-car-gold/15 text-car-white"
                } ${fallo ? "ring-1 ring-red-400/60" : ""}`}
              >
                {m.content}
              </p>
              <p className="mt-1 text-[11px] text-car-muted">
                {delCliente ? "Cliente" : "Bot"} · {fechaHora(m.created_at)}
                {fallo && <span className="ml-2 font-semibold text-red-300">El bot no entendió este mensaje</span>}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
