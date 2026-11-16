"use client";
import { useMemo, useRef, useState } from "react";
import { calcularFinanciacion } from "@/lib/creditos/calculo";
import { formatMoneda } from "@/lib/creditos/formato";
import { ESTADOS_OPERACION, type Moneda, type OperacionCredito, type PlanFinanciacion, type VehiculoRef } from "@/lib/creditos/types";
import { Autocomplete } from "@/components/creditos/autocomplete";
import { urlBusquedaMercadoLibre } from "@/lib/creditos/mercadolibre";

const PLAZOS_POR_DEFECTO = [12, 24, 36, 48, 60];

const inputClass =
  "w-full rounded border border-white/15 bg-car-gray2 px-4 py-2.5 text-sm text-car-white outline-none focus:border-car-gold";
const labelClass = "mb-1.5 block text-xs uppercase tracking-wide text-car-muted";
const sectionClass = "rounded-lg border border-white/10 bg-car-gray2/60 p-5";
const sectionTitleClass = "mb-4 font-condensed text-sm font-bold uppercase tracking-wide text-car-gold";

export function OperacionEditor({
  operacion,
  planes,
  catalogoRef,
  action,
}: {
  operacion: OperacionCredito;
  planes: PlanFinanciacion[];
  catalogoRef: VehiculoRef[];
  action: (formData: FormData) => Promise<{ ok: false; error: string } | void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitOk, setSubmitOk] = useState(false);

  const [descripcion, setDescripcion] = useState(operacion.vehiculo_descripcion ?? "");
  const [precioPactado, setPrecioPactado] = useState(String(operacion.precio_pactado));
  const [moneda, setMoneda] = useState<Moneda>(operacion.moneda);
  const [estado, setEstado] = useState(operacion.estado);

  const [entregaUsado, setEntregaUsado] = useState(operacion.entrega_usado);
  const [usadoMarca, setUsadoMarca] = useState(operacion.usado_marca ?? "");
  const [usadoModelo, setUsadoModelo] = useState(operacion.usado_modelo ?? "");
  const [usadoAnio, setUsadoAnio] = useState(operacion.usado_anio ? String(operacion.usado_anio) : "");
  const [usadoVersion, setUsadoVersion] = useState(operacion.usado_version ?? "");
  const [usadoDominio, setUsadoDominio] = useState(operacion.usado_dominio ?? "");
  const [usadoKm, setUsadoKm] = useState(operacion.usado_km ?? "");
  const [valorToma, setValorToma] = useState(operacion.valor_toma ? String(operacion.valor_toma) : "");
  const [entregaEfectivo, setEntregaEfectivo] = useState(String(operacion.entrega_efectivo));

  const [clienteNombre, setClienteNombre] = useState(operacion.cliente_nombre);
  const [clienteDni, setClienteDni] = useState(operacion.cliente_dni_cuil ?? "");
  const [clienteWhatsapp, setClienteWhatsapp] = useState(operacion.cliente_whatsapp ?? "");
  const [clienteEmail, setClienteEmail] = useState(operacion.cliente_email ?? "");
  const [clienteDomicilio, setClienteDomicilio] = useState(operacion.cliente_domicilio ?? "");
  const [clienteLocalidad, setClienteLocalidad] = useState(operacion.cliente_localidad ?? "");
  const [situacionLaboral, setSituacionLaboral] = useState(operacion.situacion_laboral ?? "");
  const [notasInternas, setNotasInternas] = useState(operacion.notas_internas ?? "");

  const [planId, setPlanId] = useState(operacion.plan_id ?? "");
  const [plazoMeses, setPlazoMeses] = useState<number | null>(operacion.plazo_meses);
  const [tnaOverride, setTnaOverride] = useState(operacion.tna_aplicada != null ? String(operacion.tna_aplicada) : "");
  const [gastosOverride, setGastosOverride] = useState(
    operacion.gastos_aplicados_pct != null ? String(operacion.gastos_aplicados_pct) : ""
  );

  const planSeleccionado = planes.find((p) => p.id === planId) ?? null;
  const plazosHabilitados = planSeleccionado?.plazos_habilitados ?? PLAZOS_POR_DEFECTO;

  const opcionesCatalogoRef = useMemo(
    () => catalogoRef.map((v) => ({ value: v.id, label: `${v.marca} ${v.modelo}${v.version ? ` ${v.version}` : ""}` })),
    [catalogoRef]
  );

  function elegirUsadoDelCatalogo(id: string) {
    const v = catalogoRef.find((x) => x.id === id);
    if (!v) return;
    setUsadoMarca(v.marca);
    setUsadoModelo(v.modelo);
    setUsadoVersion(v.version ?? "");
  }

  function elegirPlan(id: string) {
    setPlanId(id);
    const p = planes.find((x) => x.id === id);
    if (p) {
      setTnaOverride(String(p.tna_pct));
      setGastosOverride(String(p.gastos_otorgamiento_pct));
    }
  }

  const precio = Number(precioPactado) || 0;
  const toma = entregaUsado ? Number(valorToma) || 0 : 0;
  const efectivo = Number(entregaEfectivo) || 0;
  const capitalAFinanciar = Math.max(precio - efectivo - toma, 0);
  const tnaAplicada = Number(tnaOverride) || 0;
  const gastosAplicados = Number(gastosOverride) || 0;

  const resultado = useMemo(() => {
    if (!plazoMeses || capitalAFinanciar <= 0) return null;
    return calcularFinanciacion({
      capitalAFinanciar,
      tnaPct: tnaAplicada,
      gastosOtorgamientoPct: gastosAplicados,
      plazoMeses,
    });
  }, [capitalAFinanciar, tnaAplicada, gastosAplicados, plazoMeses]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError("");
    setSubmitOk(false);
    setSubmitting(true);
    const resultadoAction = await action(new FormData(formRef.current!));
    setSubmitting(false);
    if (resultadoAction && resultadoAction.ok === false) {
      setSubmitError(resultadoAction.error);
    } else {
      setSubmitOk(true);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <div className={sectionClass}>
          <h2 className={sectionTitleClass}>Vehículo y estado</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>Descripción del vehículo</label>
              <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Precio pactado</label>
              <input type="number" min={0} step="0.01" value={precioPactado} onChange={(e) => setPrecioPactado(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Moneda</label>
              <select value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)} className={inputClass}>
                <option value="ARS">Pesos (ARS)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Estado de la operación</label>
              <select value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)} className={inputClass}>
                {ESTADOS_OPERACION.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className={sectionClass}>
          <h2 className={sectionTitleClass}>Entrega y permuta</h2>
          <label className="mb-4 flex items-center gap-3 text-sm text-car-white">
            <input type="checkbox" checked={entregaUsado} onChange={(e) => setEntregaUsado(e.target.checked)} className="size-4" />
            ¿Entrega usado como parte de pago?
          </label>
          {entregaUsado && (
            <div className="mb-4 grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <label className={labelClass}>Buscar en el catálogo de Argentina</label>
                <Autocomplete
                  options={opcionesCatalogoRef}
                  onSelect={elegirUsadoDelCatalogo}
                  placeholder="Ej: Chevrolet Corsa, Peugeot 208…"
                />
                <p className="mt-1 text-xs text-car-muted">Elegí uno para completar marca, modelo y versión; después los podés editar a mano.</p>
              </div>
              <div>
                <label className={labelClass}>Marca</label>
                <input value={usadoMarca} onChange={(e) => setUsadoMarca(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Modelo</label>
                <input value={usadoModelo} onChange={(e) => setUsadoModelo(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Año</label>
                <input type="number" value={usadoAnio} onChange={(e) => setUsadoAnio(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Versión</label>
                <input value={usadoVersion} onChange={(e) => setUsadoVersion(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Dominio / Patente</label>
                <input value={usadoDominio} onChange={(e) => setUsadoDominio(e.target.value.toUpperCase())} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Kilometraje</label>
                <input value={usadoKm} onChange={(e) => setUsadoKm(e.target.value)} className={inputClass} />
              </div>
              <div className="sm:col-span-3">
                <label className={labelClass}>Valor de toma acordado</label>
                <input type="number" min={0} step="0.01" value={valorToma} onChange={(e) => setValorToma(e.target.value)} className={inputClass} />
                {usadoMarca && (
                  <a
                    href={urlBusquedaMercadoLibre(usadoMarca, usadoModelo, usadoAnio)}
                    target="_blank"
                    rel="noopener"
                    className="mt-1.5 inline-block text-xs font-semibold text-car-gold hover:underline"
                  >
                    Ver precios de referencia en MercadoLibre →
                  </a>
                )}
              </div>
            </div>
          )}
          <div>
            <label className={labelClass}>Entrega en efectivo</label>
            <input type="number" min={0} step="0.01" value={entregaEfectivo} onChange={(e) => setEntregaEfectivo(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className={sectionClass}>
          <h2 className={sectionTitleClass}>Datos del cliente</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>Nombre completo *</label>
              <input value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>DNI / CUIL</label>
              <input value={clienteDni} onChange={(e) => setClienteDni(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>WhatsApp</label>
              <input value={clienteWhatsapp} onChange={(e) => setClienteWhatsapp(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" value={clienteEmail} onChange={(e) => setClienteEmail(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Localidad</label>
              <input value={clienteLocalidad} onChange={(e) => setClienteLocalidad(e.target.value)} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Domicilio</label>
              <input value={clienteDomicilio} onChange={(e) => setClienteDomicilio(e.target.value)} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Situación laboral / ingresos declarados</label>
              <input value={situacionLaboral} onChange={(e) => setSituacionLaboral(e.target.value)} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Notas internas</label>
              <textarea value={notasInternas} onChange={(e) => setNotasInternas(e.target.value)} className={inputClass} rows={3} />
            </div>
          </div>
        </div>

        {submitError && (
          <p className="rounded border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-400">{submitError}</p>
        )}
        {submitOk && !submitError && (
          <p className="rounded border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-400">
            Guardado.
          </p>
        )}
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className={sectionClass}>
          <h2 className={sectionTitleClass}>Ingeniería financiera</h2>

          <div className="mb-4">
            <label className={labelClass}>Línea de crédito</label>
            <select value={planId} onChange={(e) => elegirPlan(e.target.value)} className={inputClass}>
              <option value="">Sin plan asociado</option>
              {planes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className={labelClass}>Plazo</label>
            <div className="flex flex-wrap gap-2">
              {plazosHabilitados.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlazoMeses(p)}
                  className={`rounded px-3 py-2 text-xs font-bold ${
                    plazoMeses === p ? "bg-car-gold text-car-black" : "bg-white/5 text-car-white hover:bg-white/10"
                  }`}
                >
                  {p}x
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>TNA %</label>
              <input type="number" step="0.01" value={tnaOverride} onChange={(e) => setTnaOverride(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Gastos %</label>
              <input type="number" step="0.01" value={gastosOverride} onChange={(e) => setGastosOverride(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="mb-4 space-y-1 border-t border-white/10 pt-4 text-sm">
            <div className="flex justify-between text-car-muted">
              <span>Capital a financiar</span>
              <span className="text-car-white">{formatMoneda(capitalAFinanciar, moneda)}</span>
            </div>
            {resultado && (
              <>
                <div className="flex justify-between text-car-muted">
                  <span>Cuota pura</span>
                  <span className="text-car-white">{formatMoneda(resultado.cuotaPura, moneda)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span className="text-car-muted">Cuota final</span>
                  <span className="font-condensed text-xl italic text-car-gold">{formatMoneda(resultado.cuotaFinal, moneda)}</span>
                </div>
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-car-gold px-5 py-3 font-condensed font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark disabled:opacity-50"
          >
            {submitting ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>

      <input type="hidden" name="vehiculo_descripcion" value={descripcion} />
      <input type="hidden" name="precio_pactado" value={precioPactado} />
      <input type="hidden" name="moneda" value={moneda} />
      <input type="hidden" name="estado" value={estado} />
      <input type="hidden" name="entrega_usado" value={String(entregaUsado)} />
      <input type="hidden" name="usado_marca" value={usadoMarca} />
      <input type="hidden" name="usado_modelo" value={usadoModelo} />
      <input type="hidden" name="usado_anio" value={usadoAnio} />
      <input type="hidden" name="usado_version" value={usadoVersion} />
      <input type="hidden" name="usado_dominio" value={usadoDominio} />
      <input type="hidden" name="usado_km" value={usadoKm} />
      <input type="hidden" name="valor_toma" value={valorToma} />
      <input type="hidden" name="entrega_efectivo" value={entregaEfectivo} />
      <input type="hidden" name="cliente_nombre" value={clienteNombre} />
      <input type="hidden" name="cliente_dni_cuil" value={clienteDni} />
      <input type="hidden" name="cliente_whatsapp" value={clienteWhatsapp} />
      <input type="hidden" name="cliente_email" value={clienteEmail} />
      <input type="hidden" name="cliente_domicilio" value={clienteDomicilio} />
      <input type="hidden" name="cliente_localidad" value={clienteLocalidad} />
      <input type="hidden" name="situacion_laboral" value={situacionLaboral} />
      <input type="hidden" name="notas_internas" value={notasInternas} />
      <input type="hidden" name="plan_id" value={planId} />
      <input type="hidden" name="plazo_meses" value={plazoMeses ?? ""} />
      <input type="hidden" name="tna_aplicada" value={tnaOverride} />
      <input type="hidden" name="gastos_aplicados_pct" value={gastosOverride} />
    </form>
  );
}
