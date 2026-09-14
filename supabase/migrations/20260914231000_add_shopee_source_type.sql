-- Shopee como fonte de captura (Open API de Afiliados)
-- Estende o enum de tipos de fonte com "shopee".
ALTER TYPE public.source_type ADD VALUE IF NOT EXISTS 'shopee';