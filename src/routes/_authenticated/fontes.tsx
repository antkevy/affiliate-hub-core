import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataState } from "@/components/common/DataState";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusPill, entityTone } from "@/components/common/StatusPill";
import { CreateEntityDialog } from "@/components/common/CreateEntityDialog";
import { Button } from "@/components/ui/button";
import { sourcesService } from "@/services/sources";
import { toUserMessage } from "@/services/base";
import { ENTITY_STATUS_LABEL, SOURCE_TYPES, type SourceType } from "@/types";

export const Route = createFileRoute("/_authenticated/fontes")({
  head: () => ({
    meta: [
      { title: "Fontes — Affiliate Hub" },
      { name: "description", content: "Canais e feeds monitorados para captura de ofertas." },
      { property: "og:title", content: "Fontes — Affiliate Hub" },
      { property: "og:description", content: "Canais e feeds monitorados para captura de ofertas." },
    ],
  }),
  component: SourcesPage,
});

function SourcesPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["sources"], queryFn: () => sourcesService.list() });

  return (
    <>
      <PageHeader
        eyebrow="Canais"
        title="Fontes"
        description="Cadastre os canais, grupos e feeds de onde as ofertas serão capturadas."
        actions={
          <CreateEntityDialog
            title="Nova fonte"
            description="Defina o canal de origem das ofertas."
            fields={[
              { key: "name", label: "Nome", required: true, placeholder: "Canal de promoções" },
              {
                key: "type",
                label: "Tipo",
                type: "select",
                options: SOURCE_TYPES.map((item) => ({ value: item.value, label: item.label })),
                defaultValue: SOURCE_TYPES[0]!.value,
              },
              { key: "identifier", label: "Identificador", placeholder: "@canal ou URL do feed" },
            ]}
            onSubmit={(get) =>
              sourcesService.create({
                name: get("name"),
                type: (get("type") || SOURCE_TYPES[0]!.value) as SourceType,
                identifier: get("identifier") || null,
                configuration: {},
              })
            }
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ["sources"] })}
          />
        }
      />

      <DataState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={(query.data ?? []).length === 0}
        empty={
          <EmptyState
            icon={Inbox}
            title="Nenhuma fonte cadastrada"
            description="Adicione uma fonte para começar a monitorar ofertas."
          />
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(query.data ?? []).map((source) => (
            <div key={source.id} className="panel space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{source.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {SOURCE_TYPES.find((item) => item.value === source.type)?.label ?? source.type}
                    {source.identifier ? ` · ${source.identifier}` : ""}
                  </p>
                </div>
                <StatusPill tone={entityTone(source.status)}>
                  {ENTITY_STATUS_LABEL[source.status]}
                </StatusPill>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    try {
                      sourcesService.testConnection();
                    } catch (error) {
                      toast.info(toUserMessage(error));
                    }
                  }}
                >
                  Testar conexão
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await sourcesService.remove(source.id);
                    queryClient.invalidateQueries({ queryKey: ["sources"] });
                  }}
                >
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DataState>
    </>
  );
}
