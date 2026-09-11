-- ============================================================
-- affiliate-hub-core — segurança e integridade do banco
-- Corrige: FKs de user_id, isolamento de platform_sessions,
--          índices faltantes, CHECK constraints e colunas de auditoria.
-- ============================================================

-- ---------- 1. Foreign keys de user_id -> auth.users ----------
-- profiles (usuários sempre têm perfil associado)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- affiliate_accounts
ALTER TABLE public.affiliate_accounts
  DROP CONSTRAINT IF EXISTS affiliate_accounts_user_id_fkey;
ALTER TABLE public.affiliate_accounts
  ADD CONSTRAINT affiliate_accounts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- affiliate_credentials
ALTER TABLE public.affiliate_credentials
  DROP CONSTRAINT IF EXISTS affiliate_credentials_user_id_fkey;
ALTER TABLE public.affiliate_credentials
  ADD CONSTRAINT affiliate_credentials_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- products
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_user_id_fkey;
ALTER TABLE public.products
  ADD CONSTRAINT products_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- sources
ALTER TABLE public.sources
  DROP CONSTRAINT IF EXISTS sources_user_id_fkey;
ALTER TABLE public.sources
  ADD CONSTRAINT sources_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- destinations
ALTER TABLE public.destinations
  DROP CONSTRAINT IF EXISTS destinations_user_id_fkey;
ALTER TABLE public.destinations
  ADD CONSTRAINT destinations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- templates
ALTER TABLE public.templates
  DROP CONSTRAINT IF EXISTS templates_user_id_fkey;
ALTER TABLE public.templates
  ADD CONSTRAINT templates_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- banners
ALTER TABLE public.banners
  DROP CONSTRAINT IF EXISTS banners_user_id_fkey;
ALTER TABLE public.banners
  ADD CONSTRAINT banners_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- monitors
ALTER TABLE public.monitors
  DROP CONSTRAINT IF EXISTS monitors_user_id_fkey;
ALTER TABLE public.monitors
  ADD CONSTRAINT monitors_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- automations
ALTER TABLE public.automations
  DROP CONSTRAINT IF EXISTS automations_user_id_fkey;
ALTER TABLE public.automations
  ADD CONSTRAINT automations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- offers
ALTER TABLE public.offers
  DROP CONSTRAINT IF EXISTS offers_user_id_fkey;
ALTER TABLE public.offers
  ADD CONSTRAINT offers_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- affiliate_links
ALTER TABLE public.affiliate_links
  DROP CONSTRAINT IF EXISTS affiliate_links_user_id_fkey;
ALTER TABLE public.affiliate_links
  ADD CONSTRAINT affiliate_links_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- publications
ALTER TABLE public.publications
  DROP CONSTRAINT IF EXISTS publications_user_id_fkey;
ALTER TABLE public.publications
  ADD CONSTRAINT publications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- processed_messages
ALTER TABLE public.processed_messages
  DROP CONSTRAINT IF EXISTS processed_messages_user_id_fkey;
ALTER TABLE public.processed_messages
  ADD CONSTRAINT processed_messages_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- jobs
ALTER TABLE public.jobs
  DROP CONSTRAINT IF EXISTS jobs_user_id_fkey;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- audit_logs
ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ---------- 2. Índices faltantes ----------
CREATE INDEX IF NOT EXISTS idx_pm_user ON public.processed_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_ac_user ON public.affiliate_credentials(user_id);

-- ---------- 3. platform_sessions — isolamento por usuário ----------
ALTER TABLE public.platform_sessions
  DROP CONSTRAINT IF EXISTS platform_sessions_user_id_fkey;
ALTER TABLE public.platform_sessions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.platform_sessions
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.platform_sessions
  DROP CONSTRAINT IF EXISTS platform_sessions_platform_unique;
ALTER TABLE public.platform_sessions
  ADD CONSTRAINT platform_sessions_platform_unique UNIQUE (platform, user_id);

CREATE INDEX IF NOT EXISTS idx_platform_sessions_user ON public.platform_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_sessions_updated ON public.platform_sessions(updated_at DESC);

DROP TRIGGER IF EXISTS trg_platform_sessions_updated ON public.platform_sessions;
CREATE TRIGGER trg_platform_sessions_updated
  BEFORE UPDATE ON public.platform_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "platform_sessions_own" ON public.platform_sessions;
CREATE POLICY "platform_sessions_own"
  ON public.platform_sessions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------- 4. CHECK constraints ----------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_templates_type'
  ) THEN
    ALTER TABLE public.templates
      ADD CONSTRAINT chk_templates_type CHECK (type IN ('text', 'html', 'markdown'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_ar_type'
  ) THEN
    ALTER TABLE public.automation_rules
      ADD CONSTRAINT chk_ar_type CHECK (type IN (
        'marketplace', 'price', 'discount', 'category', 'keywords',
        'coupon', 'source', 'schedule', 'quantity'
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_ar_operator'
  ) THEN
    ALTER TABLE public.automation_rules
      ADD CONSTRAINT chk_ar_operator CHECK (operator IN (
        'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'not_contains'
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_offers_currency'
  ) THEN
    ALTER TABLE public.offers
      ADD CONSTRAINT chk_offers_currency CHECK (currency IN (
        'BRL', 'USD', 'ARS', 'COP', 'MXN', 'CLP', 'PEN', 'EUR', 'GBP'
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_ac_provider'
  ) THEN
    ALTER TABLE public.affiliate_credentials
      ADD CONSTRAINT chk_ac_provider CHECK (provider IN (
        'mercadolivre', 'shopee', 'amazon', 'aliexpress', 'awin', 'rakuten'
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_ac_type'
  ) THEN
    ALTER TABLE public.affiliate_credentials
      ADD CONSTRAINT chk_ac_type CHECK (credential_type IN (
        'api_key', 'oauth_token', 'session_cookie'
      ));
  END IF;
END $$;

-- ---------- 5. monitors.source_id — impedir referência cross-user ----------
CREATE OR REPLACE FUNCTION public.check_monitor_source_ownership()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  source_owner UUID;
BEGIN
  IF NEW.source_id IS NOT NULL THEN
    SELECT user_id INTO source_owner FROM public.sources WHERE id = NEW.source_id;
    IF source_owner IS NULL THEN
      RAISE EXCEPTION 'source_id não encontrado';
    END IF;
    IF source_owner <> NEW.user_id THEN
      RAISE EXCEPTION 'source_id não pertence a este usuário';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_monitors_source_ownership ON public.monitors;
CREATE TRIGGER trg_monitors_source_ownership
  BEFORE INSERT OR UPDATE OF source_id ON public.monitors
  FOR EACH ROW EXECUTE FUNCTION public.check_monitor_source_ownership();

-- ---------- 6. meli_sessions — coluna created_at + trigger ----------
ALTER TABLE public.meli_sessions
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_meli_sessions_updated ON public.meli_sessions;
CREATE TRIGGER trg_meli_sessions_updated
  BEFORE UPDATE ON public.meli_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 7. converted_offers — coluna updated_at + trigger ----------
ALTER TABLE public.converted_offers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS trg_converted_offers_updated ON public.converted_offers;
CREATE TRIGGER trg_converted_offers_updated
  BEFORE UPDATE ON public.converted_offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();