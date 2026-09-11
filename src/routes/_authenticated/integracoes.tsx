import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Globe,
  MessageCircle,
  MessageSquare,
  Package,
  ShoppingBag,
  ShoppingCart,
  Store,
  Tag,
  Unplug,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

const ICON_MAP: Record<string, LucideIcon> = {
  telegram: MessageSquare,
  whatsapp: MessageCircle,
  "mercado-livre": ShoppingBag,
  shopee: Tag,
  amazon: Package,
  aliexpress: Globe,
  magalu: Store,
  kabum: ShoppingCart,
  terabyte: Package,
};

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
    <div className="space-y-6">
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
    </div>
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
    <section className="animate-rise">
      <p className="text-eyebrow mb-3">Canais</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {channels.map((integration) => {
          const Icon = ICON_MAP[integration.slug] ?? Unplug;
          return (
            <div
              key={integration.slug}
              className="group panel space-y-3 p-4 transition-colors hover:border-primary/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-secondary/60 text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{integration.name}</p>
                    <p className="text-xs text-muted-foreground">{integration.description}</p>
                  </div>
                </div>
                <StatusPill tone="neutral">
                  <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current align-middle" />
                  Via Destinos
                </StatusPill>
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
          );
        })}
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
    <section className="animate-rise" style={{ animationDelay: "80ms" }}>
      <p className="text-eyebrow mb-3">Marketplaces</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {definitions.map((integration) => {
          const account = accounts.get(integration.slug);
          const connected = account?.status === "connected";
          const Icon = ICON_MAP[integration.slug] ?? Unplug;
          return (
            <div
              key={integration.slug}
              className="group panel space-y-3 p-4 transition-colors hover:border-primary/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-lg border ${
                      connected
                        ? "border-success/20 bg-success/10 text-success"
                        : "border-border bg-secondary/60 text-muted-foreground"
                    }`}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{integration.name}</p>
                    <p className="text-xs text-muted-foreground">{integration.description}</p>
                  </div>
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
                <li className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">SubID</span>
                  <span className="font-mono text-muted-foreground">
                    <FieldValue account={account} fieldKey="subid" secret={false} />
                  </span>
                </li>
              </ul>
              <div className="flex gap-2">
                <ConnectDialog integration={integration} account={account} onSaved={onSaved} />
                {connected ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => onDisconnect(integration.slug)}
                  >
                    <Unplug className="mr-1 size-3.5" />
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
      <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current align-middle" />
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

  const subidField: DialogField = {
    key: "subid",
    label: "SubID (rastreio de campanha)",
    type: "text",
    placeholder: "Ex.: campanha-julho (opcional)",
    defaultValue: configValue(account, "subid"),
  };
  fields.push(subidField);

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
        values["subid"] = get("subid");
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
