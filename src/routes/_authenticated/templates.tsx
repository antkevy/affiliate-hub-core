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
    <>
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
              <Label htmlFor="template-name">Nome</Label>
              <Input
                id="template-name"
                value={name}
                placeholder="Template padrão"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-content">Conteúdo</Label>
              <Textarea
                id="template-content"
                rows={10}
                className="font-mono text-xs"
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map((variable) => (
                <button
                  key={variable.token}
                  type="button"
                  title={variable.label}
                  onClick={() => setContent((prev) => `${prev}${variable.token}`)}
                  className="rounded-md border border-border bg-secondary/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  {variable.token}
                </button>
              ))}
            </div>
            <Button onClick={save} disabled={saving || !name}>
              {saving ? "Salvando..." : selected ? "Atualizar template" : "Criar template"}
            </Button>
          </div>

          <div className="panel p-5 animate-rise" style={{ animationDelay: "60ms" }}>
            <p className="text-eyebrow mb-3">Pré-visualização</p>
            <pre className="whitespace-pre-wrap rounded-lg border border-border bg-secondary/40 p-3 font-mono text-xs">
              {renderTemplate(content)}
            </pre>
          </div>
        </div>

        <div>
          <p className="text-eyebrow mb-2">Seus templates</p>
          <DataState
            isLoading={query.isLoading}
            error={query.error}
            isEmpty={(query.data ?? []).length === 0}
            rows={3}
            empty={
              <EmptyState
                icon={FileText}
                title="Nenhum template"
                description="Crie o primeiro modelo de mensagem."
              />
            }
          >
            <ul
              className="panel divide-y divide-border animate-rise"
              style={{ animationDelay: "80ms" }}
            >
              {(query.data ?? []).map((template) => (
                <li
                  key={template.id}
                  className="group flex items-center justify-between gap-2 px-4 py-3 transition-colors hover:bg-secondary/40"
                >
                  <button className="min-w-0 text-left" onClick={() => edit(template)}>
                    <p className="truncate text-sm">{template.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {template.content.slice(0, 40)}…
                    </p>
                  </button>
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
    </>
  );
}
