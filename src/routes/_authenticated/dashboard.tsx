import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Bot,
  HeartPulse,
  Inbox,
  Link2,
  Megaphone,
  Plug,
  Plus,
  RefreshCw,
  Send,
  ShoppingBag,
  Tags,
  Workflow,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusPill, entityTone } from "@/components/common/StatusPill";
import { LiveBadge, formatPrice, timeAgo } from "@/components/common/stat-card";
import { AssistantChat } from "@/components/common/AssistantChat";
import { Button } from "@/components/ui/button";
import { offersService } from "@/services/offers";
import { automationsService } from "@/services/automations";
import { publicationsService } from "@/services/publications";
import { destinationsService } from "@/services/destinations";
import { listMarketplaces } from "@/services/affiliate";
import { OFFER_STATUS_LABEL, PUBLICATION_STATUS_LABEL, type Publication } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Affiliate Hub" },
      {
        name: "description",
        content: "Visão geral de ofertas capturadas, automações ativas e publicações.",
      },
      { property: "og:title", content: "Dashboard — Affiliate Hub" },
      {
        property: "og:description",
        content: "Visão geral de ofertas capturadas, automações ativas e publicações.",
      },
    ],
  }),
  component: DashboardPage,
});

const SENDER_TONES = [
  "border-chart-1/30 bg-chart-1/15 text-chart-1",
  "border-chart-2/30 bg-chart-2/15 text-chart-2",
  "border-chart-3/30 bg-chart-3/15 text-chart-3",
  "border-chart-4/30 bg-chart-4/15 text-chart-4",
  "border-chart-5/30 bg-chart-5/15 text-chart-5",
];

function senderTone(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 997;
  }
  return SENDER_TONES[hash % SENDER_TONES.length];
}

function SenderPlaque({
  id,
  name,
  icon: Icon,
}: {
  id: string;
  name: string;
  icon?: typeof ShoppingBag;
}) {
  const symbol =
    (name || "")
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 2)
      .toUpperCase() || "?";
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-md border font-mono text-[10px] font-bold",
        senderTone(id),
      )}
    >
      {Icon && !name ? <Icon className="size-4" /> : symbol}
    </span>
  );
}

function DayDivider({ children }: { children: React.ReactNode }) {
  return (
    <p className="my-5 text-center font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-subtle-foreground">
      — {children} —
    </p>
  );
}

function DashboardPage() {
  const offers = useQuery({
    queryKey: ["offers", "recent"],
    queryFn: () => offersService.listWithRelations({}),
  });
  const automations = useQuery({
    queryKey: ["automations"],
    queryFn: () => automationsService.list(),
  });
  const publications = useQuery({
    queryKey: ["publications", "recent"],
    queryFn: () => publicationsService.list({ limit: 30 }),
  });
  const destinations = useQuery({
    queryKey: ["destinations"],
    queryFn: () => destinationsService.list(),
  });
  const marketplaces = useQuery({
    queryKey: ["marketplaces"],
    queryFn: listMarketplaces,
  });

  const refetching =
    offers.isFetching ||
    automations.isFetching ||
    publications.isFetching ||
    destinations.isFetching ||
    marketplaces.isFetching;

  function handleRefresh() {
    void offers.refetch();
    void automations.refetch();
    void publications.refetch();
    void destinations.refetch();
    void marketplaces.refetch();
  }

  const isLoading = offers.isLoading || automations.isLoading || publications.isLoading;

  const activeAutomations = (automations.data ?? []).filter(
    (automation) => automation.status === "active",
  ).length;

  const loadedPublications = publications.data ?? [];
  const publishedCount = loadedPublications.filter(
    (publication) => publication.status === "published",
  ).length;
  const pendingCount = loadedPublications.filter(
    (publication) => publication.status === "pending" || publication.status === "processing",
  ).length;
  const failedList = loadedPublications
    .filter((publication) => publication.status === "failed")
    .slice(0, 3);
  const successBase = loadedPublications.filter(
    (publication) => publication.status === "published" || publication.status === "failed",
  ).length;
  const successRate = successBase > 0 ? Math.round((publishedCount / successBase) * 100) : null;

  const chartData = buildPublicationSeries(loadedPublications);
  const avgPublished =
    chartData.reduce((sum, point) => sum + point.published, 0) / Math.max(chartData.length, 1);

  const destinationName = new Map(
    (destinations.data ?? []).map((destination) => [destination.id, destination.name]),
  );
  const marketplaceName = new Map(
    (marketplaces.data ?? []).map((marketplace) => [marketplace.id, marketplace.name]),
  );
  const destinationId = new Map(
    (destinations.data ?? []).map((destination) => [destination.id, destination.id]),
  );

  const recentOffers = (offers.data ?? []).slice(0, 6);
  const recentPublications = loadedPublications.slice(0, 5);

  const pipeline = [
    { label: "Capturadas", value: offers.data?.length ?? 0, icon: Inbox },
    { label: "Na fila", value: pendingCount, icon: Workflow, live: pendingCount > 0 },
    { label: "Enviadas", value: publishedCount, icon: Send },
    { label: "Destinos", value: destinations.data?.length ?? 0, icon: Plug },
  ];

  const quickActions = [
    { label: "Nova oferta", icon: Plus, to: "/ofertas" },
    { label: "Criar automação", icon: Bot, to: "/automacoes" },
    { label: "Gerar link", icon: Link2, to: "/links" },
    { label: "Ver publicações", icon: ArrowRight, to: "/publicacoes" },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mesa"
        description="O dia no tape: o que as fontes trouxeram e o que já saiu publicado."
        actions={
          <>
            <LiveBadge
              active={activeAutomations}
              idleLabel="Sem automações ativas"
              to="/automacoes"
            />
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refetching}>
              <RefreshCw className={cn("size-4", refetching && "animate-spin")} />
              {refetching ? "Atualizando..." : "Atualizar"}
            </Button>
            <Button size="sm" asChild>
              <Link to="/estatisticas">Ver estatísticas</Link>
            </Button>
          </>
        }
      />

      <section aria-label="Ciclo de automação" className="stream">
        <div className="flex flex-wrap items-center gap-1.5">
          {pipeline.map((stage, index) => (
            <div key={stage.label} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "pipeline-step",
                  stage.live && "pipeline-step-live",
                  stage.live && "pipeline-surge",
                )}
              >
                <stage.icon className="size-3.5" />
                {stage.label} · <span className="font-mono tabular-nums">{stage.value}</span>
              </span>
              {index < pipeline.length - 1 ? (
                <ArrowRight className="size-3 text-subtle-foreground" />
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Ações rápidas" className="stream">
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              to={action.to}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <action.icon className="size-3.5" />
              {action.label}
            </Link>
          ))}
        </div>
      </section>

      <section aria-label="Tape do dia" className="stream space-y-5">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="ticket h-20 animate-pulse p-4" />
            ))}
          </div>
        ) : recentOffers.length === 0 && recentPublications.length === 0 ? (
          <div className="ticket-out mx-auto mt-4 max-w-sm p-4 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-subtle-foreground">
              Sem leituras
            </p>
            <p className="mt-1 text-sm text-foreground">Nenhuma oferta por aqui ainda.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Configure uma fonte ou crie uma oferta manualmente para o tape começar.
            </p>
            <Link
              to="/fontes"
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-primary/40 px-3.5 py-1.5 text-xs font-medium text-primary"
            >
              <Plus className="size-3.5" />
              Adicionar fonte
            </Link>
          </div>
        ) : (
          <>
            <DayDivider>Agora</DayDivider>

            {recentOffers.map((offer) => {
              const sender =
                (offer.marketplace_id && marketplaceName.get(offer.marketplace_id)) || "Captura";
              return (
                <div key={offer.id} className="flex items-start gap-2.5">
                  <SenderPlaque
                    id={`${offer.marketplace_id ?? "capture"}-${sender}`}
                    name={sender}
                    icon={ShoppingBag}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-baseline justify-between gap-3 px-0.5">
                      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                        {sender}
                      </p>
                      <p className="font-mono text-[11px] text-subtle-foreground">
                        {timeAgo(offer.created_at)}
                      </p>
                    </div>
                    <div className="ticket p-3">
                      <div className="flex items-start gap-3">
                        <div className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted/40">
                          {offer.image_url ? (
                            <img
                              src={offer.image_url}
                              alt={offer.title}
                              className="size-full object-cover"
                            />
                          ) : (
                            <ShoppingBag className="size-4 text-muted-foreground/60" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-medium text-foreground">
                            {offer.title}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                              {formatPrice(
                                offer.sale_price ?? offer.original_price,
                                offer.currency,
                              )}
                            </span>
                            {offer.original_price &&
                            offer.sale_price &&
                            offer.original_price > offer.sale_price ? (
                              <span className="text-xs text-subtle-foreground line-through">
                                {formatPrice(offer.original_price, offer.currency)}
                              </span>
                            ) : null}
                            {offer.discount_percentage && offer.discount_percentage > 0 ? (
                              <span className="rounded-md bg-success/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-success border border-success/20">
                                -{Math.round(offer.discount_percentage)}%
                              </span>
                            ) : null}
                            <StatusPill tone={entityTone(offer.status)}>
                              {OFFER_STATUS_LABEL[offer.status]}
                            </StatusPill>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {activeAutomations > 0 ? (
              <p className="text-center text-xs text-muted-foreground">
                {activeAutomations} automação{activeAutomations > 1 ? "ões" : ""} ativa
                {activeAutomations > 1 ? "s" : ""} rodando em segundo plano
              </p>
            ) : null}

            {recentPublications.length > 0 ? (
              <>
                <DayDivider>Saída</DayDivider>
                {recentPublications.map((publication) => {
                  const sender = publication.destination_id
                    ? (destinationName.get(publication.destination_id) ?? "Destino")
                    : "Destino";
                  return (
                    <div key={publication.id} className="flex justify-end gap-2.5">
                      <div className="min-w-0 max-w-[34rem] text-right">
                        <div className="mb-1 flex items-baseline justify-end gap-3 px-0.5">
                          <p className="font-mono text-[11px] text-subtle-foreground">
                            {timeAgo(publication.created_at)}
                          </p>
                          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                            {sender}
                          </p>
                        </div>
                        <div className="ticket-out animate-send p-3 text-left">
                          <p className="line-clamp-2 text-sm text-foreground">
                            {publicationPreview(publication)}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                            {publication.destination_id &&
                            destinationId.has(publication.destination_id) ? (
                              <span className="text-[11px] text-muted-foreground">
                                {destinationName.get(publication.destination_id)}
                              </span>
                            ) : null}
                            <StatusPill tone={entityTone(publication.status)}>
                              {PUBLICATION_STATUS_LABEL[publication.status]}
                            </StatusPill>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            ) : null}
          </>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="panel p-5 animate-rise xl:col-span-2">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold tracking-tight">
                Fluxo de envio
              </h2>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-chart-1" /> Publicadas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-chart-5" /> Falhas
              </span>
              <span className="hidden font-mono sm:inline">últimos 14 dias</span>
            </div>
          </header>

          {chartData.every((point) => point.published === 0 && point.failed === 0) ? (
            <div className="grid h-56 place-items-center">
              <EmptyState
                icon={Megaphone}
                title="Sem publicações ainda"
                description="Assim que as primeiras ofertas forem enviadas, o histórico aparece aqui."
              />
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pubGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="failGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-chart-5)" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="var(--color-chart-5)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="var(--color-border)"
                    strokeOpacity={0.5}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    stroke="var(--color-subtle-foreground)"
                    fontSize={11}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={28}
                    stroke="var(--color-subtle-foreground)"
                    fontSize={11}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--color-border)", strokeDasharray: "3 3" }}
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "var(--radius-lg)",
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "var(--color-subtle-foreground)", fontWeight: 600 }}
                    itemStyle={{ padding: 0, paddingTop: 2 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="published"
                    name="Publicadas"
                    stackId="1"
                    stroke="var(--color-chart-1)"
                    strokeWidth={2}
                    fill="url(#pubGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="failed"
                    name="Falhas"
                    stackId="1"
                    stroke="var(--color-chart-5)"
                    strokeWidth={1.5}
                    fill="url(#failGrad)"
                  />
                  {avgPublished > 0 ? (
                    <ReferenceLine
                      y={avgPublished}
                      stroke="var(--color-subtle-foreground)"
                      strokeDasharray="4 5"
                      strokeOpacity={0.6}
                    />
                  ) : null}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="panel p-5 animate-rise">
          <header className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold tracking-tight">
              Saúde da operação
            </h2>
            <HeartPulse className="size-4 text-success" />
          </header>

          {successRate === null ? (
            <div className="grid h-56 place-items-center">
              <EmptyState
                icon={Activity}
                title="Aguardando dados"
                description="Sem envios concluídos para calcular a taxa de sucesso."
              />
            </div>
          ) : (
            <>
              <div>
                <div className="flex items-end justify-between gap-3">
                  <p className="font-mono text-[2rem] font-semibold leading-none tabular-nums">
                    {successRate}%
                  </p>
                  <p className="mb-0.5 text-right text-xs text-muted-foreground">
                    de envios concluídos com sucesso
                  </p>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-success animate-grow-x"
                    style={{ width: `${successRate}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
                  <p className="text-[11px] text-muted-foreground">Na fila</p>
                  <p className="font-mono text-lg font-semibold tabular-nums text-warning">
                    {pendingCount}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
                  <p className="text-[11px] text-muted-foreground">Falhas</p>
                  <p className="font-mono text-lg font-semibold tabular-nums text-destructive">
                    {failedList.length}
                  </p>
                </div>
              </div>

              {failedList.length > 0 ? (
                <div className="mt-4 space-y-3 border-t border-border pt-4">
                  <p className="text-xs font-medium text-muted-foreground">Falhas recentes</p>
                  <ul className="space-y-2.5">
                    {failedList.map((publication) => (
                      <li key={publication.id} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs text-foreground">
                            {publication.error_message ?? "Falha na publicação"}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {timeAgo(publication.created_at)}
                          </p>
                        </div>
                        <StatusPill tone="danger">Falhou</StatusPill>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="mt-4 border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground">
                    Nenhuma falha recente. Operação saudável.
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <AssistantChat
        context={buildContext(
          (offers.data ?? []).length,
          activeAutomations,
          publishedCount,
          pendingCount,
          successRate,
        )}
      />
    </div>
  );
}

function buildDayKeys() {
  const keys: string[] = [];
  const labels: string[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 13);
  for (let index = 0; index < 14; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    keys.push(date.toISOString().slice(0, 10));
    labels.push(date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }));
  }
  return { keys, labels };
}

function buildPublicationSeries(publications: Publication[]) {
  const { keys, labels } = buildDayKeys();
  const aggregate = new Map<string, { published: number; failed: number }>();
  for (const publication of publications) {
    const key = publication.created_at.slice(0, 10);
    const point = aggregate.get(key) ?? { published: 0, failed: 0 };
    if (publication.status === "published") point.published += 1;
    else if (publication.status === "failed") point.failed += 1;
    aggregate.set(key, point);
  }
  return keys.map((key, index) => {
    const point = aggregate.get(key) ?? { published: 0, failed: 0 };
    return { label: labels[index], ...point };
  });
}

function buildContext(
  offersCount: number,
  activeAutomations: number,
  publishedCount: number,
  pendingCount: number,
  successRate: number | null,
) {
  const rate = successRate === null ? "sem dados" : `${successRate}%`;
  return [
    `Ofertas capturadas: ${offersCount}`,
    `Automações ativas: ${activeAutomations}`,
    `Publicações enviadas: ${publishedCount}`,
    `Na fila de envio: ${pendingCount}`,
    `Taxa de sucesso: ${rate}`,
  ].join("\n");
}

function publicationPreview(publication: Publication): string {
  const firstLine = (publication.content ?? "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return "Publicação sem conteúdo";
  return firstLine;
}
