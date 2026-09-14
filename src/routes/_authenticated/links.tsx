import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Link2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataState } from "@/components/common/DataState";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusPill, entityTone } from "@/components/common/StatusPill";
import { StatCard, timeAgo } from "@/components/common/stat-card";
import { CreateEntityDialog } from "@/components/common/CreateEntityDialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

  function copyLink(url: string) {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado para a área de transferência!");
  }

  const marketplaceName = new Map((marketplaces.data ?? []).map((item) => [item.id, item.name]));
  const linkList = links.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Link2}
          label="Total de links"
          value={linkList.length}
          hint="URLs de afiliado cadastradas"
          accent="text-chart-1 bg-chart-1/10 border-chart-1/20"
          delay={0}
        />
      </div>

      <DataState
        isLoading={links.isLoading}
        error={links.error}
        isEmpty={linkList.length === 0}
        empty={
          <EmptyState
            icon={Link2}
            title="Nenhum link cadastrado"
            description="Adicione uma URL para acompanhar sua conversão em link de afiliado."
          />
        }
      >
        <div className="panel overflow-x-auto animate-rise" style={{ animationDelay: "60ms" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5">Link original</th>
                <th className="px-4 py-2.5">Link de afiliado</th>
                <th className="px-4 py-2.5">Marketplace</th>
                <th className="px-4 py-2.5">Criado em</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {linkList.map((link) => (
                <tr key={link.id} className="group transition-colors hover:bg-secondary/40">
                  <td className="max-w-[16rem] px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-secondary/60 text-muted-foreground">
                        <Link2 className="size-3.5" />
                      </span>
                      <p className="truncate text-foreground" title={link.original_url}>
                        {link.original_url}
                      </p>
                    </div>
                  </td>
                  <td className="max-w-[16rem] px-4 py-3">
                    {link.affiliate_url ? (
                      <div className="flex items-center gap-1.5">
                        <p
                          className="truncate font-mono text-xs text-muted-foreground"
                          title={link.affiliate_url}
                        >
                          {link.affiliate_url}
                        </p>
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="size-7 px-0 text-chart-3 hover:bg-chart-3/10 hover:text-chart-3"
                                aria-label="Copiar link de afiliado"
                                onClick={() => copyLink(link.affiliate_url as string)}
                              >
                                <Copy className="size-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copiar</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {link.affiliate_url ? (
                          <a
                            href={link.affiliate_url}
                            target="_blank"
                            rel="noreferrer"
                            className="size-7 grid shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                            aria-label="Abrir link de afiliado"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Ainda não gerado</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground">
                      {link.marketplace_id && marketplaceName.has(link.marketplace_id)
                        ? marketplaceName.get(link.marketplace_id)
                        : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="text-xs text-muted-foreground"
                      title={new Date(link.created_at).toLocaleString("pt-BR")}
                    >
                      {timeAgo(link.created_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={entityTone(link.status)}>
                      <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current align-middle" />
                      {LINK_STATUS_LABEL[link.status]}
                    </StatusPill>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={generating === link.id}
                      onClick={() => handleGenerate(link)}
                    >
                      {generating === link.id ? "Gerando..." : "Gerar"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>
    </div>
  );
}
