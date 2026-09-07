import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Bot,
  HeartPulse,
  Link2,
  Megaphone,
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
import { LiveBadge, StatCard, formatPrice, timeAgo } from "@/components/common/stat-card";
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
  const offersSeries = buildCountSeries((offers.data ?? []).map((offer) => offer.created_at));
  const publishedSeries = chartData.map((point) => point.published);
  const avgPublished =
    chartData.reduce((sum, point) => sum + point.published, 0) / Math.max(chartData.length, 1);

  const destinationName = new Map(
    (destinations.data ?? []).map((destination) => [destination.id, destination.name]),
  );
  const marketplaceName = new Map(
    (marketplaces.data ?? []).map((marketplace) => [marketplace.id, marketplace.name]),
  );

  const quickActions = [
    { label: "Nova oferta", icon: Plus, to: "/ofertas" },
    { label: "Criar automação", icon: Bot, to: "/automacoes" },
    { label: "Gerar link", icon: Link2, to: "/links" },
    { label: "Ver publicações", icon: Send, to: "/publicacoes" },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Principal"
        title="Dashboard"
        description="Panorama das capturas, automações e publicações da sua operação."
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

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="panel h-[132px] animate-pulse p-4" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={ShoppingBag}
              label="Ofertas capturadas"
              value={(offers.data ?? []).length}
              hint="Últimas capturas registradas"
              accent="text-chart-3 bg-chart-3/10 border-chart-3/20"
              spark={offersSeries}
              sparkColor="var(--color-chart-3)"
              delta={splitTrend(offersSeries)}
              delay={0}
            />
            <StatCard
              icon={Workflow}
              label="Automações ativas"
              value={activeAutomations}
              hint={`${automations.data?.length ?? 0} no total`}
              accent="text-chart-2 bg-chart-2/10 border-chart-2/20"
              delay={40}
            />
            <StatCard
              icon={Megaphone}
              label="Publicações enviadas"
              value={publishedCount}
              hint="Histórico recente"
              accent="text-chart-1 bg-chart-1/10 border-chart-1/20"
              spark={publishedSeries}
              sparkColor="var(--color-chart-1)"
              delta={splitTrend(publishedSeries)}
              delay={80}
            />
            <StatCard
              icon={Activity}
              label="Na fila de envio"
              value={pendingCount}
              hint="Aguardando publicação"
              accent="text-warning bg-warning/10 border-warning/20"
              delay={120}
            />
          </div>

          <div className="animate-rise" style={{ animationDelay: "130ms" }}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-eyebrow">Ações rápidas</p>
              <p className="text-xs text-subtle-foreground">Atalhos para as rotinas mais comuns</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  to={action.to}
                  className="group flex min-h-16 items-center justify-between gap-3 rounded-xl border border-border bg-secondary/50 p-3 transition-colors hover:border-primary/25 hover:bg-secondary"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-background text-muted-foreground">
                      <action.icon className="size-4" />
                    </span>
                    <span className="text-[13px] font-medium">{action.label}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-subtle-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <section
              className="panel p-5 animate-rise xl:col-span-2"
              style={{ animationDelay: "140ms" }}
            >
              <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-eyebrow">Fluxo de envio</p>
                  <h2 className="mt-0.5 text-sm font-semibold">Publicações</h2>
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

            <section className="panel p-5 animate-rise" style={{ animationDelay: "180ms" }}>
              <header className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Saúde da operação</h2>
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
                          <li
                            key={publication.id}
                            className="flex items-start justify-between gap-3"
                          >
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

          <div className="grid gap-4 xl:grid-cols-3">
            <section
              className="panel p-5 animate-rise xl:col-span-2"
              style={{ animationDelay: "220ms" }}
            >
              <header className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Últimas ofertas</h2>
                <Link
                  to="/ofertas"
                  className="text-xs font-medium text-primary transition-colors hover:text-primary/80"
                >
                  Ver todas
                </Link>
              </header>

              {(offers.data ?? []).length === 0 ? (
                <EmptyState
                  icon={Tags}
                  title="Nenhuma oferta ainda"
                  description="Assim que as capturas começarem, encontram espaço aqui."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {(offers.data ?? []).slice(0, 6).map((offer) => (
                    <li
                      key={offer.id}
                      className="flex items-center gap-3 rounded-lg py-2.5 transition-colors hover:bg-secondary/40"
                    >
                      <div className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted/30">
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
                        <p className="truncate text-sm font-medium text-foreground">
                          {offer.title}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          {offer.marketplace_id && marketplaceName.has(offer.marketplace_id) ? (
                            <span className="truncate">
                              {marketplaceName.get(offer.marketplace_id)}
                            </span>
                          ) : null}
                          {offer.marketplace_id && marketplaceName.has(offer.marketplace_id) ? (
                            <span className="text-subtle-foreground">·</span>
                          ) : null}
                          <span>{timeAgo(offer.created_at)}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {offer.discount_percentage && offer.discount_percentage > 0 ? (
                          <span className="rounded-md bg-chart-3/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-chart-3 border border-chart-3/20">
                            -{Math.round(offer.discount_percentage)}%
                          </span>
                        ) : null}
                        <div className="w-24 text-right">
                          <p className="truncate font-mono text-sm font-semibold tabular-nums text-foreground">
                            {formatPrice(offer.sale_price ?? offer.original_price, offer.currency)}
                          </p>
                          {offer.original_price &&
                          offer.sale_price &&
                          offer.original_price > offer.sale_price ? (
                            <p className="text-[11px] text-subtle-foreground line-through">
                              {formatPrice(offer.original_price, offer.currency)}
                            </p>
                          ) : null}
                        </div>
                        <StatusPill tone={entityTone(offer.status)}>
                          {OFFER_STATUS_LABEL[offer.status]}
                        </StatusPill>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel p-5 animate-rise" style={{ animationDelay: "260ms" }}>
              <header className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Últimas publicações</h2>
                <Link
                  to="/publicacoes"
                  className="text-xs font-medium text-primary transition-colors hover:text-primary/80"
                >
                  Ver todas
                </Link>
              </header>

              {loadedPublications.length === 0 ? (
                <EmptyState
                  icon={Megaphone}
                  title="Nada publicado ainda"
                  description="Os despachos realizados para os seus destinos aparecem aqui."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {loadedPublications.slice(0, 5).map((publication) => (
                    <li
                      key={publication.id}
                      className="flex items-start justify-between gap-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-xs text-foreground">
                          {publicationPreview(publication)}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {publication.destination_id &&
                          destinationName.has(publication.destination_id) ? (
                            <span className="inline-flex items-center gap-1.5">
                              {destinationName.get(publication.destination_id) ?? "Destino"}
                              <span className="text-subtle-foreground">·</span>
                            </span>
                          ) : null}
                          {timeAgo(publication.created_at)}
                        </p>
                      </div>
                      <StatusPill tone={entityTone(publication.status)}>
                        {PUBLICATION_STATUS_LABEL[publication.status]}
                      </StatusPill>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
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

function buildCountSeries(dates: string[]): number[] {
  const { keys } = buildDayKeys();
  const counts = new Map(keys.map((key) => [key, 0]));
  for (const value of dates) {
    const key = value.slice(0, 10);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return keys.map((key) => counts.get(key) ?? 0);
}

function buildPublicationSeries(publications: Publication[]) {
  const { keys, labels } = buildDayKeys();
  const aggregate = new Map<string, { published: number; failed: number; pending: number }>();
  for (const publication of publications) {
    const key = publication.created_at.slice(0, 10);
    const point = aggregate.get(key) ?? { published: 0, failed: 0, pending: 0 };
    if (publication.status === "published") point.published += 1;
    else if (publication.status === "failed") point.failed += 1;
    else point.pending += 1;
    aggregate.set(key, point);
  }
  return keys.map((key, index) => {
    const point = aggregate.get(key) ?? { published: 0, failed: 0, pending: 0 };
    return { label: labels[index], ...point };
  });
}

function splitTrend(series: number[]) {
  const previous = series.slice(0, 7).reduce((sum, value) => sum + value, 0);
  const current = series.slice(7).reduce((sum, value) => sum + value, 0);
  return { current, previous };
}

function publicationPreview(publication: Publication): string {
  const firstLine = (publication.content ?? "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return "Publicação sem conteúdo";
  return firstLine;
}
