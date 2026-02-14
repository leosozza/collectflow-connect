ALTER TABLE clients ADD COLUMN tipo_devedor_id uuid REFERENCES tipos_devedor(id) ON DELETE SET NULL;
ALTER TABLE clients ADD COLUMN tipo_divida_id uuid REFERENCES tipos_divida(id) ON DELETE SET NULL;