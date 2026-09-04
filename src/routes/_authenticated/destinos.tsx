import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataState } from "@/components/common/DataState";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusPill, entityTone } from "@/components/common/StatusPill";
import { CreateEntityDialog } from "@/components/common/CreateEntityDialog";
import { Button } from "@/components/ui/button";
import { destinationsService } from "@/services/destinations";
import { toUserMessage } from "@/services/base";
import { DESTINATION_TYPES, ENTITY_STATUS_LABEL, type DestinationType } from "@/types";

export const Route = createFileRoute("/_authenticated/destinos")({
  head: () => ({
    meta: [
      { title: "Destinos — Affiliate Hub" },
      { name: "description", content: "Canais onde as ofertas serão publicadas." },
      { property: "og:title", content: "Destinos — Affiliate Hub" },
      { property: "og:description", content: "Canais onde as ofertas serão publicadas." },
    ],
  }),
  component: DestinationsPage,
});

function DestinationsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["destinations"], queryFn: () => destinationsService.list() });

  return (
    <>
      <PageHeader
        eyebrow="Canais"
        title="Destinos"
        description="Cadastre os canais de publicação das ofertas processadas."
        actions={
          <CreateEntityDialog
            title="Novo destino"
            fields={[
              { key: "name", label: "Nome", required: true, placeholder: "Canal de ofertas" },
              {
                key: "type",
                label: "Tipo",
                type: "select",
                options: DESTINATION_TYPES.map((item) => ({
                  value: item.value,
                  label: item.label,
                })),
                defaultValue: DESTINATION_TYPES[0]!.value,
              },
              { key: "identifier", label: "Identificador", placeholder: "@canal / ID do grupo" },
            ]}
            onSubmit={(get) =>
              destinationsService.create({
                name: get("name"),
                type: (get("type") || DESTINATION_TYPES[0]!.value) as DestinationType,
                identifier: get("identifier") || null,
                configuration: {},
              })
            }
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ["destinations"] })}
          />
        }
      />

      <DataState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={(query.data ?? []).length === 0}
        empty={
          <EmptyState
            icon={Send}
            title="Nenhum destino cadastrado"
            description="Adicione um destino para publicar as ofertas processadas."
          />
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(query.data ?? []).map((destination) => (
            <div key={destination.id} className="panel space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{destination.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {DESTINATION_TYPES.find((item) => item.value === destination.type)?.label ??
                      destination.type}
                    {destination.identifier ? ` · ${destination.identifier}` : ""}
                  </p>
                </div>
                <StatusPill tone={entityTone(destination.status)}>
                  {ENTITY_STATUS_LABEL[destination.status]}
                </StatusPill>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    try {
                      destinationsService.sendTestMessage();
                    } catch (error) {
                      toast.info(toUserMessage(error));
                    }
                  }}
                >
                  Enviar teste
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await destinationsService.remove(destination.id);
                    queryClient.invalidateQueries({ queryKey: ["destinations"] });
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
