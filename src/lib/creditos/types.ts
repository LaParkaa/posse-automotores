export const CATEGORIAS_VEHICULO_REF = [
  "Autos 2012-2026",
  "Autos 2005-2011",
  "Utilitarios",
  "Motos",
  "Camiones",
  "Maquinaria",
] as const;
export type CategoriaVehiculoRef = (typeof CATEGORIAS_VEHICULO_REF)[number];

export type VehiculoRef = {
  id: string;
  categoria: CategoriaVehiculoRef;
  marca: string;
  modelo: string;
  version: string | null;
  activo: boolean;
  created_at: string;
};

export type PlanFinanciacion = {
  id: string;
  nombre: string;
  tna_pct: number;
  gastos_otorgamiento_pct: number;
  max_financiable_pct: number;
  antiguedad_max_anios: number | null;
  plazos_habilitados: number[];
  activo: boolean;
  created_at: string;
};

export type PlanFinanciacionPublico = {
  id: string;
  nombre: string;
  plazos_habilitados: number[];
  tna_final_pct: number;
};

export const ESTADOS_OPERACION = [
  "Simulado",
  "Simulado (Web)",
  "En Evaluación",
  "Aprobado",
  "Liquidado / Entregado",
  "Rechazado",
] as const;
export type EstadoOperacion = (typeof ESTADOS_OPERACION)[number];

export type Moneda = "ARS" | "USD";

export type OperacionCredito = {
  id: string;
  vehiculo_stock_id: string | null;
  vehiculo_ref_id: string | null;
  vehiculo_descripcion: string | null;
  precio_pactado: number;
  moneda: Moneda;

  entrega_usado: boolean;
  usado_marca: string | null;
  usado_modelo: string | null;
  usado_anio: number | null;
  usado_version: string | null;
  usado_dominio: string | null;
  usado_km: string | null;
  valor_toma: number | null;

  cliente_nombre: string;
  cliente_dni_cuil: string | null;
  cliente_whatsapp: string | null;
  cliente_email: string | null;
  cliente_domicilio: string | null;
  cliente_localidad: string | null;
  situacion_laboral: string | null;
  notas_internas: string | null;

  entrega_efectivo: number;
  capital_a_financiar: number;
  plan_id: string | null;
  plazo_meses: number | null;
  tna_aplicada: number | null;
  gastos_aplicados_pct: number | null;
  valor_cuota_pura: number | null;
  valor_cuota_final: number | null;
  estado: EstadoOperacion;

  created_at: string;
  updated_at: string;
};

export const TIPOS_DOCUMENTO = [
  "Presupuesto",
  "Recibo de Seña",
  "Recibo de Entrega",
  "Recibo de Cuota",
  "Boleto de Compraventa",
] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const MEDIOS_PAGO = ["Efectivo ARS", "Efectivo USD", "Transferencia", "Cheque", "Usado"] as const;
export type MedioPago = (typeof MEDIOS_PAGO)[number];

export type ReciboDocumento = {
  id: string;
  operacion_id: string;
  numero_comprobante: string;
  tipo_documento: TipoDocumento;
  monto: number | null;
  medio_pago: MedioPago | null;
  fecha: string;
  created_at: string;
};
