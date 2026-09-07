import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, ImageIcon, Loader2, ShoppingBag, Tags, UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { DataState } from "@/components/common/DataState";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusPill, entityTone } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCapture } from "@/hooks/useCapture";
import { offersService } from "@/services/offers";
import { OFFER_STATUSES, OFFER_STATUS_LABEL, type Offer } from "@/types";

export const Route = createFileRoute("/_authenticated/ofertas")({
  head: () => ({
    meta: [
      { title: "Ofertas — Affiliate Hub" },
      {
        name: "description",
        content: "Ofertas capturadas, processadas e prontas para publicação.",
      },
      { property: "og:title", content: "Ofertas — Affiliate Hub" },
      {
        property: "og:description",
        content: "Ofertas capturadas, processadas e prontas para publicação.",
      },
    ],
  }),
  component: OffersPage,
});

function OffersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const queryClient = useQueryClient();
  const { running, run } = useCapture();

  const query = useQuery({
    queryKey: ["offers", search, status],
    queryFn: () =>
      offersService.listWithRelations({
        search,
        ...(status !== "all" ? { status } : {}),
      }),
  });

  return (
    <>
      <PageHeader
        eyebrow="Principal"
        title="Ofertas"
        description="Todas as ofertas capturadas pelas suas fontes e automações."
        actions={
          <Button
            size="sm"
            variant="outline"
            disabled={running}
            onClick={async () => {
              const report = await run();
              if (report) {
                queryClient.invalidateQueries({ queryKey: ["offers"] });
                queryClient.invalidateQueries({ queryKey: ["monitors"] });
                queryClient.invalidateQueries({ queryKey: ["offer-counts"] });
              }
            }}
          >
            {running ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <UploadCloud className="mr-1.5 size-4" />
            )}
            {running ? "Capturando..." : "Capturar agora"}
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Buscar por título"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {OFFER_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {OFFER_STATUS_LABEL[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={(query.data ?? []).length === 0}
        empty={
          <EmptyState
            icon={Tags}
            title="Nenhuma oferta encontrada"
            description="As ofertas capturadas pelas automações aparecerão aqui."
          />
        }
      >
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Imagem & Oferta</th>
                <th className="px-4 py-2 font-medium">Preço</th>
                <th className="px-4 py-2 font-medium">Desconto</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Capturada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(query.data ?? []).map((offer) => (
                <tr
                  key={offer.id}
                  onClick={() => setSelectedOffer(offer)}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                >
                  <td className="max-w-md px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40 flex items-center justify-center">
                        {offer.image_url ? (
                          <img
                            src={offer.image_url}
                            alt={offer.title}
                            className="size-full object-cover transition-transform duration-200 hover:scale-105"
                          />
                        ) : (
                          <ShoppingBag className="size-5 text-muted-foreground/60" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground hover:text-primary">
                          {offer.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {offer.coupon ? (
                            <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                              Cupom: {offer.coupon}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums font-semibold">
                    {money(offer.sale_price)}
                    {offer.original_price && offer.original_price > (offer.sale_price ?? 0) ? (
                      <span className="block text-[11px] text-muted-foreground line-through font-normal">
                        {money(offer.original_price)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {offer.discount_percentage ? (
                      <Badge variant="secondary" className="font-bold text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        {offer.discount_percentage}% OFF
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusPill tone={entityTone(offer.status)}>
                      {OFFER_STATUS_LABEL[offer.status]}
                    </StatusPill>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {new Date(offer.captured_at).toLocaleString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>

      {/* Modal de Detalhes e Pré-visualização da Oferta com Imagem Ampliada */}
      <Dialog open={selectedOffer !== null} onOpenChange={(open) => !open && setSelectedOffer(null)}>
        {selectedOffer && (
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-base font-bold leading-snug pr-6">
                {selectedOffer.title}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="relative aspect-square w-full max-w-[280px] mx-auto overflow-hidden rounded-xl border border-border bg-muted/30 flex items-center justify-center p-2 shadow-inner">
                {selectedOffer.image_url ? (
                  <img
                    src={selectedOffer.image_url}
                    alt={selectedOffer.title}
                    className="max-h-full max-w-full object-contain drop-shadow-md"
                  />
                ) : (
                  <div className="text-center text-muted-foreground space-y-1">
                    <ImageIcon className="mx-auto size-10 text-muted-foreground/40" />
                    <p className="text-xs">Sem imagem disponível</p>
                  </div>
                )}
                {selectedOffer.discount_percentage ? (
                  <Badge className="absolute top-2 right-2 bg-amber-500 text-slate-950 font-black text-xs">
                    {selectedOffer.discount_percentage}% OFF
                  </Badge>
                ) : null}
              </div>

              <div className="rounded-lg border border-border bg-secondary/40 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Preço promocional:</span>
                  <span className="text-base font-black text-primary tabular-nums">
                    {money(selectedOffer.sale_price)}
                  </span>
                </div>

                {selectedOffer.original_price ? (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Preço original:</span>
                    <span className="line-through tabular-nums text-muted-foreground">
                      {money(selectedOffer.original_price)}
                    </span>
                  </div>
                ) : null}

                {selectedOffer.coupon ? (
                  <div className="flex items-center justify-between pt-1 border-t border-border/50">
                    <span className="text-muted-foreground font-semibold">Cupom de Desconto:</span>
                    <Badge variant="outline" className="font-mono text-xs uppercase font-bold text-amber-500">
                      {selectedOffer.coupon}
                    </Badge>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {(selectedOffer.affiliate_url || selectedOffer.original_url) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5"
                    asChild
                  >
                    <a
                      href={selectedOffer.affiliate_url || selectedOffer.original_url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-3.5" />
                      Abrir link do produto
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

function money(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
