import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PackageSearch, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataState } from "@/components/common/DataState";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusPill, entityTone } from "@/components/common/StatusPill";
import { MonitorDialog } from "@/components/common/MonitorDialog";
import { buildConfiguration, configurationOf, type MonitorFormValues } from "@/lib/monitor-config";
import { Button } from "@/components/ui/button";
import { monitorsService } from "@/services/monitors";
import { sourcesService } from "@/services/sources";
import { destinationsService } from "@/services/destinations";
import { templatesService } from "@/services/templates";
import { listMarketplaces } from "@/services/affiliate";
import { toUserMessage } from "@/services/base";
import {
  ENTITY_STATUS_LABEL,
  type Marketplace,
  type Monitor,
  type MonitorConfiguration,
} from "@/types";

export const Route = createFileRoute("/_authenticated/monitoramento")({
  head: () => ({
    meta: [
      { title: "Monitoramento — Affiliate Hub" },
      {
        name: "description",
        content: "Acompanhe os monitores de fontes e sua atividade.",
      },
      { property: "og:title", content: "Monitoramento — Affiliate Hub" },
      {
        property: "og:description",
        content: "Acompanhe os monitores de fontes e sua atividade.",
      },
    ],
  }),
  component: MonitoringPage,
});

function MonitoringPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Monitor | null>(null);
  const [editingOpen, setEditingOpen] = useState(false);

  const monitors = useQuery({ queryKey: ["monitors"], queryFn: () => monitorsService.list() });
  const sources = useQuery({ queryKey: ["sources"], queryFn: () => sourcesService.list() });
  const marketplaces = useQuery({ queryKey: ["marketplaces"], queryFn: listMarketplaces });
  const destinations = useQuery({
    queryKey: ["destinations"],
    queryFn: () => destinationsService.list(),
  });
  const templates = useQuery({ queryKey: ["templates"], queryFn: () => templatesService.list() });
  const offerCounts = useQuery({
    queryKey: ["offer-counts"],
    queryFn: () => monitorsService.offerCounts(),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["monitors"] });
  }

  function edit(monitor: Monitor) {
    setEditing(monitor);
    setEditingOpen(true);
  }

  async function handleSubmit(values: MonitorFormValues, monitor: Monitor | null) {
    const configuration = buildConfiguration(values);
    if (monitor) {
      await monitorsService.update(monitor.id, {
        name: values.name,
        source_id: values.source_id,
        configuration,
      });
    } else {
      await monitorsService.create({
        name: values.name,
        source_id: values.source_id,
        configuration,
      });
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Principal"
        title="Monitoramento"
        description="Monitores conectados às suas fontes. A captura em tempo real será configurada posteriormente."
        actions={
          <MonitorDialog
            title="Novo monitor"
            description="Defina a fonte, os filtros e o destino das ofertas capturadas."
            sources={sources.data ?? []}
            marketplaces={marketplaces.data ?? []}
            destinations={destinations.data ?? []}
            templates={templates.data ?? []}
            trigger={
              <Button size="sm">
                <Plus className="mr-1.5 size-4" /> Novo monitor
              </Button>
            }
            onSubmit={(values) => handleSubmit(values, null)}
            onSuccess={invalidate}
          />
        }
      />

      <MonitorDialog
        open={editingOpen}
        onOpenChange={setEditingOpen}
        title="Editar monitor"
        monitor={editing}
        sources={sources.data ?? []}
        marketplaces={marketplaces.data ?? []}
        destinations={destinations.data ?? []}
        templates={templates.data ?? []}
        onSubmit={(values) => handleSubmit(values, editing)}
        onSuccess={invalidate}
      />

      <DataState
        isLoading={monitors.isLoading}
        error={monitors.error}
        isEmpty={(monitors.data ?? []).length === 0}
        empty={
          <EmptyState
            icon={PackageSearch}
            title="Nenhum monitor configurado"
            description="Crie um monitor vinculado a uma fonte para acompanhar novas ofertas."
          />
        }
      >
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Monitor</th>
                <th className="px-4 py-2 font-medium">Fonte</th>
                <th className="px-4 py-2 font-medium">Ofertas</th>
                <th className="px-4 py-2 font-medium">Config</th>
                <th className="px-4 py-2 font-medium">Última atividade</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(monitors.data ?? []).map((monitor) => (
                <tr key={monitor.id}>
                  <td className="max-w-xs px-4 py-2.5">
                    <p className="truncate font-medium">{monitor.name}</p>
                    {monitor.source_id ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {sourceName(sources.data ?? [], monitor.source_id)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sem fonte vinculada</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {sourceName(sources.data ?? [], monitor.source_id)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                    {offerCounts.data?.[monitor.source_id ?? ""] ?? 0}
                  </td>
                  <td className="max-w-[16rem] px-4 py-2.5">
                    <ConfigSummary
                      config={configurationOf(monitor)}
                      marketplaces={marketplaces.data ?? []}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {monitor.last_activity_at
                      ? new Date(monitor.last_activity_at).toLocaleString("pt-BR")
                      : "Sem atividade"}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusPill tone={entityTone(monitor.status)}>
                      {ENTITY_STATUS_LABEL[monitor.status]}
                    </StatusPill>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {monitor.status === "active" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              await monitorsService.pause(monitor.id);
                              invalidate();
                            } catch (error) {
                              toast.error(toUserMessage(error));
                            }
                          }}
                        >
                          <Pause className="mr-1 size-3.5" /> Pausar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={async () => {
                            try {
                              await monitorsService.activate(monitor.id);
                              invalidate();
                            } catch (error) {
                              toast.error(toUserMessage(error));
                            }
                          }}
                        >
                          <Play className="mr-1 size-3.5" /> Ativar
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => edit(monitor)}>
                        <Pencil className="mr-1 size-3.5" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await monitorsService.remove(monitor.id);
                            if (editing?.id === monitor.id) setEditingOpen(false);
                            invalidate();
                          } catch (error) {
                            toast.error(toUserMessage(error));
                          }
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>
    </>
  );
}

function sourceName(sources: { id: string; name: string }[], id: string | null): string {
  if (!id) return "—";
  return sources.find((source) => source.id === id)?.name ?? "—";
}

function ConfigSummary({
  config,
  marketplaces,
}: {
  config: MonitorConfiguration;
  marketplaces: Marketplace[];
}) {
  const parts: string[] = [];

  const marketplace = marketplaces.find((item) => item.id === config.marketplace_id);
  if (marketplace) parts.push(marketplace.name);

  const hasDestination = Boolean(config.destination_id);
  const hasTemplate = Boolean(config.template_id);
  if (hasDestination && hasTemplate) parts.push("Destino + Template");
  else if (hasDestination) parts.push("Destino");
  else if (hasTemplate) parts.push("Template");

  if (config.min_discount !== null && config.min_discount !== undefined) {
    parts.push(`Desconto ≥ ${config.min_discount}%`);
  }
  if (config.max_price !== null && config.max_price !== undefined) {
    parts.push(`Preço ≤ ${money(config.max_price)}`);
  }
  if (config.keywords && config.keywords.length > 0) {
    parts.push(`${config.keywords.length} palavra(s)-chave`);
  }

  return (
    <p className="truncate text-xs text-muted-foreground">
      {parts.length > 0 ? parts.join(" · ") : "Sem filtros ou vínculos"}
    </p>
  );
}

function money(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
