import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Check,
  Clock,
  Copy,
  History,
  Inbox,
  KeyRound,
  Loader2,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
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
  convertMercadoLivreMessage,
  getMercadoLivreSessionStatus,
  listMercadoLivreConversions,
  listMercadoLivreQueue,
  reprocessMercadoLivreQueue,
  saveMercadoLivreSession,
  type ConvertedLinkResult,
  type ConvertedMessageResult,
  type QueueRow,
} from "@/lib/mercado-livre-converter.server";
import { toUserMessage } from "@/services/base";

export const Route = createFileRoute("/_authenticated/conversor")({
  head: () => ({
    meta: [
      { title: "Conversor de Ofertas — Affiliate Hub" },
      {
        name: "description",
        content:
          "Converta links de ofertas do Mercado Livre de grupos externos para o seu link de afiliado.",
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

export function ConversorPage() {
  const [tab, setTab] = useState<string>("convert");
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Afiliados"
        title="Conversor de Ofertas"
        description="Cole a mensagem ou URL capturada de grupos externos e gere seu link de afiliado do Mercado Livre com URL canônica limpa."
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
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
                <QueueRowCard key={row.id} row={row} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function QueueRowCard({ row }: { row: QueueRow }) {
  const badge = (() => {
    if (row.status === "waiting")
      return (
        <Badge variant="secondary" className="gap-1 bg-amber-500/15 text-[11px] text-amber-500">
          <Clock className="size-3" /> aguardando cookie
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
    <div className="flex flex-wrap items-start gap-3 py-3 sm:flex-nowrap">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs">{row.mode === "single" ? "URL única" : "Mensagem"}</p>
        <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">
          {row.source_text.slice(0, 200)}
          {row.source_text.length > 200 ? "…" : ""}
        </p>
        {row.source_links.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {row.source_links.slice(0, 3).map((link) => (
              <span
                key={link}
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
              >
                {link.length > 48 ? `${link.slice(0, 48)}…` : link}
              </span>
            ))}
            {row.source_links.length > 3 ? (
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                +{row.source_links.length - 3}
              </span>
            ) : null}
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
