import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Radar } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataState } from "@/components/common/DataState";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusPill, entityTone } from "@/components/common/StatusPill";
import { CreateEntityDialog } from "@/components/common/CreateEntityDialog";
import { Button } from "@/components/ui/button";
import { monitorsService } from "@/services/monitors";
import { sourcesService } from "@/services/sources";
import { toUserMessage } from "@/services/base";
import { ENTITY_STATUS_LABEL } from "@/types";

export const Route = createFileRoute("/_authenticated/monitoramento")({
  head: () => ({
    meta: [
      { title: "Monitoramento — Affiliate Hub" },
      { name: "description", content: "Acompanhe os monitores de fontes e sua atividade." },
      { property: "og:title", content: "Monitoramento — Affiliate Hub" },
      { property: "og:description", content: "Acompanhe os monitores de fontes e sua atividade." },
    ],
  }),
  component: MonitoringPage,
});

function MonitoringPage() {
  const queryClient = useQueryClient();
  const monitors = useQuery({ queryKey: ["monitors"], queryFn: () => monitorsService.list() });
  const sources = useQuery({ queryKey: ["sources"], queryFn: () => sourcesService.list() });

  return (
    <>
      <PageHeader
        eyebrow="Principal"
        title="Monitoramento"
        description="Monitores conectados às suas fontes. A captura em tempo real será configurada posteriormente."
        actions={
          <CreateEntityDialog
            title="Novo monitor"
            fields={[
              { key: "name", label: "Nome", required: true, placeholder: "Monitor principal" },
              {
                key: "source_id",
                label: "Fonte",
                type: "select",
                options: (sources.data ?? []).map((source) => ({
                  value: source.id,
                  label: source.name,
                })),
              },
            ]}
            onSubmit={(get) =>
              monitorsService.create({
                name: get("name"),
                source_id: get("source_id") || null,
                configuration: {},
              })
            }
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ["monitors"] })}
          />
        }
      />

      <DataState
        isLoading={monitors.isLoading}
        error={monitors.error}
        isEmpty={(monitors.data ?? []).length === 0}
        empty={
          <EmptyState
            icon={Radar}
            title="Nenhum monitor configurado"
            description="Crie um monitor vinculado a uma fonte para acompanhar novas ofertas."
          />
        }
      >
        <div className="panel divide-y divide-border">
          {(monitors.data ?? []).map((monitor) => (
            <div
              key={monitor.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{monitor.name}</p>
                <p className="text-xs text-muted-foreground">
                  {monitor.last_activity_at
                    ? `Última atividade em ${new Date(monitor.last_activity_at).toLocaleString("pt-BR")}`
                    : "Sem atividade registrada"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill tone={entityTone(monitor.status)}>
                  {ENTITY_STATUS_LABEL[monitor.status]}
                </StatusPill>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    try {
                      monitorsService.start();
                    } catch (error) {
                      toast.info(toUserMessage(error));
                    }
                  }}
                >
                  Iniciar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DataState>
    </>
  );
}
