ALTER TABLE credores ADD COLUMN IF NOT EXISTS signature_enabled boolean DEFAULT false;
ALTER TABLE credores ADD COLUMN IF NOT EXISTS signature_type text DEFAULT 'click';