import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { DataState } from "@/components/common/DataState";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusPill, entityTone } from "@/components/common/StatusPill";
import { publicationsService } from "@/services/publications";
import { PUBLICATION_STATUS_LABEL } from "@/types";

export const Route = createFileRoute("/_authenticated/publicacoes")({
  head: () => ({
    meta: [
      { title: "Publicações — Affiliate Hub" },
      { name: "description", content: "Histórico de publicações enviadas aos seus destinos." },
      { property: "og:title", content: "Publicações — Affiliate Hub" },
      { property: "og:description", content: "Histórico de publicações enviadas aos seus destinos." },
    ],
  }),
  component: PublicationsPage,
});

function PublicationsPage() {
  const query = useQuery({
    queryKey: ["publications"],
    queryFn: () => publicationsService.list({ orderBy: "created_at", ascending: false }),
  });

  return (
    <>
      <PageHeader
        eyebrow="Relatórios"
        title="Publicações"
        description="Registro de todas as publicações e seus resultados."
      />

      <DataState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={(query.data ?? []).length === 0}
        empty={
          <EmptyState
            icon={Megaphone}
            title="Nenhuma publicação registrada"
            description="Quando as automações publicarem ofertas, o histórico aparecerá aqui."
          />
        }
      >
        <div className="panel divide-y divide-border">
          {(query.data ?? []).map((publication) => (
            <div
              key={publication.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">
                  {publication.content?.slice(0, 80) ?? "Publicação sem conteúdo"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {publication.published_at
                    ? new Date(publication.published_at).toLocaleString("pt-BR")
                    : `Criada em ${new Date(publication.created_at).toLocaleString("pt-BR")}`}
                </p>
              </div>
              <StatusPill tone={entityTone(publication.status)}>
                {PUBLICATION_STATUS_LABEL[publication.status]}
              </StatusPill>
            </div>
          ))}
        </div>
      </DataState>
    </>
  );
}
