export type EstadoVehiculo = "disponible" | "reservado" | "vendido";

export type Vehiculo = {
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
  imagenes: string[];
  videos: string[];
  estado: EstadoVehiculo;
  badge: string | null;
  created_at: string;
  deleted_at: string | null;
  sold_at: string | null;
  sale_price: number | null;
  sale_notes: string | null;
};
