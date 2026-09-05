import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusPill, entityTone } from "@/components/common/StatusPill";
import { CreateEntityDialog, type DialogField } from "@/components/common/CreateEntityDialog";
import { Button } from "@/components/ui/button";
import { integrationsService } from "@/services/integrations";
import { affiliateAccountsService, listMarketplaces } from "@/services/affiliate";
import { toUserMessage } from "@/services/base";
import type { AffiliateAccount, IntegrationDefinition } from "@/types";

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
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const accounts = useQuery({
    queryKey: ["affiliate-accounts"],
    queryFn: () => affiliateAccountsService.list(),
  });
  const marketplaces = useQuery({ queryKey: ["marketplaces"], queryFn: listMarketplaces });

  const accountsBySlug = new Map<string, AffiliateAccount>();
  for (const account of accounts.data ?? []) {
    const marketplace = (marketplaces.data ?? []).find(
      (item) => item.id === account.marketplace_id,
    );
    if (marketplace) accountsBySlug.set(marketplace.slug.toLowerCase(), account);
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["affiliate-accounts"] });
  }

  async function handleDisconnect(slug: string) {
    try {
      await integrationsService.disconnectMarketplace(slug);
      toast.success("Integração desconectada.");
      invalidate();
    } catch (error) {
      toast.error("Não foi possível desconectar", { description: toUserMessage(error) });
    }
  }

  const channels = integrationsService.definitions.filter((item) => item.kind === "channel");
  const marketplaceDefinitions = integrationsService.definitions.filter(
    (item) => item.kind === "marketplace",
  );

  return (
    <>
      <PageHeader
        eyebrow="Sistema"
        title="Integrações"
        description="Conecte marketplaces para converter links de afiliado e gerencie a publicação em destinos."
      />

      <div className="space-y-8">
        <ChannelSection channels={channels} onConfigure={() => navigate({ to: "/destinos" })} />
        <MarketplaceSection
          definitions={marketplaceDefinitions}
          accounts={accountsBySlug}
          loading={accounts.isLoading || marketplaces.isLoading}
          onSaved={invalidate}
          onDisconnect={handleDisconnect}
        />
      </div>
    </>
  );
}

function ChannelSection({
  channels,
  onConfigure,
}: {
  channels: IntegrationDefinition[];
  onConfigure: () => void;
}) {
  return (
    <section>
      <p className="text-eyebrow mb-3">Canais</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {channels.map((integration) => (
          <div key={integration.slug} className="panel space-y-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{integration.name}</p>
                <p className="text-xs text-muted-foreground">{integration.description}</p>
              </div>
              <StatusPill tone="neutral">Via Destinos</StatusPill>
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
            <Button size="sm" variant="outline" onClick={onConfigure}>
              Configurar publicação
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

function MarketplaceSection({
  definitions,
  accounts,
  loading,
  onSaved,
  onDisconnect,
}: {
  definitions: IntegrationDefinition[];
  accounts: Map<string, AffiliateAccount>;
  loading: boolean;
  onSaved: () => void;
  onDisconnect: (slug: string) => void;
}) {
  return (
    <section>
      <p className="text-eyebrow mb-3">Marketplaces</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {definitions.map((integration) => {
          const account = accounts.get(integration.slug);
          const connected = account?.status === "connected";
          return (
            <div key={integration.slug} className="panel space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{integration.name}</p>
                  <p className="text-xs text-muted-foreground">{integration.description}</p>
                </div>
                <MarketplacePill account={account} loading={loading} />
              </div>
              <ul className="space-y-1">
                {integration.fields.map((field) => (
                  <li key={field.key} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{field.label}</span>
                    <span className="font-mono text-muted-foreground">
                      <FieldValue account={account} fieldKey={field.key} secret={field.secret} />
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <ConnectDialog integration={integration} account={account} onSaved={onSaved} />
                {connected ? (
                  <Button size="sm" variant="ghost" onClick={() => onDisconnect(integration.slug)}>
                    Desconectar
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MarketplacePill({
  account,
  loading,
}: {
  account: AffiliateAccount | undefined;
  loading: boolean;
}) {
  if (loading) return <StatusPill tone="neutral">…</StatusPill>;
  if (!account) return <StatusPill tone="neutral">Não configurada</StatusPill>;
  const label: Record<string, string> = {
    connected: "Conectada",
    disconnected: "Desconectada",
    error: "Erro",
  };
  return (
    <StatusPill tone={entityTone(account.status)}>
      {label[account.status] ?? account.status}
    </StatusPill>
  );
}

function FieldValue({
  account,
  fieldKey,
  secret,
}: {
  account: AffiliateAccount | undefined;
  fieldKey: string;
  secret: boolean | undefined;
}) {
  const raw = configValue(account, fieldKey);
  if (!raw) return <>{secret ? "•" : "—"}</>;
  return <>{secret ? "••••••" : raw}</>;
}

function ConnectDialog({
  integration,
  account,
  onSaved,
}: {
  integration: IntegrationDefinition;
  account: AffiliateAccount | undefined;
  onSaved: () => void;
}) {
  const fields: DialogField[] = integration.fields.map((field): DialogField => {
    const dialogField: DialogField = {
      key: field.key,
      label: field.label,
      type: field.secret ? "password" : "text",
    };
    const placeholder = field.secret
      ? "Deixe em branco para manter o valor atual"
      : field.placeholder;
    if (placeholder) dialogField.placeholder = placeholder;
    if (!field.secret) {
      const current = configValue(account, field.key);
      if (current) dialogField.defaultValue = current;
    }
    return dialogField;
  });

  return (
    <CreateEntityDialog
      title={`Conectar ${integration.name}`}
      description="Os dados ficam salvos apenas na sua conta e são usados na conversão de links de afiliado."
      trigger={
        <Button size="sm" variant={account ? "outline" : "default"}>
          {account ? "Editar" : "Conectar"}
        </Button>
      }
      fields={fields}
      onSubmit={async (get) => {
        const values: Record<string, string> = {};
        for (const field of integration.fields) values[field.key] = get(field.key);
        await integrationsService.connectMarketplace(integration.slug, values);
      }}
      onSuccess={onSaved}
    />
  );
}

function configValue(account: AffiliateAccount | undefined, key: string): string {
  const configuration = account?.configuration;
  if (!configuration || typeof configuration !== "object") return "";
  const value = (configuration as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}
