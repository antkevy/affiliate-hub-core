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

function statusMarker(status: PublicationStatus): string {
  switch (status) {
    case "published":
      return "ENVIADA";
    case "failed":
      return "FALHOU";
    case "processing":
      return "PROCESSANDO";
    case "pending":
      return "NA FILA";
    default:
      return status.toUpperCase();
  }
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
    <div className="space-y-6">
      <PageHeader
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
        <ul className="space-y-4 animate-rise" style={{ animationDelay: "0ms" }}>
          {(query.data ?? []).map((publication, index) => (
            <li
              key={publication.id}
              className="flex justify-end"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <div className="w-full min-w-0 max-w-[34rem]">
                <div className="mb-1 flex items-center justify-end gap-3 px-0.5">
                  <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    [{statusMarker(publication.status)}]{" "}
                    {publication.published_at
                      ? `· ${timeAgo(publication.published_at)}`
                      : `· ${timeAgo(publication.created_at)}`}
                  </p>
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-md border",
                      statusIconTone(publication.status),
                    )}
                  >
                    <Megaphone className="size-3" />
                  </span>
                </div>
                <div
                  className={cn(
                    "w-fit max-w-full rounded-2xl rounded-br-md border p-3.5",
                    publication.status === "failed"
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-border bg-card shadow-card",
                  )}
                >
                  <p className="line-clamp-3 text-sm text-foreground">
                    {firstLine(publication.content)}
                  </p>
                  {publication.status === "failed" && publication.error_message ? (
                    <p className="mt-1.5 text-xs text-destructive">{publication.error_message}</p>
                  ) : null}
                  <div className="mt-2.5 flex justify-end">
                    <StatusPill tone={entityTone(publication.status)}>
                      <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current align-middle" />
                      {PUBLICATION_STATUS_LABEL[publication.status]}
                    </StatusPill>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </DataState>
    </div>
  );
}
