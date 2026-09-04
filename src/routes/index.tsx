import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Affiliate Hub — Automação para afiliados" },
      {
        name: "description",
        content:
          "Plataforma pessoal para monitorar fontes, converter links, criar conteúdo e publicar ofertas de afiliado.",
      },
      { property: "og:title", content: "Affiliate Hub — Automação para afiliados" },
      {
        property: "og:description",
        content:
          "Plataforma pessoal para monitorar fontes, converter links, criar conteúdo e publicar ofertas de afiliado.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? "/dashboard" : "/auth" });
  },
  component: () => null,
});
