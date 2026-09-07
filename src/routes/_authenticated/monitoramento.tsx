import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  ClipboardList,
  Loader2,
  Pause,
  Pencil,
  Play,
  Plus,
  Radio,
  ShoppingBag,
  Tags,
  Trash2,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataState } from "@/components/common/DataState";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusPill, entityTone } from "@/components/common/StatusPill";
import { LiveBadge, StatCard, timeAgo } from "@/components/common/stat-card";
import { MonitorDialog } from "@/components/common/MonitorDialog";
import { buildConfiguration, configurationOf, type MonitorFormValues } from "@/lib/monitor-config";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCapture } from "@/hooks/useCapture";
import { monitorsService } from "@/services/monitors";
import { sourcesService } from "@/services/sources";
import { destinationsService } from "@/services/destinations";
import { templatesService } from "@/services/templates";
import { bannersService } from "@/services/banners";
import { listMarketplaces } from "@/services/affiliate";
import { toUserMessage } from "@/services/base";
import { type Monitor, type MonitorConfiguration, type Source } from "@/types";
import { cn } from "@/lib/utils";

const MONITOR_STATUS_LABEL: Record<Monitor["status"], string> = {
  active: "Ativo",
  paused: "Pausado",
  error: "Erro",
};

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
  const banners = useQuery({ queryKey: ["banners"], queryFn: () => bannersService.list() });
  const offerCounts = useQuery({
    queryKey: ["offer-counts"],
    queryFn: () => monitorsService.offerCounts(),
  });

  const monitorList = monitors.data ?? [];
  const activeCount = monitorList.filter((monitor) => monitor.status === "active").length;
  const captured = monitorList.reduce(
    (total, monitor) =>
      total + totalOffers(offerCounts.data, configurationOf(monitor).source_ids ?? []),
    0,
  );
  const monitoredSourceIds = new Set(
    monitorList.flatMap((monitor) => configurationOf(monitor).source_ids ?? []),
  );
  const aiCount = monitorList.filter((monitor) => configurationOf(monitor).ai_enabled).length;
  const isLoading = monitors.isLoading || sources.isLoading || offerCounts.isLoading;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["monitors"] });
    queryClient.invalidateQueries({ queryKey: ["offer-counts"] });
  }

  function edit(monitor: Monitor) {
    setEditing(monitor);
    setEditingOpen(true);
  }

  async function handleSubmit(values: MonitorFormValues, monitor: Monitor | null) {
    const configuration = buildConfiguration(values);
    if (monitor) {
      await monitorsService.update(monitor.id, { name: values.name, configuration });
    } else {
      await monitorsService.create({ name: values.name, configuration });
    }
  }

  const { running, run } = useCapture();

  return (
    <>
      <PageHeader
        eyebrow="Principal"
        title="Monitoramento"
        description="Monitores conectados às suas fontes. Use “Processar agora” para capturar e publicar."
        actions={
          <div className="flex items-center gap-2">
            <LiveBadge active={activeCount} idleLabel="Sem monitores ativos" />
            <Button
              size="sm"
              variant="outline"
              disabled={running}
              onClick={async () => {
                const report = await run();
                if (report) invalidate();
              }}
            >
              <Loader2 className={`mr-1.5 ${running ? "size-4 animate-spin" : "size-4"}`} />
              {running ? "Processando..." : "Processar agora"}
            </Button>
            <MonitorDialog
              title="Novo monitor"
              description="Escolha os grupos, os marketplaces e os filtros das ofertas capturadas."
              sources={sources.data ?? []}
              marketplaces={marketplaces.data ?? []}
              destinations={destinations.data ?? []}
              templates={templates.data ?? []}
              banners={banners.data ?? []}
              trigger={
                <Button size="sm">
                  <Plus className="mr-1.5 size-4" /> Novo monitor
                </Button>
              }
              onSubmit={(values) => handleSubmit(values, null)}
              onSuccess={invalidate}
            />
          </div>
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
        banners={banners.data ?? []}
        onSubmit={(values) => handleSubmit(values, editing)}
        onSuccess={invalidate}
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="panel h-[116px] animate-pulse p-4" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Workflow}
            label="Monitores ativos"
            value={activeCount}
            hint={`${monitorList.length} no total`}
            accent="text-chart-2 bg-chart-2/10 border-chart-2/20"
            delay={0}
          />
          <StatCard
            icon={ShoppingBag}
            label="Ofertas capturadas"
            value={captured}
            hint="Sumarizadas por fonte"
            accent="text-chart-3 bg-chart-3/10 border-chart-3/20"
            delay={40}
          />
          <StatCard
            icon={Radio}
            label="Fontes monitoradas"
            value={monitoredSourceIds.size}
            hint="Grupos e canais vinculados"
            accent="text-chart-1 bg-chart-1/10 border-chart-1/20"
            delay={80}
          />
          <StatCard
            icon={Bot}
            label="Reescrevem com IA"
            value={aiCount}
            hint="Publicações geradas por IA"
            accent="text-chart-4 bg-chart-4/10 border-chart-4/20"
            delay={120}
          />
        </div>
      )}

      <DataState
        isLoading={false}
        error={monitors.error}
        isEmpty={(monitors.data ?? []).length === 0}
        empty={
          <EmptyState
            icon={Radio}
            title="Nenhum monitor configurado"
            description="Crie um monitor vinculado a um ou mais grupos para acompanhar novas ofertas."
          />
        }
      >
        <div className="panel overflow-x-auto animate-rise" style={{ animationDelay: "160ms" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5">Monitor</th>
                <th className="px-4 py-2.5">Fontes</th>
                <th className="px-4 py-2.5">Ofertas</th>
                <th className="px-4 py-2.5">Config</th>
                <th className="px-4 py-2.5">Última atividade</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(monitors.data ?? []).map((monitor) => {
                const config = configurationOf(monitor);
                const monitorSources = sourcesOf(sources.data ?? [], config.source_ids ?? []);
                return (
                  <tr key={monitor.id} className="group transition-colors hover:bg-secondary/40">
                    <td className="max-w-xs px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "grid size-8 shrink-0 place-items-center rounded-lg border",
                            monitor.status === "active"
                              ? "border-success/20 bg-success/10 text-success"
                              : monitor.status === "error"
                                ? "border-destructive/20 bg-destructive/10 text-destructive"
                                : "border-border bg-secondary/60 text-muted-foreground",
                          )}
                        >
                          <Radio className="size-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{monitor.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {monitorSources.length}{" "}
                            {monitorSources.length === 1
                              ? "grupo monitorado"
                              : "grupos monitorados"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[14rem] px-4 py-3">
                      {monitorSources.length > 0 ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {monitorSources
                            .slice(0, 2)
                            .map((source) => source.name)
                            .join(", ")}
                          {monitorSources.length > 2 ? ` e mais ${monitorSources.length - 2}` : ""}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Sem fontes vinculadas</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums">
                        <Tags className="size-3.5 text-subtle-foreground" />
                        {totalOffers(offerCounts.data, config.source_ids ?? [])}
                      </span>
                    </td>
                    <td className="max-w-[16rem] px-4 py-3">
                      <ConfigChips config={config} templates={templates.data ?? []} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs text-muted-foreground"
                        title={
                          monitor.last_activity_at
                            ? new Date(monitor.last_activity_at).toLocaleString("pt-BR")
                            : undefined
                        }
                      >
                        {monitor.last_activity_at
                          ? timeAgo(monitor.last_activity_at)
                          : "Sem atividade"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={entityTone(monitor.status)}>
                        <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current align-middle" />
                        {MONITOR_STATUS_LABEL[monitor.status]}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3">
                      <TooltipProvider delayDuration={100}>
                        <div className="flex items-center justify-end gap-1">
                          {monitor.status === "active" ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="size-8 px-0"
                                  aria-label="Pausar monitor"
                                  onClick={async () => {
                                    try {
                                      await monitorsService.pause(monitor.id);
                                      invalidate();
                                    } catch (error) {
                                      toast.error(toUserMessage(error));
                                    }
                                  }}
                                >
                                  <Pause className="size-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Pausar</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  className="size-8 px-0"
                                  aria-label="Ativar monitor"
                                  onClick={async () => {
                                    try {
                                      await monitorsService.activate(monitor.id);
                                      invalidate();
                                    } catch (error) {
                                      toast.error(toUserMessage(error));
                                    }
                                  }}
                                >
                                  <Play className="size-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ativar</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="size-8 px-0"
                                aria-label="Editar monitor"
                                onClick={() => edit(monitor)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="size-8 px-0 text-muted-foreground hover:text-destructive"
                                aria-label="Excluir monitor"
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
                            </TooltipTrigger>
                            <TooltipContent>Excluir</TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DataState>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-subtle-foreground">
        <ClipboardList className="size-3.5" />
        Ofertas contadas por fonte vinculada; compartilhe “Processar agora” para um novo ciclo.
      </p>
    </>
  );
}

function sourcesOf(sources: { id: string; name: string }[], ids: string[]): Source[] {
  return ids
    .map((id) => sources.find((source) => source.id === id))
    .filter((source): source is Source => Boolean(source));
}

function totalOffers(counts: Record<string, number> | undefined, sourceIds: string[]): number {
  return sourceIds.reduce((total, id) => total + (counts?.[id] ?? 0), 0);
}

type ConfigChip = { key: string; label: string; tone?: "primary" | "info" };

function ConfigChips({
  config,
  templates = [],
}: {
  config: MonitorConfiguration;
  templates?: { id: string; name: string }[];
}) {
  const chips: ConfigChip[] = [];

  const marketplaceIds = config.marketplace_ids ?? [];
  if (marketplaceIds.length > 0) {
    chips.push({ key: "marketplaces", label: `${marketplaceIds.length} marketplace(s)` });
  }
  if (config.template_id) {
    const templateName = templates.find((t) => t.id === config.template_id)?.name;
    chips.push({ key: "template", label: templateName ? `Template: ${templateName}` : "Template" });
  }
  if (config.min_discount !== null && config.min_discount !== undefined) {
    chips.push({ key: "discount", label: `≥ ${config.min_discount}%` });
  }
  if (config.max_price !== null && config.max_price !== undefined) {
    chips.push({ key: "price", label: `≤ ${money(config.max_price)}` });
  }
  if (config.keywords && config.keywords.length > 0) {
    chips.push({ key: "keywords", label: `${config.keywords.length} termo(s)` });
  }
  if (config.ai_enabled) chips.push({ key: "ia", label: "IA", tone: "primary" });
  if (config.include_banner) chips.push({ key: "banner", label: "Banner", tone: "info" });

  if (chips.length === 0) {
    return <p className="text-xs text-muted-foreground">Sem filtros ou vínculos</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className={cn(
            "max-w-[9rem] truncate rounded-md border px-1.5 py-0.5 text-[11px]",
            chip.tone === "primary"
              ? "border-primary/20 bg-primary/10 text-primary"
              : chip.tone === "info"
                ? "border-chart-4/20 bg-chart-4/10 text-chart-4"
                : "border-border bg-secondary/40 text-muted-foreground",
          )}
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}

function money(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
