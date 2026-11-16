import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { HojaImprimible, Membrete } from "@/components/creditos/hoja-imprimible";
import { getOperacionCreditoById, getRecibosDeOperacion } from "@/lib/creditos/data";
import { SLUG_A_TIPO_DOCUMENTO } from "@/lib/creditos/documentos";
import { formatMoneda, montoEnLetras } from "@/lib/creditos/formato";
import type { ReciboDocumento } from "@/lib/creditos/types";

export const dynamic = "force-dynamic";

function FilaDato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between border-b border-neutral-200 py-1.5 text-sm">
      <span className="text-neutral-500">{etiqueta}</span>
      <span className="font-semibold">{valor}</span>
    </div>
  );
}

export default async function ImprimirDocumentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; tipo: string }>;
  searchParams: Promise<{ recibo?: string }>;
}) {
  await requireAdminSession();
  const { id, tipo } = await params;
  const { recibo: reciboId } = await searchParams;

  const operacion = await getOperacionCreditoById(id);
  if (!operacion) notFound();

  if (tipo === "legajo") {
    return <LegajoDocumento operacion={operacion} />;
  }

  const tipoDocumento = SLUG_A_TIPO_DOCUMENTO[tipo];
  if (!tipoDocumento) notFound();

  const recibos = await getRecibosDeOperacion(id);
  const recibo = reciboId ? recibos.find((r) => r.id === reciboId) : recibos.find((r) => r.tipo_documento === tipoDocumento);
  if (!recibo) notFound();

  if (tipoDocumento === "Presupuesto") {
    return <PresupuestoDocumento operacion={operacion} recibo={recibo} />;
  }
  return <ReciboDocumentoView operacion={operacion} recibo={recibo} />;
}

function PresupuestoDocumento({ operacion: op, recibo }: { operacion: NonNullable<Awaited<ReturnType<typeof getOperacionCreditoById>>>; recibo: ReciboDocumento }) {
  return (
    <HojaImprimible>
      <Membrete validezOferta="7 días desde la fecha de emisión" />
      <h1 className="mb-6 text-center font-condensed text-2xl font-black uppercase italic">Presupuesto / Cotización</h1>
      <p className="mb-4 text-xs text-neutral-500">Comprobante Nº {recibo.numero_comprobante}</p>

      <section className="mb-6">
        <h2 className="mb-2 font-condensed text-sm font-bold uppercase tracking-wide text-neutral-600">Vehículo</h2>
        <FilaDato etiqueta="Unidad" valor={op.vehiculo_descripcion ?? "A confirmar"} />
        <FilaDato etiqueta="Precio pactado" valor={formatMoneda(op.precio_pactado, op.moneda)} />
      </section>

      {op.entrega_usado && (
        <section className="mb-6">
          <h2 className="mb-2 font-condensed text-sm font-bold uppercase tracking-wide text-neutral-600">Toma de usado</h2>
          <FilaDato etiqueta="Unidad entregada" valor={`${op.usado_marca ?? ""} ${op.usado_modelo ?? ""} ${op.usado_anio ?? ""}`.trim()} />
          <FilaDato etiqueta="Dominio" valor={op.usado_dominio ?? "—"} />
          <FilaDato etiqueta="Valor de toma" valor={formatMoneda(op.valor_toma ?? 0, op.moneda)} />
        </section>
      )}

      <section className="mb-6">
        <h2 className="mb-2 font-condensed text-sm font-bold uppercase tracking-wide text-neutral-600">Plan de pago</h2>
        <FilaDato etiqueta="Entrega en efectivo" valor={formatMoneda(op.entrega_efectivo, op.moneda)} />
        <FilaDato etiqueta="Capital a financiar" valor={formatMoneda(op.capital_a_financiar, op.moneda)} />
        <FilaDato etiqueta="Plazo" valor={op.plazo_meses ? `${op.plazo_meses} cuotas` : "—"} />
        <FilaDato etiqueta="TNA aplicada" valor={op.tna_aplicada ? `${op.tna_aplicada}%` : "—"} />
        <FilaDato etiqueta="Valor de cuota estimada" valor={op.valor_cuota_final ? formatMoneda(op.valor_cuota_final, op.moneda) : "—"} />
      </section>

      <section className="mb-10">
        <h2 className="mb-2 font-condensed text-sm font-bold uppercase tracking-wide text-neutral-600">Cliente</h2>
        <FilaDato etiqueta="Nombre" valor={op.cliente_nombre} />
        <FilaDato etiqueta="DNI / CUIL" valor={op.cliente_dni_cuil ?? "—"} />
      </section>

      <p className="text-xs text-neutral-500">
        Este presupuesto es informativo y está sujeto a aprobación crediticia definitiva. Los valores pueden
        actualizarse según variación de tasas o del tipo de cambio.
      </p>
    </HojaImprimible>
  );
}

function ReciboDocumentoView({ operacion: op, recibo }: { operacion: NonNullable<Awaited<ReturnType<typeof getOperacionCreditoById>>>; recibo: ReciboDocumento }) {
  const cuerpo = (etiqueta: string) => (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-condensed text-lg font-black italic uppercase">{etiqueta}</p>
        <p className="font-mono text-sm">Nº {recibo.numero_comprobante}</p>
      </div>
      <FilaDato etiqueta="Fecha" valor={new Date(recibo.fecha).toLocaleDateString("es-AR")} />
      <FilaDato etiqueta="Recibí de" valor={op.cliente_nombre} />
      <FilaDato etiqueta="DNI / CUIL" valor={op.cliente_dni_cuil ?? "—"} />
      <FilaDato etiqueta="Concepto" valor={`${recibo.tipo_documento} — ${op.vehiculo_descripcion ?? ""}`} />
      <FilaDato etiqueta="Medio de pago" valor={recibo.medio_pago ?? "—"} />
      <div className="mt-4 rounded border border-neutral-300 bg-neutral-50 p-4">
        <p className="text-xs uppercase text-neutral-500">La suma de</p>
        <p className="text-xl font-black">{recibo.monto != null ? formatMoneda(recibo.monto, op.moneda) : "—"}</p>
        <p className="mt-1 text-sm italic text-neutral-600">
          ({recibo.monto != null ? montoEnLetras(recibo.monto, op.moneda) : "—"})
        </p>
      </div>
      <div className="mt-10 flex justify-between text-sm">
        <div className="w-40 border-t border-black pt-1 text-center">Firma</div>
        <div className="w-40 border-t border-black pt-1 text-center">Aclaración</div>
      </div>
    </div>
  );

  return (
    <HojaImprimible>
      <Membrete />
      <div className="grid gap-8 sm:grid-cols-2 sm:divide-x sm:divide-dashed sm:divide-neutral-300">
        <div className="sm:pr-6">{cuerpo("Original — Cliente")}</div>
        <div className="sm:pl-6">{cuerpo("Duplicado — Agencia")}</div>
      </div>
    </HojaImprimible>
  );
}

function LegajoDocumento({ operacion: op }: { operacion: NonNullable<Awaited<ReturnType<typeof getOperacionCreditoById>>> }) {
  return (
    <HojaImprimible>
      <Membrete />
      <h1 className="mb-6 text-center font-condensed text-2xl font-black uppercase italic">
        Solicitud de Crédito — Resumen de Legajo
      </h1>

      <section className="mb-6">
        <h2 className="mb-2 font-condensed text-sm font-bold uppercase tracking-wide text-neutral-600">Datos del solicitante</h2>
        <FilaDato etiqueta="Nombre completo" valor={op.cliente_nombre} />
        <FilaDato etiqueta="DNI / CUIL" valor={op.cliente_dni_cuil ?? "—"} />
        <FilaDato etiqueta="WhatsApp" valor={op.cliente_whatsapp ?? "—"} />
        <FilaDato etiqueta="Email" valor={op.cliente_email ?? "—"} />
        <FilaDato etiqueta="Domicilio" valor={op.cliente_domicilio ?? "—"} />
        <FilaDato etiqueta="Localidad" valor={op.cliente_localidad ?? "—"} />
        <FilaDato etiqueta="Situación laboral / ingresos" valor={op.situacion_laboral ?? "—"} />
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-condensed text-sm font-bold uppercase tracking-wide text-neutral-600">Operación solicitada</h2>
        <FilaDato etiqueta="Vehículo" valor={op.vehiculo_descripcion ?? "—"} />
        <FilaDato etiqueta="Precio pactado" valor={formatMoneda(op.precio_pactado, op.moneda)} />
        <FilaDato etiqueta="Entrega en efectivo" valor={formatMoneda(op.entrega_efectivo, op.moneda)} />
        {op.entrega_usado && (
          <FilaDato
            etiqueta="Toma de usado"
            valor={`${op.usado_marca ?? ""} ${op.usado_modelo ?? ""} ${op.usado_anio ?? ""} — ${formatMoneda(op.valor_toma ?? 0, op.moneda)}`}
          />
        )}
        <FilaDato etiqueta="Capital a financiar" valor={formatMoneda(op.capital_a_financiar, op.moneda)} />
        <FilaDato etiqueta="Plazo" valor={op.plazo_meses ? `${op.plazo_meses} cuotas` : "—"} />
        <FilaDato etiqueta="Cuota estimada" valor={op.valor_cuota_final ? formatMoneda(op.valor_cuota_final, op.moneda) : "—"} />
      </section>

      <p className="mb-10 text-xs text-neutral-500">
        Declaro que los datos consignados en esta solicitud son correctos y autorizo a Posse Automotores a
        verificarlos ante las entidades crediticias correspondientes.
      </p>

      <div className="mt-16 flex justify-between text-sm">
        <div className="w-48 border-t border-black pt-1 text-center">Firma del solicitante</div>
        <div className="w-48 border-t border-black pt-1 text-center">Aclaración</div>
      </div>
    </HojaImprimible>
  );
}
