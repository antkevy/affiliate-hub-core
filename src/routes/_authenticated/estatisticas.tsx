import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Send, Tags } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/common/PageHeader";
import { DataState } from "@/components/common/DataState";
import { StatCard } from "@/components/common/stat-card";
import { offersService } from "@/services/offers";
import { publicationsService } from "@/services/publications";
import { OFFER_STATUSES, OFFER_STATUS_LABEL, PUBLICATION_STATUS_LABEL } from "@/types";

export const Route = createFileRoute("/_authenticated/estatisticas")({
  head: () => ({
    meta: [
      { title: "Estatísticas — Affiliate Hub" },
      { name: "description", content: "Indicadores de ofertas capturadas e publicações." },
      { property: "og:title", content: "Estatísticas — Affiliate Hub" },
      { property: "og:description", content: "Indicadores de ofertas capturadas e publicações." },
    ],
  }),
  component: StatsPage,
});

const PIE_COLORS = [
  "var(--color-primary)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function StatsPage() {
  const offers = useQuery({ queryKey: ["offers", "stats"], queryFn: () => offersService.list() });
  const publications = useQuery({
    queryKey: ["publications", "stats"],
    queryFn: () => publicationsService.list(),
  });

  const offersByStatus = OFFER_STATUSES.map((status) => ({
    name: OFFER_STATUS_LABEL[status],
    total: (offers.data ?? []).filter((offer) => offer.status === status).length,
  })).filter((item) => item.total > 0);

  const publicationsByStatus = Object.entries(PUBLICATION_STATUS_LABEL)
    .map(([status, label]) => ({
      name: label,
      total: (publications.data ?? []).filter((item) => item.status === status).length,
    }))
    .filter((item) => item.total > 0);

  const totalOffers = (offers.data ?? []).length;
  const totalPublications = (publications.data ?? []).length;
  const publishedCount = (publications.data ?? []).filter(
    (item) => item.status === "published",
  ).length;

  return (
    <>
      <PageHeader
        eyebrow="Relatórios"
        title="Estatísticas"
        description="Visão consolidada das ofertas capturadas e publicações realizadas."
      />

      {offers.isLoading || publications.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="panel h-[116px] animate-pulse p-4" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            icon={Tags}
            label="Total de ofertas"
            value={totalOffers}
            hint="Ofertas capturadas"
            accent="text-chart-3 bg-chart-3/10 border-chart-3/20"
            delay={0}
          />
          <StatCard
            icon={Send}
            label="Total de publicações"
            value={totalPublications}
            hint="Enviadas e na fila"
            accent="text-chart-1 bg-chart-1/10 border-chart-1/20"
            delay={40}
          />
          <StatCard
            icon={BarChart3}
            label="Publicações publicadas"
            value={publishedCount}
            hint="Enviadas com sucesso"
            accent="text-success bg-success/10 border-success/20"
            delay={80}
          />
        </div>
      )}

      <DataState isLoading={false} error={offers.error}>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="panel p-5 animate-rise" style={{ animationDelay: "120ms" }}>
            <p className="text-eyebrow mb-4">Ofertas por status</p>
            {offersByStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados suficientes.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={offersByStatus}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      stroke="var(--color-muted-foreground)"
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                      stroke="var(--color-muted-foreground)"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="total" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="panel p-5 animate-rise" style={{ animationDelay: "180ms" }}>
            <p className="text-eyebrow mb-4">Publicações por status</p>
            {publicationsByStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados suficientes.</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={publicationsByStatus}
                      dataKey="total"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {publicationsByStatus.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </DataState>
    </>
  );
}
