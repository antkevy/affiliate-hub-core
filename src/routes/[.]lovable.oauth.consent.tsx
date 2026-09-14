import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Bot, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Autorizar integração — Affiliate Hub" },
      { name: "description", content: "Autorize uma integração de agente na sua conta Affiliate Hub." },
      { property: "og:title", content: "Autorizar integração — Affiliate Hub" },
      { property: "og:description", content: "Autorize uma integração de agente na sua conta Affiliate Hub." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    authorization_id:
      typeof search["authorization_id"] === "string" ? search["authorization_id"] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Solicitação de autorização ausente.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = `${location.pathname}${location.searchStr}`;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loaderDeps: ({ search }) => ({ authorizationId: search.authorization_id }),
  loader: async ({ deps }) => {
    const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(
      deps.authorizationId,
    );
    if (error) throw error;
    if (data && "redirect_url" in data) throw redirect({ href: data.redirect_url });
    return data;
  },
  component: ConsentPage,
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="panel w-full max-w-md p-6 text-center">
        <h1 className="text-xl font-semibold">Não foi possível abrir esta autorização</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </section>
    </main>
  ),
});

function ConsentPage() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client.name ?? "um agente";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const result = approve
      ? await supabase.auth.oauth.approveAuthorization(authorization_id, {
          skipBrowserRedirect: true,
        })
      : await supabase.auth.oauth.denyAuthorization(authorization_id, {
          skipBrowserRedirect: true,
        });
    if (result.error) {
      setBusy(false);
      setError(result.error.message);
      return;
    }
    if (!result.data?.redirect_url) {
      setBusy(false);
      setError("O serviço de autorização não informou para onde continuar.");
      return;
    }
    window.location.assign(result.data.redirect_url);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="panel w-full max-w-md p-6">
        <div className="mb-6 flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Bot className="size-5" />
        </div>
        <p className="text-eyebrow">Integração de agente</p>
        <h1 className="mt-2 text-2xl font-semibold">Conectar {clientName}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          O agente poderá consultar seu painel, ofertas, links e automações. Seus dados continuam protegidos pela sua conta.
        </p>
        <div className="mt-5 flex items-start gap-3 rounded-md border border-border bg-secondary p-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
          <p className="text-xs leading-5 text-muted-foreground">
            Esta integração é somente leitura e não recebe senhas ou credenciais de afiliado.
          </p>
        </div>
        {error ? <p className="mt-4 text-sm text-destructive" role="alert">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => decide(false)}>
            Negar
          </Button>
          <Button disabled={busy} onClick={() => decide(true)}>
            {busy ? "Processando..." : "Autorizar"}
          </Button>
        </div>
      </section>
    </main>
  );
}