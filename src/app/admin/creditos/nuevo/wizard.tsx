"use client";
import { useMemo, useRef, useState } from "react";
import { calcularFinanciacion } from "@/lib/creditos/calculo";
import { formatMoneda } from "@/lib/creditos/formato";
import { CATEGORIAS_VEHICULO_REF, type CategoriaVehiculoRef, type Moneda, type PlanFinanciacion, type VehiculoRef } from "@/lib/creditos/types";
import type { Vehiculo } from "@/lib/types";
import { Autocomplete } from "@/components/creditos/autocomplete";
import { urlBusquedaMercadoLibre } from "@/lib/creditos/mercadolibre";

const PLAZOS_POR_DEFECTO = [12, 24, 36, 48, 60];

const inputClass =
  "w-full rounded border border-white/15 bg-car-gray2 px-4 py-2.5 text-sm text-car-white outline-none focus:border-car-gold";
const labelClass = "mb-1.5 block text-xs uppercase tracking-wide text-car-muted";
const sectionClass = "rounded-lg border border-white/10 bg-car-gray2/60 p-5";
const sectionTitleClass = "mb-4 font-condensed text-sm font-bold uppercase tracking-wide text-car-gold";

type Props = {
  vehiculosStock: Vehiculo[];
  catalogoRef: VehiculoRef[];
  planes: PlanFinanciacion[];
  action: (formData: FormData) => Promise<{ ok: false; error: string } | void>;
};

export function NuevaOperacionWizard({ vehiculosStock, catalogoRef, planes, action }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // --- Vehículo ---
  const [modoVehiculo, setModoVehiculo] = useState<"stock" | "catalogo">("stock");
  const [vehiculoStockId, setVehiculoStockId] = useState("");
  const [categoria, setCategoria] = useState<CategoriaVehiculoRef | "">("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [vehiculoRefId, setVehiculoRefId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precioPactado, setPrecioPactado] = useState("");
  const [moneda, setMoneda] = useState<Moneda>("ARS");

  // --- Entrega y permuta ---
  const [entregaUsado, setEntregaUsado] = useState(false);
  const [usadoMarca, setUsadoMarca] = useState("");
  const [usadoModelo, setUsadoModelo] = useState("");
  const [usadoAnio, setUsadoAnio] = useState("");
  const [usadoVersion, setUsadoVersion] = useState("");
  const [usadoDominio, setUsadoDominio] = useState("");
  const [usadoKm, setUsadoKm] = useState("");
  const [valorToma, setValorToma] = useState("");
  const [entregaEfectivo, setEntregaEfectivo] = useState("");

  // --- Cliente ---
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteDni, setClienteDni] = useState("");
  const [clienteWhatsapp, setClienteWhatsapp] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [clienteDomicilio, setClienteDomicilio] = useState("");
  const [clienteLocalidad, setClienteLocalidad] = useState("");
  const [situacionLaboral, setSituacionLaboral] = useState("");
  const [notasInternas, setNotasInternas] = useState("");

  // --- Ingeniería financiera ---
  const [planId, setPlanId] = useState("");
  const [plazoMeses, setPlazoMeses] = useState<number | null>(null);
  const [tnaOverride, setTnaOverride] = useState("");
  const [gastosOverride, setGastosOverride] = useState("");

  const marcas = useMemo(
    () => Array.from(new Set(catalogoRef.filter((v) => v.categoria === categoria).map((v) => v.marca))).sort(),
    [catalogoRef, categoria]
  );
  const modelos = useMemo(
    () =>
      Array.from(
        new Set(catalogoRef.filter((v) => v.categoria === categoria && v.marca === marca).map((v) => v.modelo))
      ).sort(),
    [catalogoRef, categoria, marca]
  );
  const versiones = useMemo(
    () => catalogoRef.filter((v) => v.categoria === categoria && v.marca === marca && v.modelo === modelo),
    [catalogoRef, categoria, marca, modelo]
  );

  const planSeleccionado = planes.find((p) => p.id === planId) ?? null;
  const plazosHabilitados = planSeleccionado?.plazos_habilitados ?? PLAZOS_POR_DEFECTO;

  const vehiculoStockSeleccionado = vehiculosStock.find((v) => v.id === vehiculoStockId) ?? null;
  const opcionesStock = useMemo(
    () => vehiculosStock.map((v) => ({ value: v.id, label: `${v.nombre.trim()} (${v.anio}) — ${v.precio_texto}` })),
    [vehiculosStock]
  );
  const opcionesCatalogoRef = useMemo(
    () => catalogoRef.map((v) => ({ value: v.id, label: `${v.marca} ${v.modelo}${v.version ? ` ${v.version}` : ""}` })),
    [catalogoRef]
  );

  function elegirVehiculoStock(id: string) {
    setVehiculoStockId(id);
    const v = vehiculosStock.find((x) => x.id === id);
    if (!v) return;
    setDescripcion(`${v.nombre.trim()} (${v.anio})`);
    // El precio de lista es texto libre ("Consultá precio", "$ 15.400.000"): si trae dígitos,
    // se usa como punto de partida del precio pactado, que el vendedor puede negociar y editar.
    if (!precioPactado) {
      const soloNumeros = v.precio_texto.replace(/\D/g, "");
      if (soloNumeros) setPrecioPactado(soloNumeros);
    }
  }

  function elegirVersion(id: string) {
    setVehiculoRefId(id);
    const v = versiones.find((x) => x.id === id);
    if (v) setDescripcion(`${v.marca} ${v.modelo}${v.version ? ` ${v.version}` : ""}`);
  }

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
      if (!plazoMeses || !p.plazos_habilitados.includes(plazoMeses)) {
        setPlazoMeses(p.plazos_habilitados[0] ?? null);
      }
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
    if (clienteNombre.trim().length < 2) {
      setSubmitError("Escribí el nombre del cliente");
      return;
    }
    if (!plazoMeses) {
      setSubmitError("Elegí un plazo de cuotas");
      return;
    }
    setSubmitError("");
    setSubmitting(true);
    try {
      const resultadoAction = await action(new FormData(formRef.current!));
      if (resultadoAction && resultadoAction.ok === false) {
        setSubmitError(resultadoAction.error);
        setSubmitting(false);
      }
    } catch (error) {
      // Next.js usa excepciones especiales para redirect(); si llega acá es un error real.
      if (error instanceof Error && error.message !== "NEXT_REDIRECT") {
        setSubmitError(error.message);
        setSubmitting(false);
      }
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      {/* Columna izquierda: datos de la operación */}
      <div className="space-y-6">
        <div className={sectionClass}>
          <h2 className={sectionTitleClass}>1. Vehículo</h2>
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => setModoVehiculo("stock")}
              className={`rounded px-4 py-2 text-xs font-bold uppercase tracking-wide ${
                modoVehiculo === "stock" ? "bg-car-gold text-car-black" : "bg-white/5 text-car-muted"
              }`}
            >
              Stock propio
            </button>
            <button
              type="button"
              onClick={() => setModoVehiculo("catalogo")}
              className={`rounded px-4 py-2 text-xs font-bold uppercase tracking-wide ${
                modoVehiculo === "catalogo" ? "bg-car-gold text-car-black" : "bg-white/5 text-car-muted"
              }`}
            >
              Catálogo general
            </button>
          </div>

          {modoVehiculo === "stock" ? (
            <div>
              <label className={labelClass}>Vehículo en stock</label>
              <Autocomplete
                options={opcionesStock}
                value={vehiculoStockId}
                onSelect={elegirVehiculoStock}
                placeholder="Escribí marca o modelo para buscar…"
              />
              {vehiculoStockSeleccionado && (
                <div className="mt-3 flex items-center gap-3 rounded border border-white/10 bg-white/5 p-3">
                  {vehiculoStockSeleccionado.cover_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element -- miniatura chica en un panel admin, no amerita next/image
                    <img
                      src={vehiculoStockSeleccionado.cover_image_url}
                      alt=""
                      className="h-14 w-20 shrink-0 rounded object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-car-white">{vehiculoStockSeleccionado.nombre.trim()}</p>
                    <p className="text-xs text-car-muted">Precio de lista: {vehiculoStockSeleccionado.precio_texto}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClass}>Categoría</label>
                <select
                  value={categoria}
                  onChange={(e) => {
                    setCategoria(e.target.value as CategoriaVehiculoRef);
                    setMarca("");
                    setModelo("");
                    setVehiculoRefId("");
                  }}
                  className={inputClass}
                >
                  <option value="">Elegí…</option>
                  {CATEGORIAS_VEHICULO_REF.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Marca</label>
                <select
                  value={marca}
                  onChange={(e) => {
                    setMarca(e.target.value);
                    setModelo("");
                    setVehiculoRefId("");
                  }}
                  disabled={!categoria}
                  className={inputClass}
                >
                  <option value="">Elegí…</option>
                  {marcas.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Modelo</label>
                <select
                  value={modelo}
                  onChange={(e) => {
                    setModelo(e.target.value);
                    setVehiculoRefId("");
                  }}
                  disabled={!marca}
                  className={inputClass}
                >
                  <option value="">Elegí…</option>
                  {modelos.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className={labelClass}>Versión</label>
                <select value={vehiculoRefId} onChange={(e) => elegirVersion(e.target.value)} disabled={!modelo} className={inputClass}>
                  <option value="">Elegí…</option>
                  {versiones.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.version ?? "(sin versión)"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="mt-4">
            <label className={labelClass}>Descripción del vehículo</label>
            <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={inputClass} placeholder="Marca, modelo y año" />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Precio pactado</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={precioPactado}
                onChange={(e) => setPrecioPactado(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Moneda</label>
              <select value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)} className={inputClass}>
                <option value="ARS">Pesos (ARS)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </div>
          </div>
        </div>

        <div className={sectionClass}>
          <h2 className={sectionTitleClass}>2. Entrega y permuta</h2>
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
          <h2 className={sectionTitleClass}>3. Datos del cliente</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>Nombre completo *</label>
              <input value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>DNI / CUIL</label>
              <input
                value={clienteDni}
                onChange={(e) => setClienteDni(e.target.value)}
                className={inputClass}
                placeholder="20-12345678-9"
              />
              {clienteDni && !/^\d{7,8}$|^\d{2}-?\d{7,8}-?\d$/.test(clienteDni.replace(/\s/g, "")) && (
                <p className="mt-1 text-xs text-amber-400">Revisá el formato del DNI/CUIL</p>
              )}
            </div>
            <div>
              <label className={labelClass}>WhatsApp</label>
              <input value={clienteWhatsapp} onChange={(e) => setClienteWhatsapp(e.target.value)} className={inputClass} placeholder="3537662444" />
              {clienteWhatsapp && clienteWhatsapp.replace(/\D/g, "").length < 8 && (
                <p className="mt-1 text-xs text-amber-400">Revisá el número de teléfono</p>
              )}
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

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-car-gold px-5 py-3 font-condensed font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark disabled:opacity-50 lg:hidden"
        >
          {submitting ? "Guardando…" : "Guardar operación"}
        </button>
      </div>

      {/* Columna derecha: ingeniería financiera, sticky */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className={sectionClass}>
          <h2 className={sectionTitleClass}>4. Ingeniería financiera</h2>

          <div className="mb-4">
            <label className={labelClass}>Línea de crédito</label>
            <select value={planId} onChange={(e) => elegirPlan(e.target.value)} className={inputClass}>
              <option value="">Elegí un plan…</option>
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

          {resultado && (
            <details className="mb-4">
              <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-car-gold">
                Ver tabla de amortización
              </summary>
              <div className="mt-2 max-h-56 overflow-y-auto rounded border border-white/10">
                <table className="w-full text-xs">
                  <thead className="bg-white/5 text-car-muted">
                    <tr>
                      <th className="px-2 py-1 text-left">#</th>
                      <th className="px-2 py-1 text-right">Capital</th>
                      <th className="px-2 py-1 text-right">Interés</th>
                      <th className="px-2 py-1 text-right">Cuota</th>
                      <th className="px-2 py-1 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.tablaAmortizacion.map((c) => (
                      <tr key={c.numero} className="border-t border-white/5 text-car-white/80">
                        <td className="px-2 py-1">{c.numero}</td>
                        <td className="px-2 py-1 text-right">{formatMoneda(c.capital, moneda)}</td>
                        <td className="px-2 py-1 text-right">{formatMoneda(c.interes, moneda)}</td>
                        <td className="px-2 py-1 text-right">{formatMoneda(c.cuota, moneda)}</td>
                        <td className="px-2 py-1 text-right">{formatMoneda(c.saldo, moneda)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="hidden w-full rounded bg-car-gold px-5 py-3 font-condensed font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark disabled:opacity-50 lg:block"
          >
            {submitting ? "Guardando…" : "Guardar operación"}
          </button>
        </div>
      </div>

      {/* Campos ocultos que viajan a la Server Action */}
      <input type="hidden" name="vehiculo_stock_id" value={modoVehiculo === "stock" ? vehiculoStockId : ""} />
      <input type="hidden" name="vehiculo_ref_id" value={modoVehiculo === "catalogo" ? vehiculoRefId : ""} />
      <input type="hidden" name="vehiculo_descripcion" value={descripcion} />
      <input type="hidden" name="precio_pactado" value={precioPactado} />
      <input type="hidden" name="moneda" value={moneda} />
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
