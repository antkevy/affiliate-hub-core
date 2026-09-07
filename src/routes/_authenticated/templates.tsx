import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataState } from "@/components/common/DataState";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { templatesService, renderTemplate } from "@/services/templates";
import { toUserMessage } from "@/services/base";
import { TEMPLATE_VARIABLES, type Template } from "@/types";

export const Route = createFileRoute("/_authenticated/templates")({
  head: () => ({
    meta: [
      { title: "Templates — Affiliate Hub" },
      { name: "description", content: "Modelos de mensagem com variáveis para publicar ofertas." },
      { property: "og:title", content: "Templates — Affiliate Hub" },
      {
        property: "og:description",
        content: "Modelos de mensagem com variáveis para publicar ofertas.",
      },
    ],
  }),
  component: TemplatesPage,
});

const DEFAULT_CONTENT = `➡️ {titulo}

✅ {preco}
⚡ {desconto} OFF
🏷️ Cupom: {cupom}

🛒 {link}`;

function TemplatesPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["templates"], queryFn: () => templatesService.list() });
  const [selected, setSelected] = useState<Template | null>(null);
  const [name, setName] = useState("");
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [saving, setSaving] = useState(false);

  function edit(template: Template) {
    setSelected(template);
    setName(template.name);
    setContent(template.content);
  }

  function reset() {
    setSelected(null);
    setName("");
    setContent(DEFAULT_CONTENT);
  }

  async function save() {
    setSaving(true);
    try {
      if (selected) {
        await templatesService.update(selected.id, { name, content });
      } else {
        await templatesService.create({ name, content, type: "message" });
      }
      await queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Template salvo.");
      reset();
    } catch (error) {
      toast.error("Não foi possível salvar", { description: toUserMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Conteúdo"
        title="Templates"
        description="Crie modelos de mensagem usando variáveis dinâmicas."
        actions={
          <Button size="sm" variant="outline" onClick={reset}>
            Novo template
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <div className="panel space-y-4 p-5 animate-rise">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                <FileText className="size-4" />
              </span>
              <p className="text-eyebrow">Editor</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-name">Nome do template</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Padrão Telegram"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-content">Conteúdo com variáveis</Label>
              <Textarea
                id="template-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={6}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Clique nas variáveis abaixo para inserir no modelo.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map((v) => (
                <button
                  key={v.token}
                  type="button"
                  onClick={() => setContent((prev) => `${prev} ${v.token}`)}
                  className="rounded-md border border-border bg-secondary/50 px-2 py-1 font-mono text-[11px] font-medium text-foreground transition-colors hover:border-primary/30 hover:bg-secondary"
                  title={v.label}
                >
                  {v.token}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              {selected ? (
                <Button variant="ghost" size="sm" onClick={reset}>
                  Cancelar
                </Button>
              ) : null}
              <Button size="sm" onClick={save} disabled={saving || !name.trim()}>
                {saving ? "Salvando..." : selected ? "Salvar alterações" : "Criar template"}
              </Button>
            </div>
          </div>

          <div className="panel space-y-3 p-5 animate-rise" style={{ animationDelay: "40ms" }}>
            <p className="text-eyebrow">Pré-visualização</p>
            <div className="whitespace-pre-wrap rounded-lg border border-border bg-secondary/30 p-4 font-mono text-xs leading-relaxed text-foreground">
              {renderTemplate(content, {
                title: "Smartphone Galaxy S24 Ultra 512GB",
                sale_price: 5999,
                original_price: 6999,
                discount_percentage: 14,
                coupon: "DESCONTO10",
                affiliate_url: "https://hub.app/link/xyz",
              })}
            </div>
          </div>
        </div>

        <div className="xl:col-span-1">
          <DataState
            isLoading={query.isLoading}
            error={query.error}
            isEmpty={(query.data ?? []).length === 0}
            empty={
              <EmptyState
                icon={FileText}
                title="Nenhum template"
                description="Crie seu primeiro modelo de mensagem."
              />
            }
          >
            <ul className="panel divide-y divide-border animate-rise">
              {(query.data ?? []).map((template) => (
                <li
                  key={template.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-secondary/40"
                >
                  <div className="min-w-0 flex-1 cursor-pointer" onClick={() => edit(template)}>
                    <p className="truncate text-sm font-medium">{template.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {template.content.slice(0, 40)}...
                    </p>
                  </div>
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="size-8 px-0 text-muted-foreground hover:text-destructive"
                          aria-label="Excluir template"
                          onClick={async () => {
                            await templatesService.remove(template.id);
                            queryClient.invalidateQueries({ queryKey: ["templates"] });
                            if (selected?.id === template.id) reset();
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Excluir</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </li>
              ))}
            </ul>
          </DataState>
        </div>
      </div>
    </div>
  );
}
