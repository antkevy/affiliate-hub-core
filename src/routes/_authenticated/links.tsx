import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataState } from "@/components/common/DataState";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusPill, entityTone } from "@/components/common/StatusPill";
import { CreateEntityDialog } from "@/components/common/CreateEntityDialog";
import { Button } from "@/components/ui/button";
import { affiliateLinksService, listMarketplaces } from "@/services/affiliate";
import { toUserMessage } from "@/services/base";
import { LINK_STATUS_LABEL, type AffiliateLink } from "@/types";

export const Route = createFileRoute("/_authenticated/links")({
  head: () => ({
    meta: [
      { title: "Links de Afiliado — Affiliate Hub" },
      { name: "description", content: "Links originais e suas versões de afiliado." },
      { property: "og:title", content: "Links de Afiliado — Affiliate Hub" },
      { property: "og:description", content: "Links originais e suas versões de afiliado." },
    ],
  }),
  component: LinksPage,
});

function LinksPage() {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState<string | null>(null);
  const links = useQuery({
    queryKey: ["affiliate-links"],
    queryFn: () => affiliateLinksService.list(),
  });
  const marketplaces = useQuery({ queryKey: ["marketplaces"], queryFn: listMarketplaces });

  async function handleGenerate(link: AffiliateLink) {
    setGenerating(link.id);
    try {
      await affiliateLinksService.generate(link.id);
      toast.success("Link de afiliado gerado.");
      await queryClient.invalidateQueries({ queryKey: ["affiliate-links"] });
    } catch (error) {
      toast.error("Não foi possível gerar o link", { description: toUserMessage(error) });
    } finally {
      setGenerating(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Afiliados"
        title="Links de Afiliado"
        description="Converta URLs originais em links de afiliado automaticamente."
        actions={
          <CreateEntityDialog
            title="Novo link"
            fields={[
              {
                key: "original_url",
                label: "URL original",
                required: true,
                placeholder: "https://...",
              },
              {
                key: "marketplace_id",
                label: "Marketplace",
                type: "select",
                options: (marketplaces.data ?? []).map((item) => ({
                  value: item.id,
                  label: item.name,
                })),
              },
            ]}
            onSubmit={(get) =>
              affiliateLinksService.create({
                original_url: get("original_url"),
                marketplace_id: get("marketplace_id") || null,
              })
            }
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ["affiliate-links"] })}
          />
        }
      />

      <DataState
        isLoading={links.isLoading}
        error={links.error}
        isEmpty={(links.data ?? []).length === 0}
        empty={
          <EmptyState
            icon={Link2}
            title="Nenhum link cadastrado"
            description="Adicione uma URL para acompanhar sua conversão em link de afiliado."
          />
        }
      >
        <div className="panel divide-y divide-border">
          {(links.data ?? []).map((link) => (
            <div
              key={link.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{link.original_url}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {link.affiliate_url ?? "Link de afiliado ainda não gerado"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill tone={entityTone(link.status)}>
                  {LINK_STATUS_LABEL[link.status]}
                </StatusPill>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={generating === link.id}
                  onClick={() => handleGenerate(link)}
                >
                  {generating === link.id ? "Gerando..." : "Gerar"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DataState>
    </>
  );
}
