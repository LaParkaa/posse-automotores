export type TurnoHistorial = {
  role: "user" | "assistant";
  content: string;
};

export type LeadInput = {
  nombre: string;
  telefono: string;
  vehiculo_interes?: string;
  mensaje?: string;
};

export type RespuestaIA = {
  texto: string;
  lead: LeadInput | null;
};
