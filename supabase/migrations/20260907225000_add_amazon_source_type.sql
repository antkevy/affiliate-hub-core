-- Amazon como fonte de captura (Creators API)
-- Estende o enum de tipos de fonte com "amazon".
ALTER TYPE public.source_type ADD VALUE IF NOT EXISTS 'amazon';