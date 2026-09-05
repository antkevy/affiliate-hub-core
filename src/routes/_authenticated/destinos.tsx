import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FlaskConical,
  Inbox,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataState } from "@/components/common/DataState";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusPill, entityTone } from "@/components/common/StatusPill";
import { DestinationDialog } from "@/components/common/DestinationDialog";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { configurationOf } from "@/lib/monitor-config";
import {
  buildDestinationConfiguration,
  destinationConfiguration,
  type DestinationCredentials,
  type DestinationFormValues,
} from "@/lib/destination-config";
import { destinationsService } from "@/services/destinations";
import { monitorsService } from "@/services/monitors";
import { toUserMessage } from "@/services/base";
import {
  DESTINATION_TYPES,
  ENTITY_STATUS_LABEL,
  type Destination,
  type DestinationType,
} from "@/types";

export const Route = createFileRoute("/_authenticated/destinos")({
  head: () => ({
    meta: [
      { title: "Destinos — Affiliate Hub" },
      { name: "description", content: "Canais onde as ofertas serão publicadas." },
      { property: "og:title", content: "Destinos — Affiliate Hub" },
      {
        property: "og:description",
        content: "Canais onde as ofertas serão publicadas.",
      },
    ],
  }),
  component: DestinationsPage,
});

function DestinationsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Destination | null>(null);
  const [editingOpen, setEditingOpen] = useState(false);
  const [deleting, setDeleting] = useState<Destination | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | DestinationType>("all");

  const query = useQuery({
    queryKey: ["destinations"],
    queryFn: () => destinationsService.list(),
  });
  const monitors = useQuery({ queryKey: ["monitors"], queryFn: () => monitorsService.list() });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["destinations"] });
  }

  function edit(destination: Destination) {
    setEditing(destination);
    setEditingOpen(true);
  }

  async function handleSubmit(values: DestinationFormValues, destination: Destination | null) {
    const payload = {
      name: values.name,
      type: values.type,
      identifier: values.chatId.trim() || values.webhookUrl.trim() || null,
      configuration: buildDestinationConfiguration(values),
    };
    if (destination) {
      await destinationsService.update(destination.id, payload);
    } else {
      await destinationsService.create(payload);
    }
  }

  const destinations = (query.data ?? []).filter((destination) => {
    const matchesType = typeFilter === "all" || destination.type === typeFilter;
    const term = search.trim().toLowerCase();
    const matchesSearch =
      term === "" ||
      destination.name.toLowerCase().includes(term) ||
      (destination.identifier ?? "").toLowerCase().includes(term);
    return matchesType && matchesSearch;
  });

  const usedByMonitors = deleting
    ? (monitors.data ?? []).filter(
        (monitor) => configurationOf(monitor).destination_id === deleting.id,
      )
    : [];

  return (
    <>
      <PageHeader
        eyebrow="Canais"
        title="Destinos"
        description="Cadastre os canais de publicação das ofertas processadas."
        actions={
          <DestinationDialog
            title="Novo destino"
            description="Configure o canal e as credenciais do bot de publicação."
            trigger={
              <Button size="sm">
                <Plus className="mr-1.5 size-4" /> Novo destino
              </Button>
            }
            onSubmit={(values) => handleSubmit(values, null)}
            onSuccess={invalidate}
          />
        }
      />

      <DestinationDialog
        open={editingOpen}
        onOpenChange={setEditingOpen}
        title="Editar destino"
        destination={editing}
        onSubmit={(values) => handleSubmit(values, editing)}
        onSuccess={invalidate}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir destino?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? (
                <>
                  O destino <strong className="font-medium text-foreground">{deleting.name}</strong>{" "}
                  será removido definitivamente. Esta ação não pode ser desfeita.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleting && usedByMonitors.length > 0 ? (
            <p className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                Este destino é usado por {usedByMonitors.map((monitor) => monitor.name).join(", ")}.{" "}
                {usedByMonitors.length === 1 ? "Este monitor deixará" : "Estes monitores deixarão"}{" "}
                de publicar ofertas aqui.
              </span>
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleting(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (event) => {
                event.preventDefault();
                if (!deleting) return;
                try {
                  await destinationsService.remove(deleting.id);
                  if (editing?.id === deleting.id) setEditingOpen(false);
                  setDeleting(null);
                  invalidate();
                } catch (error) {
                  setDeleting(null);
                  toast.error(toUserMessage(error));
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome ou identificador"
            className="pl-8"
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(value) => setTypeFilter(value as "all" | DestinationType)}
        >
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Todos os tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {DESTINATION_TYPES.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={destinations.length === 0}
        empty={
          <EmptyState
            icon={Inbox}
            title={
              destinations.length === 0 && (query.data ?? []).length > 0
                ? "Nenhum resultado"
                : "Nenhum destino cadastrado"
            }
            description={
              destinations.length === 0 && (query.data ?? []).length > 0
                ? "Ajuste a busca ou o filtro de tipo."
                : "Adicione um destino para publicar as ofertas processadas."
            }
          />
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {destinations.map((destination) => {
            const config = destinationConfiguration(destination);
            return (
              <div key={destination.id} className="panel flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{destination.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {DESTINATION_TYPES.find((item) => item.value === destination.type)?.label ??
                        destination.type}
                      {(
                        destination.type === "other"
                          ? config.url
                          : (config.chat_id ?? destination.identifier)
                      )
                        ? ` · ${
                            destination.type === "other"
                              ? (config.url ?? destination.identifier)
                              : (config.chat_id ?? destination.identifier)
                          }`
                        : ""}
                    </p>
                  </div>
                  <StatusPill tone={entityTone(destination.status)}>
                    {ENTITY_STATUS_LABEL[destination.status]}
                  </StatusPill>
                </div>
                <CredentialsLine destination={destination} config={config} />
                <div className="flex flex-wrap items-center gap-2">
                  {destination.status === "active" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await destinationsService.pause(destination.id);
                          invalidate();
                        } catch (error) {
                          toast.error(toUserMessage(error));
                        }
                      }}
                    >
                      <Pause className="mr-1 size-3.5" /> Pausar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await destinationsService.activate(destination.id);
                          invalidate();
                        } catch (error) {
                          toast.error(toUserMessage(error));
                        }
                      }}
                    >
                      <Play className="mr-1 size-3.5" /> Ativar
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => edit(destination)}>
                    <Pencil className="mr-1 size-3.5" /> Editar
                  </Button>
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Enviar teste (em breve)"
                      onClick={() => {
                        try {
                          destinationsService.sendTestMessage();
                        } catch (error) {
                          toast.info(toUserMessage(error));
                        }
                      }}
                    >
                      <FlaskConical className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(destination)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </DataState>
    </>
  );
}

function CredentialsLine({
  destination,
  config,
}: {
  destination: Destination;
  config: DestinationCredentials;
}) {
  const target =
    destination.type === "other" ? config.url : (config.chat_id ?? destination.identifier);

  if (destination.type === "other") {
    return (
      <p className="line-clamp-2 text-xs text-muted-foreground">
        {target ? `Webhook: ${target}` : "Webhook não configurado"}
      </p>
    );
  }

  const token = config.token;
  return (
    <p className={cn("text-xs", token && target ? "text-muted-foreground" : "text-amber-600")}>
      {token ? `Bot: ••••${token.slice(-4)}` : "Sem token do bot"}
      {target ? ` · Publica em: ${target}` : " · Canal não informado"}
    </p>
  );
}
