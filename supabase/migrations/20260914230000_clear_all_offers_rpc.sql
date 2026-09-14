-- ============================================================
-- clear_all_user_offers — limpeza atômica das ofertas do usuário
-- ------------------------------------------------------------
-- Remove (em uma única transação) as ofertas do usuário logado
-- junto com as linhas filhas (offer_media e publications),
-- evitando listas IN gigantes na URL do REST (causa de 400
-- "Bad Request" quando há muitas ofertas capturadas).
--
-- Security definer: roda como dono da função, mas restringe
-- tudo ao auth.uid() para não vazar dados entre usuários.
-- ============================================================

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