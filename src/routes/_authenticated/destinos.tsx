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
  Send,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataState } from "@/components/common/DataState";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusPill, entityTone } from "@/components/common/StatusPill";
import { StatCard } from "@/components/common/stat-card";
import { DestinationDialog } from "@/components/common/DestinationDialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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

  const activeCount = (query.data ?? []).filter(
    (destination) => destination.status === "active",
  ).length;

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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Send}
          label="Destinos ativos"
          value={activeCount}
          hint={`${(query.data ?? []).length} no total`}
          accent="text-chart-1 bg-chart-1/10 border-chart-1/20"
          delay={0}
        />
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
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 animate-rise">
          {destinations.map((destination, index) => {
            const config = destinationConfiguration(destination);
            return (
              <div
                key={destination.id}
                className="panel flex flex-col gap-3 p-4 transition-colors hover:border-primary/25 animate-rise"
                style={{ animationDelay: `${Math.min(index, 5) * 40}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-lg border",
                        destination.status === "active"
                          ? "border-success/20 bg-success/10 text-success"
                          : "border-border bg-secondary/60 text-muted-foreground",
                      )}
                    >
                      <Send className="size-3.5" />
                    </span>
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
                  </div>
                  <StatusPill tone={entityTone(destination.status)}>
                    <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current align-middle" />
                    {ENTITY_STATUS_LABEL[destination.status]}
                  </StatusPill>
                </div>
                <CredentialsLine destination={destination} config={config} />
                <div className="flex items-center gap-1">
                  <TooltipProvider delayDuration={100}>
                    {destination.status === "active" ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="size-8 px-0"
                            aria-label="Pausar destino"
                            onClick={async () => {
                              try {
                                await destinationsService.pause(destination.id);
                                invalidate();
                              } catch (error) {
                                toast.error(toUserMessage(error));
                              }
                            }}
                          >
                            <Pause className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Pausar</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            className="size-8 px-0"
                            aria-label="Ativar destino"
                            onClick={async () => {
                              try {
                                await destinationsService.activate(destination.id);
                                invalidate();
                              } catch (error) {
                                toast.error(toUserMessage(error));
                              }
                            }}
                          >
                            <Play className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Ativar</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="size-8 px-0"
                          aria-label="Editar destino"
                          onClick={() => edit(destination)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Editar</TooltipContent>
                    </Tooltip>
                    <div className="ml-auto flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="size-8 px-0"
                            aria-label="Enviar teste"
                            onClick={async () => {
                              try {
                                const test = await destinationsService.sendTestMessage(
                                  destination.id,
                                );
                                if (test.ok) {
                                  toast.success(`Teste enviado para ${destination.name}.`);
                                } else {
                                  toast.error("Não foi possível enviar", {
                                    description: test.error,
                                  });
                                }
                              } catch (error) {
                                toast.error(toUserMessage(error));
                              }
                            }}
                          >
                            <FlaskConical className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Enviar teste</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="size-8 px-0 text-muted-foreground hover:text-destructive"
                            aria-label="Excluir destino"
                            onClick={() => setDeleting(destination)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Excluir</TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
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
