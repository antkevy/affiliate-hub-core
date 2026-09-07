import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, Megaphone, ShoppingBag, Tags, Workflow } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusPill, entityTone } from "@/components/common/StatusPill";
import { offersService } from "@/services/offers";
import { automationsService } from "@/services/automations";
import { publicationsService } from "@/services/publications";
import { OFFER_STATUS_LABEL } from "@/types";

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

  const activeAutomations = (automations.data ?? []).filter((a) => a.status === "active").length;
  const publishedCount = (publications.data ?? []).filter((p) => p.status === "published").length;

  const chartData = buildChart(publications.data?.map((p) => p.created_at) ?? []);

  return (
    <>
      <PageHeader
        eyebrow="Principal"
        title="Dashboard"
        description="Panorama das capturas, automações e publicações da sua operação."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={Tags}
          label="Ofertas capturadas"
          value={offers.data?.length ?? 0}
          hint="Últimas capturas registradas"
        />
        <Kpi
          icon={Workflow}
          label="Automações ativas"
          value={activeAutomations}
          hint={`${automations.data?.length ?? 0} no total`}
        />
        <Kpi
          icon={Megaphone}
          label="Publicações enviadas"
          value={publishedCount}
          hint="Histórico recente"
        />
        <Kpi
          icon={Activity}
          label="Fila de processamento"
          value={(publications.data ?? []).filter((p) => p.status === "pending").length}
          hint="Aguardando envio"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <section className="panel p-5 xl:col-span-2">
          <p className="text-eyebrow mb-4">Publicações por dia</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="pubs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={24}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--color-primary)"
                  fill="url(#pubs)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel p-5">
          <p className="text-eyebrow mb-4">Atividade recente</p>
          {(offers.data ?? []).length === 0 ? (
            <EmptyState
              icon={Tags}
              title="Nenhuma atividade ainda"
              description="Assim que as capturas começarem, elas aparecem aqui."
            />
          ) : (
            <ul className="space-y-3">
              {(offers.data ?? []).slice(0, 6).map((offer) => (
                <li key={offer.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/30 flex items-center justify-center">
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
                      <p className="truncate text-sm font-medium text-foreground">{offer.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(offer.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <StatusPill tone={entityTone(offer.status)}>
                    {OFFER_STATUS_LABEL[offer.status]}
                  </StatusPill>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Tags;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <p className="text-eyebrow">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function buildChart(dates: string[]) {
  const days = Array.from({ length: 14 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - index));
    return date;
  });

  return days.map((date) => {
    const key = date.toISOString().slice(0, 10);
    return {
      label: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      total: dates.filter((value) => value.slice(0, 10) === key).length,
    };
  });
}
