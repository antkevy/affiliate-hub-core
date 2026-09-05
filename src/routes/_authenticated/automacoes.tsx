import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Workflow, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataState } from "@/components/common/DataState";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusPill, entityTone } from "@/components/common/StatusPill";
import { CreateEntityDialog } from "@/components/common/CreateEntityDialog";
import { Button } from "@/components/ui/button";
import { automationsService } from "@/services/automations";
import { sourcesService } from "@/services/sources";
import { destinationsService } from "@/services/destinations";
import { templatesService } from "@/services/templates";
import { toUserMessage } from "@/services/base";
import { useCapture } from "@/hooks/useCapture";
import { ENTITY_STATUS_LABEL, type Automation } from "@/types";

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

  const current = selected ?? automations.data?.[0] ?? null;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["automations"] });
  }

  return (
    <>
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
                options: (templates.data ?? []).map((item) => ({
                  value: item.id,
                  label: item.name,
                })),
              },
            ]}
            onSubmit={(get) =>
              automationsService.create({
                name: get("name"),
                description: get("description") || null,
                source_id: get("source_id") || null,
                destination_id: get("destination_id") || null,
                template_id: get("template_id") || null,
                configuration: {},
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
            <ul className="panel divide-y divide-border">
              {(automations.data ?? []).map((automation) => (
                <li key={automation.id}>
                  <button
                    onClick={() => setSelected(automation)}
                    className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-secondary ${
                      current?.id === automation.id ? "bg-secondary" : ""
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{automation.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {automation.description ?? "Sem descrição"}
                      </span>
                    </span>
                    <StatusPill tone={entityTone(automation.status)}>
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
            <div className="panel space-y-5 p-5">
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

              <div className="flex flex-wrap items-stretch gap-2">
                {BLOCKS.map((block, index) => (
                  <div key={block.title} className="flex items-center gap-2">
                    <div className="min-w-36 rounded-lg border border-border bg-secondary px-3 py-2">
                      <p className="text-xs font-medium">{block.title}</p>
                      <p className="text-[11px] text-muted-foreground">{block.detail}</p>
                    </div>
                    {index < BLOCKS.length - 1 ? (
                      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                    ) : null}
                  </div>
                ))}
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
    </>
  );
}
