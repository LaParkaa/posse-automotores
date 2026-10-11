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

export type EstadoVehiculo = "disponible" | "reservado" | "vendido";

/** Vehiculo tal como lo ve el bot: solo columnas publicas de vehiculos_posse. */
export type VehiculoCatalogo = {
  id: string;
  slug: string;
  nombre: string;
  marca: string;
  modelo: string;
  anio: number;
  kilometraje: string;
  combustible: string;
  transmision: string;
  motor: string | null;
  tipo: string | null;
  descripcion: string | null;
  precio_texto: string;
  cover_image_url: string | null;
  estado: EstadoVehiculo;
  created_at: string;
};

export type Boton = { titulo: string; url: string };

export type Tarjeta = {
  titulo: string;
  subtitulo: string;
  imagenUrl: string | null;
  botones: Boton[];
};

/** Lo que el motor le pide al handler que envie. */
export type MensajeSalida =
  | { tipo: "texto"; texto: string }
  // `alternativaTexto` se manda si Instagram rechaza la tarjeta (formato de imagen, etc.).
  | { tipo: "tarjetas"; tarjetas: Tarjeta[]; alternativaTexto: string };

export type Perfil = { nombre?: string; usuario?: string };
