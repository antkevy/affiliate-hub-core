-- ============================================================
-- affiliate-hub-core — expansão de marketplaces
-- Adiciona os marketplaces populares do programa brasileiro de
-- afiliados (Magalu, KaBuM e aliados) ao catálogo.
-- ============================================================

INSERT INTO public.marketplaces (name, slug, is_active)
VALUES
  ('Magalu', 'magalu', true),
  ('KaBuM!', 'kabum', true),
  ('Terabyte', 'terabyte', true),
  ('Rakuten', 'rakuten', true),
  ('Awin', 'awin', true),
  ('AliExpress', 'aliexpress', true)
ON CONFLICT (slug) DO NOTHING;