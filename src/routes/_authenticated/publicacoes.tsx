import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { DataState } from "@/components/common/DataState";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusPill, entityTone } from "@/components/common/StatusPill";
import { timeAgo } from "@/components/common/stat-card";
import { publicationsService } from "@/services/publications";
import { PUBLICATION_STATUS_LABEL, type PublicationStatus } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/publicacoes")({
  head: () => ({
    meta: [
      { title: "Publicações — Affiliate Hub" },
      { name: "description", content: "Histórico de publicações enviadas aos seus destinos." },
      { property: "og:title", content: "Publicações — Affiliate Hub" },
      {
        property: "og:description",
        content: "Histórico de publicações enviadas aos seus destinos.",
      },
    ],
  }),
  component: PublicationsPage,
});

function statusIconTone(status: PublicationStatus) {
  if (status === "published") return "border-success/20 bg-success/10 text-success";
  if (status === "failed") return "border-destructive/20 bg-destructive/10 text-destructive";
  return "border-border bg-secondary/60 text-muted-foreground";
}

function firstLine(content: string | null): string {
  if (!content) return "Publicação sem conteúdo";
  const line = content
    .split("\n")
    .map((part) => part.trim())
    .find((part) => part.length > 0);
  return line ?? "Publicação sem conteúdo";
}

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
        <ul className="panel divide-y divide-border animate-rise" style={{ animationDelay: "0ms" }}>
          {(query.data ?? []).map((publication) => (
            <li
              key={publication.id}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/40"
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-lg border",
                  statusIconTone(publication.status),
                )}
              >
                <Megaphone className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{firstLine(publication.content)}</p>
                <p
                  className="mt-0.5 text-xs text-muted-foreground"
                  title={
                    publication.published_at
                      ? new Date(publication.published_at).toLocaleString("pt-BR")
                      : new Date(publication.created_at).toLocaleString("pt-BR")
                  }
                >
                  {publication.published_at
                    ? `Publicada ${timeAgo(publication.published_at)}`
                    : `Criada ${timeAgo(publication.created_at)}`}
                </p>
                {publication.status === "failed" && publication.error_message ? (
                  <p className="mt-1 line-clamp-2 text-xs text-destructive">
                    {publication.error_message}
                  </p>
                ) : null}
              </div>
              <StatusPill tone={entityTone(publication.status)}>
                <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current align-middle" />
                {PUBLICATION_STATUS_LABEL[publication.status]}
              </StatusPill>
            </li>
          ))}
        </ul>
      </DataState>
    </>
  );
}
