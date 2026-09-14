import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  History,
  Inbox,
  KeyRound,
  Loader2,
  Play,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  convertMercadoLivreMessage,
  getMercadoLivreSessionStatus,
  listMercadoLivreConversions,
  listMercadoLivreQueue,
  publishQueuedOfferWithLink,
  reprocessMercadoLivreQueue,
  saveMercadoLivreSession,
  type ConvertedLinkResult,
  type ConvertedMessageResult,
  type QueueRow,
} from "@/lib/mercado-livre-converter.server";
import {
  createAffiliateUrl,
  detectMarketplaceUrl,
  type AffiliateConversionOptions,
} from "@/lib/affiliate-converter";
import { renderTemplate, templatesService } from "@/services/templates";
import { affiliateAccountsService, listMarketplaces } from "@/services/affiliate";
import { formatOfferWithAI, type AIFormatPayload } from "@/lib/ai.server";
import { toUserMessage } from "@/services/base";
import type { Json } from "@/types";

export const Route = createFileRoute("/_authenticated/conversor")({
  head: () => ({
    meta: [
      { title: "Conversor de Ofertas — Affiliate Hub" },
      {
        name: "description",
        content:
          "Gere posts prontos com IA a partir de qualquer link e converta ofertas do Mercado Livre para o seu link de afiliado.",
      },
    ],
  }),
  component: ConversorPage,
});

async function sessionToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

function copyText(value: string, label: string) {
  void navigator.clipboard
    .writeText(value)
    .then(() => toast.success(`${label} copiado.`))
    .catch(() => toast.error("Não foi possível copiar."));
}

/** Resolve os dados de afiliado (ID/tag, loja, SubID) da conta configurada. */
function accountAffiliateData(
  configuration: Json | null,
  slug: string,
): { trackingId: string | null; store: string | null; subid: string | null } {
  if (!configuration || typeof configuration !== "object") {
    return { trackingId: null, store: null, subid: null };
  }
  const record = configuration as Record<string, unknown>;
  const read = (key: string) =>
    typeof record[key] === "string" && (record[key] as string).trim()
      ? (record[key] as string).trim()
      : null;
  const trackingId =
    read("tracking_id") ??
    read("tag") ??
    read("partner_tag") ??
    read("app_id") ??
    read("client_id") ??
    read("affiliate_id");
  return {
    trackingId,
    store: read("store"),
    subid: read("subid"),
  };
}

export function ConversorPage() {
  const [tab, setTab] = useState<string>("convert");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Conversor de Ofertas"
        description="Cole o link e a IA monta o post com seu afiliado, ou converta mensagens capturadas do Mercado Livre com URL canônica limpa."
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="post" className="gap-2">
            <Sparkles className="size-4" /> Post IA
          </TabsTrigger>
          <TabsTrigger value="convert" className="gap-2">
            <Wand2 className="size-4" /> Converter
          </TabsTrigger>
          <TabsTrigger value="session" className="gap-2">
            <KeyRound className="size-4" /> Sessão
          </TabsTrigger>
          <TabsTrigger value="queue" className="gap-2">
            <Inbox className="size-4" /> Fila
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="size-4" /> Histórico
          </TabsTrigger>
        </TabsList>
        <TabsContent value="post">
          <PostIATab />
        </TabsContent>
        <TabsContent value="convert">
          <ConvertTab />
        </TabsContent>
        <TabsContent value="session">
          <SessionTab />
        </TabsContent>
        <TabsContent value="queue">
          <QueueTab />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PostIATab() {
  const accounts = useQuery({
    queryKey: ["affiliate-accounts"],
    queryFn: () => affiliateAccountsService.list(),
  });
  const templates = useQuery({
    queryKey: ["templates"],
    queryFn: () => templatesService.list(),
  });
  const marketplaces = useQuery({ queryKey: ["marketplaces"], queryFn: listMarketplaces });

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [oldPrice, setOldPrice] = useState("");
  const [coupon, setCoupon] = useState("");
  const [cta, setCta] = useState("");
  const [templateId, setTemplateId] = useState("none");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ link: string; text: string; note?: string } | null>(null);

  const detected = url.trim() ? detectMarketplaceUrl(url.trim()) : null;
  const marketplaceName = (marketplaces.data ?? []).find(
    (item) => (item.slug ?? "").toLowerCase() === detected,
  )?.name;

  async function handleGenerate() {
    if (!url.trim()) {
      toast.error("Informe a URL do produto.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const slug = detectMarketplaceUrl(url.trim());
      const matchedMarketplace = (marketplaces.data ?? []).find(
        (item) => (item.slug ?? "").toLowerCase() === slug,
      );
      const account = (accounts.data ?? []).find(
        (item) => item.marketplace_id === matchedMarketplace?.id && item.status === "connected",
      );
      const affiliate = accountAffiliateData(account?.configuration ?? null, slug ?? "");
      const options: AffiliateConversionOptions = {
        marketplaceSlug: slug,
        trackingId: affiliate.trackingId,
        subid: affiliate.subid,
      };
      if (slug === "magalu") options.store = affiliate.store || affiliate.trackingId;

      const converted = createAffiliateUrl(url.trim(), options);
      let effectiveUrl = converted.url;
      let note = converted.method === "original" ? converted.note : undefined;

      if (slug === "shopee" && account) {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token ?? "";
        const { convertShopeeLinkRpc } = await import("@/lib/shopee-affiliate.server");
        const result = await convertShopeeLinkRpc({
          data: {
            token,
            userId: sessionData.session?.user?.id ?? "",
            url: url.trim(),
            subId: options.subid ?? null,
          },
        });
        if (result.ok && result.url) {
          effectiveUrl = result.url;
        } else if (converted.method === "original") {
          note = result.error;
        }
      }

      const salePrice = parseBRL(price);
      const originalPrice = parseBRL(oldPrice);
      const discount =
        salePrice !== null &&
        originalPrice !== null &&
        originalPrice > 0 &&
        salePrice < originalPrice
          ? Math.round((1 - salePrice / originalPrice) * 100)
          : null;
      const titleValue = title.trim() || "O produto anunciado";
      const couponValue = coupon.trim() || null;

      const selectedTemplate = (templates.data ?? []).find((item) => item.id === templateId);
      const offerData = {
        title: titleValue,
        sale_price: salePrice,
        original_price: originalPrice,
        discount_percentage: discount,
        coupon: couponValue,
        original_url: url.trim(),
        affiliate_url: effectiveUrl,
        marketplace: marketplaceName ?? slug ?? "—",
      };
      const baseContent = selectedTemplate
        ? renderTemplate(selectedTemplate.content, offerData)
        : defaultPostContent(titleValue, salePrice, discount, couponValue, effectiveUrl);

      const payload: AIFormatPayload = {
        offer: {
          title: titleValue,
          sale_price: salePrice,
          original_price: originalPrice,
          discount_percentage: discount,
          coupon: couponValue,
          url: effectiveUrl,
        },
        content: baseContent,
        hasCustomTemplate: Boolean(selectedTemplate),
      };
      const marketplace = marketplaceName ?? slug ?? null;
      if (marketplace) payload.offer.marketplace = marketplace;
      let text = baseContent;
      const ai = await formatOfferWithAI({ data: payload });
      if (ai.ok && ai.text) {
        text = ai.text;
      } else if (note) {
        toast.warning(note);
      }
      const finalText = cta.trim() ? `${cta.trim()}\n\n${text}` : text;
      setResult(
        note
          ? { link: effectiveUrl, text: finalText, note }
          : { link: effectiveUrl, text: finalText },
      );
    } catch (error) {
      toast.error("Não foi possível gerar o post", { description: toUserMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="animate-rise">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-chart-1" /> Você cola o link · a IA monta o post
          </CardTitle>
          <CardDescription>
            Cole a URL do produto (Shopee, Amazon, Magalu, Mercado Livre...) e preencha as
            informações que tiver. Geramos o link de afiliado e o post formatado com a sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="post-url">Link do produto</Label>
            <Input
              id="post-url"
              placeholder="https://shopee.com.br/produto/..."
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
            {url.trim() ? (
              <p className="text-xs text-muted-foreground">
                {detected ? (
                  <>
                    Marketplace detectado:{" "}
                    <Badge variant="outline" className="ml-1 font-normal">
                      {marketplaceName ?? detected}
                    </Badge>
                  </>
                ) : (
                  "Marketplace não reconhecido — o link será mantido sem conversão."
                )}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="post-title">Título (opcional)</Label>
            <Input
              id="post-title"
              placeholder="Ex.: Fone Bluetooth XZ 5.3"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="post-price">Preço atual (opcional)</Label>
              <Input
                id="post-price"
                inputMode="decimal"
                placeholder="Ex.: 149,90"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-old-price">Preço antigo (opcional)</Label>
              <Input
                id="post-old-price"
                inputMode="decimal"
                placeholder="Ex.: 249,90"
                value={oldPrice}
                onChange={(event) => setOldPrice(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="post-coupon">Cupom (opcional)</Label>
            <Input
              id="post-coupon"
              placeholder="Ex.: HUB40"
              value={coupon}
              onChange={(event) => setCoupon(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="post-cta">Chamada para ação (opcional)</Label>
            <Input
              id="post-cta"
              placeholder="Ex.: Oferta relâmpago! 🔥"
              value={cta}
              onChange={(event) => setCta(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="post-template">Formatação</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger id="post-template">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Padrão da plataforma (IA)</SelectItem>
                {templates.data?.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full" onClick={handleGenerate} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 size-4" />
            )}
            {loading ? "Montando título, foto e link..." : "Gerar post com IA"}
          </Button>
        </CardContent>
      </Card>

      <Card className="animate-rise" style={{ animationDelay: "80ms" }}>
        <CardHeader>
          <CardTitle className="text-base">Post pronto</CardTitle>
          <CardDescription>
            Copie o texto e envie no seu grupo, ou copie só o link de afiliado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {result ? (
            <>
              {result.note ? (
                <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600">
                  {result.note}
                </p>
              ) : null}
              <div className="space-y-1.5">
                <Label>Link de afiliado</Label>
                <div className="flex gap-2">
                  <Input readOnly value={result.link} className="font-mono text-xs" />
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Copiar link"
                    onClick={() => copyText(result.link, "Link de afiliado")}
                  >
                    <Copy className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label="Abrir link"
                    onClick={() => window.open(result.link, "_blank")}
                  >
                    <ExternalLink className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Texto do post</Label>
                <div className="relative">
                  <Textarea
                    readOnly
                    value={result.text}
                    rows={12}
                    className="pr-10 font-mono text-xs"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    aria-label="Copiar post"
                    onClick={() => copyText(result.text, "Post")}
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="grid h-56 place-items-center rounded-lg border border-dashed border-border text-center text-sm text-muted-foreground">
              O post gerado aparecerá aqui.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function defaultPostContent(
  title: string,
  salePrice: number | null,
  discount: number | null,
  coupon: string | null,
  affiliateUrl: string,
): string {
  const lines = [`➡️ ${title}`];
  if (salePrice !== null) lines.push(`✅ ${formatBRL(salePrice)}`);
  if (discount !== null) lines.push(`⚡ ${discount}% OFF`);
  if (coupon) lines.push(`🏷️ Cupom: \`${coupon.replace(/[`]/g, "")}\``);
  lines.push(`🛒 ${affiliateUrl}`);
  return lines.join("\n");
}

/** Converte "149,90", "R$ 6.277" etc. em número. */
function parseBRL(value: string): number | null {
  if (!value.trim()) return null;
  const cleaned = value.replace(/[R$\s.\u00a0]/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function ConvertTab() {
  const [single, setSingle] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConvertedMessageResult | null>(null);

  async function handleConvert() {
    const text = input.trim();
    if (!text) {
      toast.error("Informe a mensagem ou a URL para converter.");
      return;
    }
    setLoading(true);
    try {
      const token = await sessionToken();
      const outcome = await convertMercadoLivreMessage({ data: { token, text, single } });
      setResult(outcome);
      if (outcome.db_tables_missing) {
        toast.info("Tabelas novas ainda não aplicadas no banco. Rode: supabase db push");
      }
      const succeeded = outcome.links.filter((link) => link.status === "success").length;
      if (outcome.queued) {
        toast.info(
          "Cookie do Mercado Livre expirado: a mensagem entrou na fila de espera. Renove na aba Sessão.",
        );
      } else if (succeeded > 0) {
        toast.success(`Conversão concluída: ${succeeded} link(s) da sua tag.`);
      } else if (outcome.links.length > 0) {
        toast.error("Nenhuma URL da mensagem pôde ser convertida.");
      } else {
        toast.info("Nenhum link do Mercado Livre detectado na mensagem.");
      }
    } catch (error) {
      toast.error("Não foi possível converter", { description: toUserMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Entrada</CardTitle>
          <CardDescription>
            Cole a mensagem completa de um canal/grupo ou mude para o modo URL única.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label htmlFor="single-mode">Modo URL única</Label>
              <p className="text-xs text-muted-foreground">
                Desligado: converte todas as URLs do Mercado Livre do texto.
              </p>
            </div>
            <Switch
              id="single-mode"
              checked={single}
              onCheckedChange={(value) => {
                setSingle(value);
                setResult(null);
              }}
            />
          </div>
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              single
                ? "https://meli.la/XXXX ou https://www.mercadolivre.com.br/p/MLB..."
                : "🔥 Oferta por R$ 249 — https://meli.la/XXXX ..."
            }
            rows={single ? 2 : 6}
            className="font-mono text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleConvert} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 size-4" />
              )}
              Converter oferta
            </Button>
            {result ? (
              <Button
                variant="outline"
                onClick={() => copyText(result.processed_text, "Mensagem pronta")}
              >
                <Copy className="mr-2 size-4" /> Copiar mensagem pronta
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {result ? <ConvertResult result={result} /> : null}
    </div>
  );
}

function ConvertResult({ result }: { result: ConvertedMessageResult }) {
  return (
    <div className="space-y-4">
      {result.queued ? (
        <Card className="border-amber-500/40">
          <CardContent className="flex items-start gap-3 pt-4">
            <Inbox className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <div className="text-xs">
              <p className="font-medium text-amber-500">
                Cookie expirado — mensagem enviada para a fila de espera.
              </p>
              <p className="mt-1 text-muted-foreground">
                Cole um novo cookie na aba “Sessão” e depois clique em “Reprocessar fila” na aba
                “Fila”.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Texto original</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="max-h-64 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
              {result.source_text}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Texto convertido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="max-h-64 overflow-auto whitespace-pre-wrap text-xs text-foreground">
              {result.processed_text}
            </p>
          </CardContent>
        </Card>
      </div>

      {result.links.length > 0 ? (
        <div className="space-y-2.5">
          <p className="text-eyebrow">Links detectados</p>
          {result.links.map((link) => (
            <LinkCard key={link.original} link={link} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LinkCard({ link }: { link: ConvertedLinkResult }) {
  const ok = link.status === "success";
  return (
    <Card className={ok ? "border-success/30" : "border-destructive/30"}>
      <CardContent className="space-y-2 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {link.original.length > 72 ? `${link.original.slice(0, 72)}…` : link.original}
          </span>
          {ok ? (
            <Badge variant="secondary" className="gap-1 bg-success/15 text-success">
              <Check className="size-3" /> sucesso
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              erro
            </Badge>
          )}
        </div>
        <div className="space-y-1.5 text-xs">
          {link.canonical ? (
            <div className="flex items-center justify-between gap-2">
              <span className="shrink-0 text-muted-foreground">Canônica</span>
              <span className="min-w-0 truncate font-mono">{link.canonical}</span>
              <Button
                size="icon"
                variant="ghost"
                className="size-6"
                onClick={() => copyText(link.canonical!, "Link canônico")}
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
          ) : null}
          {link.affiliate ? (
            <div className="flex items-center justify-between gap-2">
              <span className="shrink-0 text-success">Sua tag</span>
              <span className="min-w-0 truncate font-mono">{link.affiliate}</span>
              <Button
                size="icon"
                variant="ghost"
                className="size-6"
                onClick={() => copyText(link.affiliate!, "Link de afiliado")}
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
          ) : null}
          {link.error_log ? <p className="text-destructive">{link.error_log}</p> : null}
          <p className="text-muted-foreground">resposta: {link.response_time_ms}ms</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SessionTab() {
  const [cookies, setCookies] = useState("");
  const [alertEmail, setAlertEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const status = useQuery({
    queryKey: ["meli-session-status"],
    queryFn: async () => {
      const token = await sessionToken();
      return getMercadoLivreSessionStatus({ data: { token } });
    },
  });

  function loadStatus() {
    status.refetch();
  }

  async function handleSave(test: boolean) {
    if (!cookies.trim()) {
      toast.error("Cole a string de cookies da sessão do Mercado Livre.");
      return;
    }
    setSaving(true);
    try {
      const token = await sessionToken();
      const outcome = await saveMercadoLivreSession({
        data: { token, cookies, alert_email: alertEmail, test },
      });
      if (outcome.db_tables_missing) {
        toast.info("Sessão salva, mas as tabelas novas precisam de: supabase db push");
      }
      if (outcome.status === "active") toast.success(outcome.message);
      else toast.error(outcome.message);
      loadStatus();
    } catch (error) {
      toast.error("Não foi possível salvar a sessão", { description: toUserMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  const session = status.data;
  const active = session?.status === "active";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Status da conexão</CardTitle>
            {status.isLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : active ? (
              <Badge className="gap-1 bg-success/15 text-success">
                <ShieldCheck className="size-3" /> Ativa
              </Badge>
            ) : session?.status === "expired" ? (
              <Badge variant="destructive" className="gap-1">
                <ShieldAlert className="size-3" /> Expirada
              </Badge>
            ) : (
              <Badge variant="secondary">Não configurada</Badge>
            )}
          </div>
          <CardDescription>
            Renovação contínua: cada conversão faz o handshake com o Link Builder e mescla os
            cookies da sessão.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-xs sm:grid-cols-3">
          <div>
            <p className="text-muted-foreground">Tag do afiliado</p>
            <p className="font-mono">{session?.tag || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Última validação</p>
            <p className="font-mono">
              {session?.last_validated_at
                ? new Date(session.last_validated_at).toLocaleString("pt-BR")
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Cookie salvo</p>
            <p className="font-mono">{session?.has_cookies ? "sim" : "não"}</p>
          </div>
          {session?.last_error ? (
            <p className="text-destructive sm:col-span-3">{session.last_error}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Configuração da sessão</CardTitle>
          <CardDescription>
            Cole a string bruta de cookies do painel do Mercado Livre (DevTools → Rede → link
            builder → Cookie). Campo e e-mail não saem da sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="session-cookies">Cookies de sessão</Label>
            <Textarea
              id="session-cookies"
              value={cookies}
              onChange={(event) => setCookies(event.target.value)}
              placeholder='a_at=...; _csrf=...; ssid=...  (ou [{ "name": ..., "value": ... }])'
              rows={4}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="alert-email">E-mail de alerta (opcional)</Label>
            <Input
              id="alert-email"
              type="email"
              value={alertEmail}
              onChange={(event) => setAlertEmail(event.target.value)}
              placeholder="voce@exemplo.com"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => handleSave(false)} disabled={saving}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Salvar sessão
            </Button>
            <Button variant="outline" onClick={() => handleSave(true)} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 size-4" />
              )}
              Salvar e testar sessão
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Como obter o cookie (DevTools)</CardTitle>
        </CardHeader>
        <CardContent>
          <details className="group">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              <span className="text-foreground">Ver passo a passo</span>
            </summary>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-xs text-muted-foreground">
              <li>Acesse o painel de afiliados do Mercado Livre e faça login.</li>
              <li>
                Pressione <span className="font-mono text-foreground">F12</span> e abra a aba Rede
                (Network).
              </li>
              <li>Acesse a página do Link Builder (afiliados/link-builder).</li>
              <li>
                Clique na primeira requisição e copie o valor do cabeçalho{" "}
                <span className="font-mono text-foreground">Cookie</span>.
              </li>
              <li>Cole no campo acima e clique em "Salvar e testar sessão".</li>
            </ol>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

function QueueTab() {
  const [reprocessing, setReprocessing] = useState(false);
  const queue = useQuery({
    queryKey: ["meli-queue"],
    queryFn: async () => {
      const token = await sessionToken();
      return listMercadoLivreQueue({ data: { token, limit: 50 } });
    },
  });
  const status = useQuery({
    queryKey: ["meli-session-status"],
    queryFn: async () => {
      const token = await sessionToken();
      return getMercadoLivreSessionStatus({ data: { token } });
    },
  });
  const sessionActive = status.data?.status === "active";
  const waiting = (queue.data ?? []).filter((row) => row.status === "waiting");

  async function handleReprocess() {
    if (waiting.length === 0) return;
    if (!sessionActive) {
      toast.error("Sessão do Mercado Livre não está ativa. Cole um cookie válido na aba Sessão.");
      return;
    }
    setReprocessing(true);
    try {
      const token = await sessionToken();
      const outcome = await reprocessMercadoLivreQueue({ data: { token } });
      if (outcome.db_tables_missing) {
        toast.info("Tabela meli_queue precisa ser criada no banco. Rode: supabase db push");
      } else {
        toast.success(
          `Fila reprocessada: ${outcome.succeeded} convertida(s), ${outcome.stillWaiting} ainda aguardando, ${outcome.failed} falhou.`,
        );
      }
      queue.refetch();
    } catch (error) {
      toast.error("Não foi possível reprocessar a fila", { description: toUserMessage(error) });
    } finally {
      setReprocessing(false);
    }
  }

  const rows = queue.data ?? [];
  const done = rows.filter((row) => row.status === "done").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Fila de ofertas</CardTitle>
              <CardDescription>
                Mensagens que não puderam ser convertidas por cookie expirado e aguardam um novo
                cookie de sessão.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <Badge
                  variant="secondary"
                  className="bg-amber-500/15 px-2 text-[11px] text-amber-500"
                >
                  {waiting.length} aguardando
                </Badge>
                <Badge variant="secondary" className="bg-success/15 px-2 text-[11px] text-success">
                  {done} concluídas
                </Badge>
              </div>
              <Button
                variant="outline"
                onClick={handleReprocess}
                disabled={reprocessing || waiting.length === 0 || !sessionActive}
              >
                {reprocessing ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Play className="mr-2 size-4" />
                )}
                Reprocessar fila
              </Button>
            </div>
          </div>
          {!sessionActive ? (
            <p className="text-xs text-amber-500">
              Sessão não ativa. Cole um cookie atualizado na aba “Sessão” para liberar a
              reprocessamento da fila.
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          {queue.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma oferta na fila de espera.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((row) => (
                <QueueRowCard key={row.id} row={row} onRefetch={() => queue.refetch()} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function QueueRowCard({ row, onRefetch }: { row: QueueRow; onRefetch?: () => void }) {
  const [customUrl, setCustomUrl] = useState("");
  const [posting, setPosting] = useState(false);

  const productUrl = row.source_links?.[0] ?? "";

  async function handlePostCustomLink() {
    if (!customUrl.trim()) {
      toast.error("Cole o seu link meli.la gerado no site do Mercado Livre.");
      return;
    }
    setPosting(true);
    try {
      const token = await sessionToken();
      const res = await publishQueuedOfferWithLink({
        data: { token, queueId: row.id, customAffiliateUrl: customUrl.trim() },
      });
      toast.success(res.message ?? "Oferta publicada com sucesso!");
      if (onRefetch) onRefetch();
    } catch (error) {
      toast.error("Não foi possível publicar", { description: toUserMessage(error) });
    } finally {
      setPosting(false);
    }
  }

  function handleCopyAndOpenProduct() {
    if (!productUrl) return;
    navigator.clipboard.writeText(productUrl);
    window.open(productUrl, "_blank", "noopener,noreferrer");
    toast.success(
      "Link do produto copiado e aberto! Gere o seu link meli.la no site do Mercado Livre e cole abaixo.",
    );
  }

  const badge = (() => {
    if (row.status === "waiting")
      return (
        <Badge variant="secondary" className="gap-1 bg-amber-500/15 text-[11px] text-amber-500">
          <Clock className="size-3" /> aguardando link / cookie
        </Badge>
      );
    if (row.status === "processing")
      return (
        <Badge variant="secondary" className="gap-1 text-[11px]">
          <Loader2 className="size-3 animate-spin" /> processando
        </Badge>
      );
    if (row.status === "done")
      return (
        <Badge variant="secondary" className="gap-1 bg-success/15 text-[11px] text-success">
          <Check className="size-3" /> concluída
        </Badge>
      );
    return (
      <Badge variant="destructive" className="gap-1 text-[11px]">
        falha
      </Badge>
    );
  })();

  return (
    <div className="space-y-3 py-3">
      <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-medium">
              {row.mode === "single" ? "URL única" : "Mensagem"}
            </span>
            {productUrl ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[11px] text-primary hover:bg-primary/10"
                onClick={handleCopyAndOpenProduct}
              >
                <ExternalLink className="mr-1 size-3" /> Copiar / Gerar no Mercado Livre
              </Button>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">
            {row.source_text.slice(0, 200)}
            {row.source_text.length > 200 ? "…" : ""}
          </p>
          {row.source_links.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {row.source_links.map((link) => (
                <a
                  key={link}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-primary hover:underline"
                >
                  {link.length > 48 ? `${link.slice(0, 48)}…` : link}
                </a>
              ))}
            </div>
          ) : null}
          {row.last_error ? (
            <p className="mt-1 text-[11px] text-destructive">{row.last_error}</p>
          ) : null}
          <p className="mt-1 text-[11px] text-muted-foreground">
            {"enfileirada em "}
            {new Date(row.created_at).toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="shrink-0">{badge}</div>
      </div>

      {row.status === "waiting" || row.status === "failed" ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2 sm:flex-nowrap">
          <Input
            placeholder="Cole seu link meli.la gerado no site (ex: https://meli.la/...)"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            className="h-8 flex-1 text-xs font-mono"
          />
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handlePostCustomLink}
            disabled={posting || !customUrl.trim()}
          >
            {posting ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
            Postar no Canal
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function HistoryTab() {
  const history = useQuery({
    queryKey: ["meli-conversions"],
    queryFn: async () => {
      const token = await sessionToken();
      return listMercadoLivreConversions({ data: { token, limit: 30 } });
    },
  });

  const rows = history.data ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Últimas conversões</CardTitle>
        <CardDescription>
          Mensagens e links convertidos com a sua tag, com tempo de resposta e status.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {history.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma conversão registrada ainda.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((row) => {
              const ok = row.links.filter((link) => link.status === "success");
              const failed = row.links.filter((link) => link.status === "error");
              return (
                <div key={row.id} className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs">
                      {row.mode === "single" ? "URL" : "Mensagem"} ·{" "}
                      {row.processed_text.slice(0, 96)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {new Date(row.created_at).toLocaleString("pt-BR")} · resposta{" "}
                      {row.response_time_ms ?? "—"}ms
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="secondary"
                      className="bg-success/15 px-2 text-[11px] text-success"
                    >
                      {ok.length} ok
                    </Badge>
                    {failed.length > 0 ? (
                      <Badge variant="destructive" className="px-2 text-[11px]">
                        {failed.length} erro
                      </Badge>
                    ) : null}
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-7"
                      onClick={() => copyText(row.processed_text, "Mensagem convertida")}
                      aria-label="Copiar mensagem convertida"
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
