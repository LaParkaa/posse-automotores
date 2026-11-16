/**
 * Cálculo de cuotas: todo en números puros, sin React, para poder testearlo
 * directo. Las cifras siempre se redondean a centavos antes de operar más
 * sobre ellas, para no acumular error de punto flotante entre cuota y cuota.
 */

export type CuotaAmortizacion = {
  numero: number;
  interes: number;
  capital: number;
  cuota: number;
  saldo: number;
};

export type ParametrosFinanciacion = {
  capitalAFinanciar: number;
  tnaPct: number;
  gastosOtorgamientoPct: number;
  plazoMeses: number;
};

export type ResultadoFinanciacion = ParametrosFinanciacion & {
  capitalConGastos: number;
  cuotaPura: number;
  cuotaFinal: number;
  tablaAmortizacion: CuotaAmortizacion[];
};

/** Redondea a centavos para que las cuentas de dinero no arrastren error de punto flotante. */
export function redondear(monto: number): number {
  return Math.round((monto + Number.EPSILON) * 100) / 100;
}

function tasaMensual(tnaPct: number): number {
  return tnaPct / 100 / 12;
}

/** Cuota fija del sistema francés sobre un capital, a una TNA y un plazo en meses. */
export function cuotaSistemaFrances(capital: number, tnaPct: number, plazoMeses: number): number {
  if (plazoMeses <= 0) return 0;
  const i = tasaMensual(tnaPct);
  if (i === 0) return redondear(capital / plazoMeses);
  const cuota = (capital * i) / (1 - Math.pow(1 + i, -plazoMeses));
  return redondear(cuota);
}

/** Cuota fija de tasa directa: interés simple sobre el capital original, prorrateado en el plazo. */
export function cuotaTasaDirecta(capital: number, tnaPct: number, plazoMeses: number): number {
  if (plazoMeses <= 0) return 0;
  const interesTotal = redondear(capital * (tnaPct / 100) * (plazoMeses / 12));
  return redondear((capital + interesTotal) / plazoMeses);
}

/**
 * Tabla de amortización del sistema francés, cuota por cuota (capital, interés, saldo).
 * La última cuota se ajusta contra el saldo real para que cierre en 0 exacto, en vez de
 * dejar centavos sueltos por redondeos intermedios.
 */
export function tablaAmortizacion(capital: number, tnaPct: number, plazoMeses: number): CuotaAmortizacion[] {
  const i = tasaMensual(tnaPct);
  const cuotaFija = cuotaSistemaFrances(capital, tnaPct, plazoMeses);
  let saldo = redondear(capital);
  const tabla: CuotaAmortizacion[] = [];

  for (let numero = 1; numero <= plazoMeses; numero++) {
    const interes = redondear(saldo * i);
    const esUltima = numero === plazoMeses;
    const capitalCuota = esUltima ? saldo : redondear(cuotaFija - interes);
    const cuota = esUltima ? redondear(capitalCuota + interes) : cuotaFija;
    saldo = redondear(Math.max(saldo - capitalCuota, 0));
    tabla.push({ numero, interes, capital: capitalCuota, cuota, saldo });
  }

  return tabla;
}

/**
 * Cálculo completo para una operación: cuota "pura" (sobre el capital neto, sin gastos,
 * solo a modo informativo) y cuota "final" (sobre el capital con los gastos de otorgamiento
 * ya incluidos, que es la que efectivamente se cobra).
 */
export function calcularFinanciacion(p: ParametrosFinanciacion): ResultadoFinanciacion {
  const capitalConGastos = redondear(p.capitalAFinanciar * (1 + p.gastosOtorgamientoPct / 100));
  const cuotaPura = cuotaSistemaFrances(p.capitalAFinanciar, p.tnaPct, p.plazoMeses);
  const tablaAmortizacion_ = tablaAmortizacion(capitalConGastos, p.tnaPct, p.plazoMeses);
  const cuotaFinal = tablaAmortizacion_[0]?.cuota ?? 0;

  return {
    ...p,
    capitalConGastos,
    cuotaPura,
    cuotaFinal,
    tablaAmortizacion: tablaAmortizacion_,
  };
}
