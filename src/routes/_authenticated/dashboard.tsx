import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, HeartPulse, Link2, Megaphone, Plus, RefreshCw, ShoppingBag } from "lucide-react";
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

function PanelHeading({
  label,
  meta,
  active,
  children,
}: {
  label: string;
  meta?: React.ReactNode;
  active?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
      <h2 className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">
        {active ? <span className="size-1.5 rounded-full bg-primary" aria-hidden /> : null}
        {label}
      </h2>
      <div className="flex items-center gap-2">
        {meta ?? null}
        {children}
      </div>
    </header>
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

  const recentOffers = (offers.data ?? []).slice(0, 10);
  const recentPublications = loadedPublications.slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mesa"
        description="O ciclo do dia: entradas no tape e transmissões registradas."
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
            <Button variant="outline" size="sm" asChild>
              <Link to="/links">
                <Link2 className="size-4" />
                Gerar link
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/estatisticas">Ver estatísticas</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <section aria-label="Entradas — tape do dia" className="panel overflow-hidden">
          <PanelHeading
            label="Entradas"
            meta={
              <span className="font-mono text-[11px] tabular-nums text-subtle-foreground">
                {recentOffers.length} itens
              </span>
            }
            children={
              <Link
                to="/ofertas"
                className="font-mono text-[11px] uppercase tracking-[0.12em] text-primary hover:underline"
              >
                ver todas
              </Link>
            }
          />

          {isLoading ? (
            <ul className="divide-y divide-border">
              {[0, 1, 2, 3].map((item) => (
                <li key={item} className="flex items-center gap-3 px-4 py-3">
                  <div className="size-8 shrink-0 animate-pulse rounded-md bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
                    <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
                  </div>
                </li>
              ))}
            </ul>
          ) : recentOffers.length === 0 ? (
            <div className="grid h-44 place-items-center px-6 text-center">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-subtle-foreground">
                  Sem leituras
                </p>
                <p className="mt-1 text-sm text-foreground">Nenhuma oferta no tape ainda.</p>
                <Link
                  to="/fontes"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-primary/40 px-3.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
                >
                  <Plus className="size-3.5" />
                  Adicionar fonte
                </Link>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recentOffers.map((offer) => {
                const sender =
                  (offer.marketplace_id && marketplaceName.get(offer.marketplace_id)) || "Captura";
                const price = formatPrice(offer.sale_price ?? offer.original_price, offer.currency);
                const discount =
                  offer.discount_percentage && offer.discount_percentage > 0
                    ? Math.round(offer.discount_percentage)
                    : null;
                return (
                  <li
                    key={offer.id}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/40"
                  >
                    <SenderPlaque
                      id={`${offer.marketplace_id ?? "capture"}-${sender}`}
                      name={sender}
                      icon={ShoppingBag}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{offer.title}</p>
                      <p className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                        <span>{sender}</span>
                        <span className="text-subtle-foreground">·</span>
                        <span>{timeAgo(offer.created_at)}</span>
                        <span className="hidden sm:inline-flex">
                          <StatusPill tone={entityTone(offer.status)}>
                            {OFFER_STATUS_LABEL[offer.status]}
                          </StatusPill>
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                        {price}
                      </span>
                      {discount ? (
                        <span className="rounded border border-success/25 bg-success/10 px-1.5 font-mono text-[11px] font-semibold text-success">
                          -{discount}%
                        </span>
                      ) : (
                        <span className="font-mono text-[11px] text-subtle-foreground sm:hidden">
                          {OFFER_STATUS_LABEL[offer.status]}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-label="Saídas — transmissões" className="panel overflow-hidden">
          <PanelHeading
            label="Saídas"
            meta={
              <span className="font-mono text-[11px] tabular-nums text-subtle-foreground">
                {recentPublications.length} trans.
              </span>
            }
            children={
              <Link
                to="/publicacoes"
                className="font-mono text-[11px] uppercase tracking-[0.12em] text-primary hover:underline"
              >
                ver log
              </Link>
            }
          />

          {isLoading ? (
            <ul className="divide-y divide-border">
              {[0, 1, 2].map((item) => (
                <li key={item} className="space-y-2 px-4 py-3">
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                  <div className="h-3.5 w-4/5 animate-pulse rounded bg-muted" />
                </li>
              ))}
            </ul>
          ) : recentPublications.length === 0 ? (
            <div className="grid h-44 place-items-center px-6 text-center">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-subtle-foreground">
                  Sem transmissões
                </p>
                <p className="mt-1 text-sm text-foreground">
                  As publicações nos destinos aparecem aqui.
                </p>
                <Link
                  to="/publicacoes"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-primary/40 px-3.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
                >
                  Abrir publicações
                </Link>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recentPublications.map((publication) => {
                const sender = publication.destination_id
                  ? (destinationName.get(publication.destination_id) ?? "Destino")
                  : "Destino";
                return (
                  <li
                    key={publication.id}
                    className="px-4 py-3 transition-colors hover:bg-secondary/40"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                        {sender}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-subtle-foreground">
                        {timeAgo(publication.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-foreground">
                      {publicationPreview(publication)}
                    </p>
                    <div className="mt-1.5">
                      <StatusPill tone={entityTone(publication.status)}>
                        {PUBLICATION_STATUS_LABEL[publication.status]}
                      </StatusPill>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

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
