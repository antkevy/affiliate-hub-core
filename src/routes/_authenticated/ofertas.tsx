import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  ExternalLink,
  ImageIcon,
  Loader2,
  Percent,
  ShoppingBag,
  Tags,
  Ticket,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataState } from "@/components/common/DataState";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusPill, entityTone } from "@/components/common/StatusPill";
import { timeAgo } from "@/components/common/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCapture } from "@/hooks/useCapture";
import { offersService } from "@/services/offers";
import { toUserMessage } from "@/services/base";
import { OFFER_STATUSES, OFFER_STATUS_LABEL, type Offer } from "@/types";
import { cn } from "@/lib/utils";

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
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const queryClient = useQueryClient();
  const { running, run } = useCapture();

  function copyCoupon(code: string | null | undefined, event?: React.MouseEvent) {
    if (event) event.stopPropagation();
    if (!code) return;
    navigator.clipboard.writeText(code);
    toast.success(`Cupom "${code}" copiado para a área de transferência!`);
  }

  const query = useQuery({
    queryKey: ["offers", search, status],
    queryFn: () =>
      offersService.listWithRelations({
        search,
        ...(status !== "all" ? { status } : {}),
      }),
  });

  const offers = query.data ?? [];
  const withCoupon = offers.filter((offer) => offer.coupon).length;
  const discounts = offers
    .map((offer) => offer.discount_percentage)
    .filter((value): value is number => typeof value === "number");
  const avgDiscount =
    discounts.length > 0
      ? Math.round(discounts.reduce((sum, value) => sum + value, 0) / discounts.length)
      : 0;
  const pending = offers.filter((offer) =>
    ["captured", "processing", "processed", "approved"].includes(offer.status),
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ofertas"
        description="Todas as ofertas capturadas pelas suas fontes e automações."
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={clearing || offers.length === 0}
              onClick={() => setClearOpen(true)}
            >
              {clearing ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-1.5 size-4" />
              )}
              Limpar lista
            </Button>
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
          </div>
        }
      />

      <div className="stream flex flex-wrap items-center gap-1.5">
        <span className="pipeline-step">
          <ShoppingBag className="size-3.5" /> Todas ·{" "}
          <span className="font-mono tabular-nums">{offers.length}</span>
        </span>
        <span className="pipeline-step">
          <Ticket className="size-3.5" /> Com cupom ·{" "}
          <span className="font-mono tabular-nums">{withCoupon}</span>
        </span>
        <span className="pipeline-step">
          <Percent className="size-3.5" /> Desconto médio ·{" "}
          <span className="font-mono tabular-nums">{avgDiscount}%</span>
        </span>
        <span className="pipeline-step pipeline-step-live">
          <Tags className="size-3.5" /> Pendentes ·{" "}
          <span className="font-mono tabular-nums">{pending}</span>
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
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
        isEmpty={offers.length === 0}
        empty={
          <EmptyState
            icon={Tags}
            title="Nenhuma oferta encontrada"
            description="As ofertas capturadas pelas automações aparecerão aqui."
          />
        }
      >
        <div className="panel overflow-x-auto animate-rise" style={{ animationDelay: "160ms" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5">Imagem & Oferta</th>
                <th className="px-4 py-2.5">Preço</th>
                <th className="px-4 py-2.5">Desconto</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Capturada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {offers.map((offer) => (
                <tr
                  key={offer.id}
                  onClick={() => setSelectedOffer(offer)}
                  className="group cursor-pointer transition-colors hover:bg-secondary/40"
                >
                  <td className="max-w-md px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "relative size-12 shrink-0 overflow-hidden rounded-lg border",
                          offer.status === "error"
                            ? "border-destructive/30"
                            : offer.status === "published" || offer.status === "approved"
                              ? "border-success/30"
                              : "border-border",
                          "bg-muted/40",
                        )}
                      >
                        {offer.image_url ? (
                          <img
                            src={offer.image_url}
                            alt={offer.title}
                            className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center">
                            <ShoppingBag className="size-5 text-muted-foreground/60" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground group-hover:text-primary">
                          {offer.title}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2">
                          {offer.coupon ? (
                            <button
                              type="button"
                              onClick={(e) => copyCoupon(offer.coupon, e)}
                              className="inline-flex items-center gap-1 rounded border border-chart-3/30 bg-chart-3/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-chart-3 transition-colors hover:bg-chart-3/20"
                              title="Clique para copiar o cupom"
                            >
                              <span>Cupom: {offer.coupon}</span>
                              <Copy className="size-2.5" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold tabular-nums">
                    {money(offer.sale_price)}
                    {offer.original_price && offer.original_price > (offer.sale_price ?? 0) ? (
                      <span className="block text-[11px] font-normal text-muted-foreground line-through">
                        {money(offer.original_price)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums">
                    {offer.discount_percentage ? (
                      <Badge
                        variant="secondary"
                        className="border border-chart-3/30 bg-chart-3/10 text-xs font-bold text-chart-3"
                      >
                        {offer.discount_percentage}% OFF
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={entityTone(offer.status)}>
                      <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current align-middle" />
                      {OFFER_STATUS_LABEL[offer.status]}
                    </StatusPill>
                  </td>
                  <td
                    className="px-4 py-3 text-xs text-muted-foreground"
                    title={new Date(offer.captured_at).toLocaleString("pt-BR")}
                  >
                    {timeAgo(offer.captured_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>

      {/* Confirmação para limpar a lista de ofertas */}
      <AlertDialog open={clearOpen} onOpenChange={(open) => !open && setClearOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar lista de ofertas?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as ofertas capturadas serão removidas definitivamente. Esta ação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setClearOpen(false)} disabled={clearing}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={clearing}
              onClick={async (event) => {
                event.preventDefault();
                setClearing(true);
                try {
                  const removed = await offersService.clearAll();
                  queryClient.invalidateQueries({ queryKey: ["offers"] });
                  queryClient.invalidateQueries({ queryKey: ["monitors"] });
                  queryClient.invalidateQueries({ queryKey: ["offer-counts"] });
                  toast.success(
                    removed > 0
                      ? `${removed} ${removed === 1 ? "oferta removida" : "ofertas removidas"}.`
                      : "A lista já estava vazia.",
                  );
                } catch (error) {
                  toast.error("Não foi possível limpar a lista", {
                    description: toUserMessage(error),
                  });
                } finally {
                  setClearing(false);
                  setClearOpen(false);
                }
              }}
            >
              {clearing ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 size-4" />
              )}
              Limpar tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Detalhes e Pré-visualização da Oferta com Imagem Ampliada */}
      <Dialog
        open={selectedOffer !== null}
        onOpenChange={(open) => !open && setSelectedOffer(null)}
      >
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
                  <Badge className="absolute top-2 right-2 border border-success/25 bg-success/10 font-mono text-xs font-bold text-success">
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
                    <button
                      type="button"
                      onClick={() => copyCoupon(selectedOffer.coupon)}
                      className="inline-flex items-center gap-1.5 font-mono text-xs uppercase font-bold text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded border border-amber-500/30 transition-colors"
                      title="Clique para copiar o cupom"
                    >
                      <span>{selectedOffer.coupon}</span>
                      <Copy className="size-3" />
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {(selectedOffer.affiliate_url || selectedOffer.original_url) && (
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5" asChild>
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
    </div>
  );
}

function money(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
