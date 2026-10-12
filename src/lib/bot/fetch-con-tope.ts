/**
 * `fetch` con tope de tiempo para el cliente de Supabase del bot. El webhook tiene ~20 s de
 * ventana (Vercel corta a los 25): una consulta colgada no debe comerse el turno entero, asi que
 * falla rapido y el handler degrada (mensaje tecnico) en vez de quedarse sin responder.
 */
export function fetchConTope(timeoutMs: number, base: typeof fetch = (...args) => fetch(...args)): typeof fetch {
  return (input, init) => {
    const tope = AbortSignal.timeout(timeoutMs);
    const existente = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    // Si ya hay una senal (la del llamador) se respetan ambas; sin AbortSignal.any queda solo el tope.
    const signal = existente && typeof AbortSignal.any === "function" ? AbortSignal.any([existente, tope]) : tope;
    return base(input, { ...init, signal });
  };
}
