-- ============================================================
-- affiliate-hub-core — schema completo (partes 1..3) + storage
-- Gerado a partir de supabase/migrations/*.sql (ordem de criação)
-- Rode UMA VEZ no SQL Editor de um projeto Supabase NOVO.
-- Tabelas sem ON CONFLICT/IF EXISTS: rode em banco vazio.
-- ============================================================

-- ---------- storage buckets (policies abaixo exigem estes nomes) ----------
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true),
       ('offer-media', 'offer-media', true),
       ('banners', 'banners', true),
       ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- ============ PART 1 ============
-- ---------- helpers ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ---------- enums ----------
CREATE TYPE public.offer_status AS ENUM ('captured','processing','processed','approved','rejected','published','error');
CREATE TYPE public.entity_status AS ENUM ('active','paused','error');
CREATE TYPE public.source_type AS ENUM ('telegram','whatsapp','api','feed','manual','amazon','shopee');
CREATE TYPE public.destination_type AS ENUM ('telegram','whatsapp','other');
CREATE TYPE public.publication_status AS ENUM ('pending','processing','published','failed','cancelled');
CREATE TYPE public.job_status AS ENUM ('pending','processing','completed','failed','cancelled');
CREATE TYPE public.media_type AS ENUM ('image','video','thumbnail');
CREATE TYPE public.link_status AS ENUM ('pending','generated','error');
CREATE TYPE public.account_status AS ENUM ('disconnected','connected','error');

-- ---------- profiles ----------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- marketplaces (public catalog) ----------
CREATE TABLE public.marketplaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplaces TO anon, authenticated;
GRANT ALL ON public.marketplaces TO service_role;
ALTER TABLE public.marketplaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketplaces_read" ON public.marketplaces FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER trg_marketplaces_updated BEFORE UPDATE ON public.marketplaces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.marketplaces (name, slug) VALUES
  ('Mercado Livre','mercado-livre'),('Shopee','shopee'),('Amazon','amazon'),('AliExpress','aliexpress'),
  ('Magalu','magalu'),('KaBuM!','kabum'),('Terabyte','terabyte'),('Rakuten','rakuten'),('Awin','awin');

-- ---------- affiliate_accounts ----------
CREATE TABLE public.affiliate_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  marketplace_id UUID NOT NULL REFERENCES public.marketplaces(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  status public.account_status NOT NULL DEFAULT 'disconnected',
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_accounts TO authenticated;
GRANT ALL ON public.affiliate_accounts TO service_role;
ALTER TABLE public.affiliate_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "affiliate_accounts_own" ON public.affiliate_accounts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_aa_updated BEFORE UPDATE ON public.affiliate_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_aa_user ON public.affiliate_accounts(user_id);
CREATE INDEX idx_aa_marketplace ON public.affiliate_accounts(marketplace_id);
CREATE UNIQUE INDEX uq_aa_user_marketplace_name ON public.affiliate_accounts(user_id, marketplace_id, name);

-- ---------- affiliate_credentials (server-only) ----------
CREATE TABLE public.affiliate_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  affiliate_account_id UUID NOT NULL REFERENCES public.affiliate_accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  credential_type TEXT NOT NULL DEFAULT 'api_key',
  secret_ref TEXT,
  encrypted_payload TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.affiliate_credentials TO service_role;
ALTER TABLE public.affiliate_credentials ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_ac_updated BEFORE UPDATE ON public.affiliate_credentials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_ac_account ON public.affiliate_credentials(affiliate_account_id);

-- ---------- products ----------
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  marketplace_id UUID REFERENCES public.marketplaces(id) ON DELETE SET NULL,
  external_id TEXT,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
  description TEXT,
  image_url TEXT,
  product_url TEXT,
  category TEXT,
  brand TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_own" ON public.products FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_products_user ON public.products(user_id);
CREATE INDEX idx_products_marketplace_external ON public.products(marketplace_id, external_id);
CREATE UNIQUE INDEX uq_products_user_mp_external ON public.products(user_id, marketplace_id, external_id) WHERE external_id IS NOT NULL;

-- ---------- sources ----------
CREATE TABLE public.sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  type public.source_type NOT NULL DEFAULT 'manual',
  identifier TEXT,
  status public.entity_status NOT NULL DEFAULT 'paused',
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sources TO authenticated;
GRANT ALL ON public.sources TO service_role;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sources_own" ON public.sources FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_sources_updated BEFORE UPDATE ON public.sources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_sources_user ON public.sources(user_id);
CREATE INDEX idx_sources_status ON public.sources(user_id, status);

-- ---------- destinations ----------
CREATE TABLE public.destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  type public.destination_type NOT NULL DEFAULT 'other',
  identifier TEXT,
  status public.entity_status NOT NULL DEFAULT 'paused',
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.destinations TO authenticated;
GRANT ALL ON public.destinations TO service_role;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "destinations_own" ON public.destinations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_dest_updated BEFORE UPDATE ON public.destinations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_dest_user ON public.destinations(user_id);
CREATE INDEX idx_dest_status ON public.destinations(user_id, status);

-- ---------- templates ----------
CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  content TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'text',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.templates TO authenticated;
GRANT ALL ON public.templates TO service_role;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates_own" ON public.templates FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_templates_updated BEFORE UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_templates_user ON public.templates(user_id);
CREATE UNIQUE INDEX uq_templates_default ON public.templates(user_id) WHERE is_default;

-- ---------- banners ----------
CREATE TABLE public.banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  preview_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banners TO authenticated;
GRANT ALL ON public.banners TO service_role;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banners_own" ON public.banners FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_banners_updated BEFORE UPDATE ON public.banners FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_banners_user ON public.banners(user_id);

-- ---------- monitors ----------
CREATE TABLE public.monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  source_id UUID REFERENCES public.sources(id) ON DELETE SET NULL,
  status public.entity_status NOT NULL DEFAULT 'paused',
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitors TO authenticated;
GRANT ALL ON public.monitors TO service_role;
ALTER TABLE public.monitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "monitors_own" ON public.monitors FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_monitors_updated BEFORE UPDATE ON public.monitors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_monitors_user ON public.monitors(user_id);
CREATE INDEX idx_monitors_source ON public.monitors(source_id);

-- ---------- automations ----------
CREATE TABLE public.automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description TEXT,
  status public.entity_status NOT NULL DEFAULT 'paused',
  source_id UUID REFERENCES public.sources(id) ON DELETE SET NULL,
  destination_id UUID REFERENCES public.destinations(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.templates(id) ON DELETE SET NULL,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automations TO authenticated;
GRANT ALL ON public.automations TO service_role;
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automations_own" ON public.automations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_automations_updated BEFORE UPDATE ON public.automations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_automations_user ON public.automations(user_id);
CREATE INDEX idx_automations_status ON public.automations(user_id, status);

-- ---------- automation_rules ----------
CREATE TABLE public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  operator TEXT NOT NULL DEFAULT 'eq',
  value TEXT,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_rules TO authenticated;
GRANT ALL ON public.automation_rules TO service_role;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automation_rules_own" ON public.automation_rules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.automations a WHERE a.id = automation_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.automations a WHERE a.id = automation_id AND a.user_id = auth.uid()));
CREATE TRIGGER trg_ar_updated BEFORE UPDATE ON public.automation_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_ar_automation ON public.automation_rules(automation_id);

-- ---------- offers ----------
CREATE TABLE public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  source_id UUID REFERENCES public.sources(id) ON DELETE SET NULL,
  marketplace_id UUID REFERENCES public.marketplaces(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
  original_price NUMERIC(12,2) CHECK (original_price IS NULL OR original_price >= 0),
  sale_price NUMERIC(12,2) CHECK (sale_price IS NULL OR sale_price >= 0),
  discount_percentage NUMERIC(5,2) CHECK (discount_percentage IS NULL OR (discount_percentage >= 0 AND discount_percentage <= 100)),
  coupon TEXT,
  currency TEXT NOT NULL DEFAULT 'BRL' CHECK (char_length(currency) = 3),
  original_url TEXT,
  affiliate_url TEXT,
  status public.offer_status NOT NULL DEFAULT 'captured',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offers_own" ON public.offers FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_offers_updated BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_offers_user_created ON public.offers(user_id, created_at DESC);
CREATE INDEX idx_offers_status ON public.offers(user_id, status);
CREATE INDEX idx_offers_marketplace ON public.offers(marketplace_id);
CREATE INDEX idx_offers_source ON public.offers(source_id);

-- ---------- offer_media ----------
CREATE TABLE public.offer_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  type public.media_type NOT NULL DEFAULT 'image',
  url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_media TO authenticated;
GRANT ALL ON public.offer_media TO service_role;
ALTER TABLE public.offer_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "offer_media_own" ON public.offer_media FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id AND o.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.offers o WHERE o.id = offer_id AND o.user_id = auth.uid()));
CREATE INDEX idx_offer_media_offer ON public.offer_media(offer_id, position);

-- ---------- affiliate_links ----------
CREATE TABLE public.affiliate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  marketplace_id UUID REFERENCES public.marketplaces(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  original_url TEXT NOT NULL,
  affiliate_url TEXT,
  status public.link_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliate_links TO authenticated;
GRANT ALL ON public.affiliate_links TO service_role;
ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "affiliate_links_own" ON public.affiliate_links FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_al_updated BEFORE UPDATE ON public.affiliate_links FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE UNIQUE INDEX uq_al_user_url ON public.affiliate_links(user_id, original_url);
CREATE INDEX idx_al_user_created ON public.affiliate_links(user_id, created_at DESC);

-- ---------- publications ----------
CREATE TABLE public.publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  offer_id UUID REFERENCES public.offers(id) ON DELETE SET NULL,
  destination_id UUID REFERENCES public.destinations(id) ON DELETE SET NULL,
  automation_id UUID REFERENCES public.automations(id) ON DELETE SET NULL,
  content TEXT,
  status public.publication_status NOT NULL DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publications TO authenticated;
GRANT ALL ON public.publications TO service_role;
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "publications_own" ON public.publications FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_pub_updated BEFORE UPDATE ON public.publications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_pub_user_created ON public.publications(user_id, created_at DESC);
CREATE INDEX idx_pub_status ON public.publications(user_id, status);
CREATE INDEX idx_pub_destination ON public.publications(destination_id);

-- ---------- processed_messages ----------
CREATE TABLE public.processed_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source_id UUID REFERENCES public.sources(id) ON DELETE CASCADE,
  external_message_id TEXT,
  content_hash TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.processed_messages TO authenticated;
GRANT ALL ON public.processed_messages TO service_role;
ALTER TABLE public.processed_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "processed_messages_own" ON public.processed_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE UNIQUE INDEX uq_pm_source_external ON public.processed_messages(source_id, external_message_id) WHERE external_message_id IS NOT NULL;
CREATE UNIQUE INDEX uq_pm_source_hash ON public.processed_messages(source_id, content_hash);

-- ---------- jobs ----------
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  status public.job_status NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs_own" ON public.jobs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_jobs_updated BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_jobs_queue ON public.jobs(status, available_at);
CREATE INDEX idx_jobs_user ON public.jobs(user_id, created_at DESC);

-- ---------- audit_logs ----------
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_select_own" ON public.audit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "audit_logs_insert_own" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_audit_user_created ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_entity ON public.audit_logs(entity_type, entity_id);

-- ============ PART 2 ============
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ============ PART 3 (storage policies) ============
CREATE POLICY "storage_own_folder_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('avatars','offer-media','banners','logos') AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "storage_own_folder_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('avatars','offer-media','banners','logos') AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "storage_own_folder_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('avatars','offer-media','banners','logos') AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id IN ('avatars','offer-media','banners','logos') AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "storage_own_folder_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('avatars','offer-media','banners','logos') AND (storage.foldername(name))[1] = auth.uid()::text);

-- Platform Sessions for headless browser session & cookie management
CREATE TABLE IF NOT EXISTS public.platform_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT UNIQUE NOT NULL,
  cookies TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service_role full access to platform_sessions"
  ON public.platform_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
-- ---------- clear_all_user_offers ----------
CREATE OR REPLACE FUNCTION public.clear_all_user_offers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.offer_media om
  WHERE EXISTS (
    SELECT 1 FROM public.offers o
    WHERE o.id = om.offer_id AND o.user_id = auth.uid()
  );

  DELETE FROM public.publications p
  WHERE p.offer_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.offers o
      WHERE o.id = p.offer_id AND o.user_id = auth.uid()
    );

  DELETE FROM public.offers o
  WHERE o.user_id = auth.uid();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_all_user_offers() TO authenticated;
