import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Workflow, ArrowRight, Loader2, Settings2, Clock, Bot, Image } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataState } from "@/components/common/DataState";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusPill, entityTone } from "@/components/common/StatusPill";
import { type DialogField } from "@/components/common/CreateEntityDialog";
import { CreateEntityDialog } from "@/components/common/CreateEntityDialog";
import { Button } from "@/components/ui/button";
import { automationsService } from "@/services/automations";
import { sourcesService } from "@/services/sources";
import { destinationsService } from "@/services/destinations";
import { templatesService } from "@/services/templates";
import { bannersService } from "@/services/banners";
import { toUserMessage } from "@/services/base";
import { useCapture } from "@/hooks/useCapture";
import { useAutomationScheduler } from "@/hooks/useAutomationScheduler";
import { automationConfigOf, automationConfigValues } from "@/lib/automation-config";
import { AI_DEFAULT_INSTRUCTION } from "@/lib/monitor-config";
import { ENTITY_STATUS_LABEL, type Automation } from "@/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/automacoes")({
  head: () => ({
    meta: [
      { title: "Automações — Affiliate Hub" },
      {
        name: "description",
        content: "Fluxos de captura, filtro, conversão e publicação de ofertas.",
      },
      { property: "og:title", content: "Automações — Affiliate Hub" },
      {
        property: "og:description",
        content: "Fluxos de captura, filtro, conversão e publicação de ofertas.",
      },
    ],
  }),
  component: AutomationsPage,
});

const BLOCKS = [
  { title: "Fonte", detail: "Canal monitorado" },
  { title: "Captura", detail: "Coleta da oferta" },
  { title: "Filtros", detail: "Regras aplicadas" },
  { title: "Processamento", detail: "Normalização dos dados" },
  { title: "Link", detail: "Conversão de afiliado" },
  { title: "Template", detail: "Montagem da mensagem" },
  { title: "Destino", detail: "Publicação final" },
];

function configFields(banners: { value: string; label: string }[]): DialogField[] {
  return [
    {
      key: "interval_minutes",
      label: "Intervalo (minutos)",
      type: "number",
      placeholder: "Ex.: 60 (0 = só manual)",
    },
    {
      key: "ai_enabled",
      label: "Reescrever com IA",
      type: "select",
      defaultValue: "yes",
      options: [
        { value: "yes", label: "Sim (Groq)" },
        { value: "no", label: "Não" },
      ],
    },
    {
      key: "ai_instruction",
      label: "Instrução de estilo (IA)",
      type: "textarea",
      defaultValue: AI_DEFAULT_INSTRUCTION,
    },
    {
      key: "include_banner",
      label: "Anexar banner + imagem",
      type: "select",
      options: [
        { value: "yes", label: "Sim" },
        { value: "no", label: "Não" },
      ],
    },
    {
      key: "banner_id",
      label: "Banner base",
      type: "select",
      options: [{ value: "", label: "Template padrão" }, ...banners],
    },
  ];
}

function toNumberOrNull(value: string): number | null {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && value.trim() !== "" ? parsed : null;
}

function AutomationsPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Automation | null>(null);
  const { running, run } = useCapture(
    selected ? () => automationsService.run(selected.id) : undefined,
  );

  const automations = useQuery({
    queryKey: ["automations"],
    queryFn: () => automationsService.list(),
  });
  const sources = useQuery({ queryKey: ["sources"], queryFn: () => sourcesService.list() });
  const destinations = useQuery({
    queryKey: ["destinations"],
    queryFn: () => destinationsService.list(),
  });
  const templates = useQuery({ queryKey: ["templates"], queryFn: () => templatesService.list() });
  const banners = useQuery({ queryKey: ["banners"], queryFn: () => bannersService.list() });
  const bannerOptions = (banners.data ?? []).map((item) => ({
    value: item.id,
    label: item.name,
  }));

  const current = selected ?? automations.data?.[0] ?? null;

  useAutomationScheduler(automations.data ?? []);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["automations"] });
  }

  const automationConfig = current ? automationConfigOf(current) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Principal"
        title="Automações"
        description="Monte fluxos em blocos e execute para capturar da fonte e publicar no destino."
        actions={
          <CreateEntityDialog
            title="Nova automação"
            fields={[
              { key: "name", label: "Nome", required: true, placeholder: "Ofertas Telegram" },
              { key: "description", label: "Descrição", type: "textarea" },
              {
                key: "source_id",
                label: "Fonte",
                type: "select",
                options: (sources.data ?? []).map((item) => ({
                  value: item.id,
                  label: item.name,
                })),
              },
              {
                key: "destination_id",
                label: "Destino",
                type: "select",
                options: (destinations.data ?? []).map((item) => ({
                  value: item.id,
                  label: item.name,
                })),
              },
              {
                key: "template_id",
                label: "Template",
                type: "select",
                options: [
                  { value: "", label: "Sem template (Padrão do sistema)" },
                  ...(templates.data ?? []).map((item) => ({
                    value: item.id,
                    label: item.name,
                  })),
                ],
              },
              ...configFields(bannerOptions),
            ]}
            onSubmit={(get) =>
              automationsService.create({
                name: get("name"),
                description: get("description") || null,
                source_id: get("source_id") || null,
                destination_id: get("destination_id") || null,
                template_id: get("template_id") || null,
                configuration: automationConfigValues({
                  interval_minutes: toNumberOrNull(get("interval_minutes")),
                  ai_enabled: get("ai_enabled") === "yes",
                  ai_instruction: get("ai_instruction"),
                  include_banner: get("include_banner") === "yes",
                  banner_id: get("banner_id") || null,
                }),
              })
            }
            onSuccess={invalidate}
          />
        }
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <DataState
            isLoading={automations.isLoading}
            error={automations.error}
            isEmpty={(automations.data ?? []).length === 0}
            rows={3}
            empty={
              <EmptyState
                icon={Workflow}
                title="Nenhuma automação"
                description="Crie a primeira automação para montar seu fluxo."
              />
            }
          >
            <ul className="panel divide-y divide-border animate-rise">
              {(automations.data ?? []).map((automation) => (
                <li key={automation.id}>
                  <button
                    onClick={() => setSelected(automation)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary ${
                      current?.id === automation.id ? "bg-secondary" : ""
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-lg border",
                          automation.status === "active"
                            ? "border-success/20 bg-success/10 text-success"
                            : automation.status === "error"
                              ? "border-destructive/20 bg-destructive/10 text-destructive"
                              : "border-border bg-secondary/60 text-muted-foreground",
                        )}
                      >
                        <Workflow className="size-3.5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{automation.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {automation.description ?? "Sem descrição"}
                        </span>
                      </span>
                    </span>
                    <StatusPill tone={entityTone(automation.status)}>
                      <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current align-middle" />
                      {ENTITY_STATUS_LABEL[automation.status]}
                    </StatusPill>
                  </button>
                </li>
              ))}
            </ul>
          </DataState>
        </div>

        <div className="xl:col-span-2">
          {current ? (
            <div className="panel space-y-5 p-5 animate-rise" style={{ animationDelay: "40ms" }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-eyebrow">Fluxo</p>
                  <h2 className="font-display text-lg">{current.name}</h2>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={running}
                    onClick={async () => {
                      if (!current) return;
                      const report = await run();
                      if (report) invalidate();
                    }}
                  >
                    {running ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
                    {running ? "Executando..." : "Executar"}
                  </Button>
                  <CreateEntityDialog
                    title="Editar configuração"
                    triggerLabel=""
                    trigger={
                      <Button size="sm" variant="outline">
                        <Settings2 className="mr-1.5 size-4" /> Configurar
                      </Button>
                    }
                    fields={
                      current && automationConfig
                        ? [
                            {
                              key: "interval_minutes",
                              label: "Intervalo (minutos)",
                              type: "number",
                              defaultValue:
                                automationConfig.interval_minutes === null
                                  ? ""
                                  : String(automationConfig.interval_minutes),
                            },
                            {
                              key: "ai_enabled",
                              label: "Reescrever com IA",
                              type: "select",
                              options: [
                                { value: "yes", label: "Sim (Groq)" },
                                { value: "no", label: "Não" },
                              ],
                              defaultValue: automationConfig.ai_enabled ? "yes" : "no",
                            },
                            {
                              key: "ai_instruction",
                              label: "Instrução de estilo (IA)",
                              type: "textarea",
                              defaultValue: automationConfig.ai_instruction,
                            },
                            {
                              key: "include_banner",
                              label: "Anexar banner + imagem",
                              type: "select",
                              options: [
                                { value: "yes", label: "Sim" },
                                { value: "no", label: "Não" },
                              ],
                              defaultValue: automationConfig.include_banner ? "yes" : "no",
                            },
                            {
                              key: "banner_id",
                              label: "Banner base",
                              type: "select",
                              options: [{ value: "", label: "Template padrão" }, ...bannerOptions],
                              defaultValue: automationConfig.banner_id ?? "",
                            },
                          ]
                        : []
                    }
                    onSubmit={(get) => {
                      if (!current) return Promise.resolve();
                      return automationsService.update(current.id, {
                        configuration: automationConfigValues({
                          interval_minutes: toNumberOrNull(get("interval_minutes")),
                          ai_enabled: get("ai_enabled") === "yes",
                          ai_instruction: get("ai_instruction"),
                          include_banner: get("include_banner") === "yes",
                          banner_id: get("banner_id") || null,
                        }),
                      });
                    }}
                    onSuccess={invalidate}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await automationsService.duplicate(current);
                        invalidate();
                        toast.success("Automação duplicada.");
                      } catch (error) {
                        toast.error("Erro ao duplicar", { description: toUserMessage(error) });
                      }
                    }}
                  >
                    Duplicar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await automationsService.remove(current.id);
                      setSelected(null);
                      invalidate();
                    }}
                  >
                    Excluir
                  </Button>
                </div>
              </div>

              {automationConfig ? (
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    <Clock className="size-3" />
                    {automationConfig.interval_minutes
                      ? `A cada ${automationConfig.interval_minutes} min`
                      : "Sem agendamento"}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px]",
                      automationConfig.ai_enabled
                        ? "border-chart-4/20 bg-chart-4/10 text-chart-4"
                        : "border-border bg-secondary/40 text-muted-foreground",
                    )}
                  >
                    <Bot className="size-3" />
                    {automationConfig.ai_enabled ? "IA ativa" : "Sem IA"}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px]",
                      automationConfig.include_banner
                        ? "border-chart-1/20 bg-chart-1/10 text-chart-1"
                        : "border-border bg-secondary/40 text-muted-foreground",
                    )}
                  >
                    <Image className="size-3" />
                    {automationConfig.include_banner ? "Banner ativo" : "Texto simples"}
                  </span>
                </div>
              ) : null}

              <div>
                <p className="text-eyebrow mb-2">Etapas do pipeline</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                  {BLOCKS.map((block, index) => (
                    <div
                      key={block.title}
                      className="flex flex-col justify-between rounded-lg border border-border bg-secondary/50 p-2.5 transition-colors hover:border-primary/20"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={cn(
                            "grid size-4 shrink-0 place-items-center rounded-full border font-mono text-[9px] font-bold leading-none",
                            index === 0
                              ? "border-success/30 bg-success/10 text-success"
                              : "border-border bg-secondary/60 text-muted-foreground",
                          )}
                        >
                          {index + 1}
                        </span>
                        {index < BLOCKS.length - 1 ? (
                          <span className="text-[10px] text-muted-foreground/40 font-mono">→</span>
                        ) : null}
                      </div>
                      <div className="mt-2">
                        <p className="truncate text-xs font-medium text-foreground">{block.title}</p>
                        <p className="truncate text-[10px] text-muted-foreground">{block.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                O fluxo usa a fonte, o template e o destino vinculados. Clique em Executar para
                processar agora.
              </p>
            </div>
          ) : (
            <div className="panel p-8">
              <EmptyState
                icon={Workflow}
                title="Selecione uma automação"
                description="Escolha um fluxo na lista para visualizar seus blocos."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
