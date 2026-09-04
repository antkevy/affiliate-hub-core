import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusPill } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { integrationsService } from "@/services/integrations";
import { toUserMessage } from "@/services/base";
import { INTEGRATION_STATE_LABEL } from "@/types";

export const Route = createFileRoute("/_authenticated/integracoes")({
  head: () => ({
    meta: [
      { title: "Integrações — Affiliate Hub" },
      { name: "description", content: "Conexões com canais e marketplaces de afiliados." },
      { property: "og:title", content: "Integrações — Affiliate Hub" },
      { property: "og:description", content: "Conexões com canais e marketplaces de afiliados." },
    ],
  }),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const channels = integrationsService.definitions.filter((item) => item.kind === "channel");
  const marketplaces = integrationsService.definitions.filter(
    (item) => item.kind === "marketplace",
  );

  function connect() {
    try {
      integrationsService.connect();
    } catch (error) {
      toast.info(toUserMessage(error));
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Sistema"
        title="Integrações"
        description="Todas as integrações estão inativas. A conexão real será configurada posteriormente."
      />

      <div className="space-y-8">
        <Section title="Canais" items={channels} onConnect={connect} />
        <Section title="Marketplaces" items={marketplaces} onConnect={connect} />
      </div>
    </>
  );
}

function Section({
  title,
  items,
  onConnect,
}: {
  title: string;
  items: typeof integrationsService.definitions;
  onConnect: () => void;
}) {
  return (
    <section>
      <p className="text-eyebrow mb-3">{title}</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((integration) => (
          <div key={integration.slug} className="panel space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{integration.name}</p>
                <p className="text-xs text-muted-foreground">{integration.description}</p>
              </div>
              <StatusPill tone="neutral">{INTEGRATION_STATE_LABEL.not_configured}</StatusPill>
            </div>
            <ul className="space-y-1">
              {integration.fields.map((field) => (
                <li key={field.key} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{field.label}</span>
                  <span className="font-mono text-muted-foreground">
                    {field.secret ? "••••••" : "—"}
                  </span>
                </li>
              ))}
            </ul>
            <Button size="sm" variant="outline" onClick={onConnect}>
              Conectar
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
