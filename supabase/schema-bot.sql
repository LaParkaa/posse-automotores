-- Bot tables for Posse Automotores WhatsApp Bot

-- Leads capturados por el bot
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT,
  telefono TEXT,
  whatsapp TEXT NOT NULL,
  vehiculo_interes TEXT,
  mensaje TEXT,
  estado TEXT DEFAULT 'nuevo' CHECK (estado IN ('nuevo', 'contactado', 'cerrado')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Estadísticas de conversaciones
CREATE TABLE IF NOT EXISTS conversaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp TEXT UNIQUE NOT NULL,
  total_mensajes INTEGER DEFAULT 0,
  primer_contacto TIMESTAMPTZ DEFAULT now(),
  ultimo_contacto TIMESTAMPTZ DEFAULT now()
);

-- Logs del bot para depuración y estadísticas
CREATE TABLE IF NOT EXISTS logs_bot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp TEXT,
  tipo TEXT CHECK (tipo IN ('mensaje', 'lead', 'consulta_vehiculo', 'error', 'transfer_humano')),
  contenido TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_bot ENABLE ROW LEVEL SECURITY;

-- Solo usuarios autenticados pueden leer/escribir
CREATE POLICY "Authenticated full access on leads" ON leads FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated full access on conversaciones" ON conversaciones FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated full access on logs_bot" ON logs_bot FOR ALL USING (auth.role() = 'authenticated');
