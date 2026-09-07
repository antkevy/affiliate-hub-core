-- Migration: Create platform_sessions table for headless browser session persistence
CREATE TABLE IF NOT EXISTS public.platform_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT UNIQUE NOT NULL,
  cookies TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.platform_sessions ENABLE ROW LEVEL SECURITY;

-- Grant service_role full access policy
CREATE POLICY "Allow service_role full access to platform_sessions"
  ON public.platform_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
