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
import { SourceDialog } from "@/components/common/SourceDialog";
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
import {
  buildSourceConfiguration,
  sourceConfiguration,
  type SourceFormValues,
} from "@/lib/source-config";
import { configurationOf } from "@/lib/monitor-config";
import { monitorsService } from "@/services/monitors";
import { sourcesService } from "@/services/sources";
import { toUserMessage } from "@/services/base";
import { ENTITY_STATUS_LABEL, SOURCE_TYPES, type Source, type SourceType } from "@/types";

export const Route = createFileRoute("/_authenticated/fontes")({
  head: () => ({
    meta: [
      { title: "Fontes — Affiliate Hub" },
      { name: "description", content: "Canais e feeds monitorados para captura de ofertas." },
      { property: "og:title", content: "Fontes — Affiliate Hub" },
      {
        property: "og:description",
        content: "Canais e feeds monitorados para captura de ofertas.",
      },
    ],
  }),
  component: SourcesPage,
});

function SourcesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Source | null>(null);
  const [editingOpen, setEditingOpen] = useState(false);
  const [deleting, setDeleting] = useState<Source | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | SourceType>("all");

  const query = useQuery({ queryKey: ["sources"], queryFn: () => sourcesService.list() });
  const monitors = useQuery({ queryKey: ["monitors"], queryFn: () => monitorsService.list() });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["sources"] });
  }

  function edit(source: Source) {
    setEditing(source);
    setEditingOpen(true);
  }

  async function handleSubmit(values: SourceFormValues, source: Source | null) {
    const payload = {
      name: values.name,
      type: values.type,
      identifier: values.identifier || null,
      configuration: buildSourceConfiguration(values),
    };
    if (source) {
      await sourcesService.update(source.id, payload);
    } else {
      await sourcesService.create(payload);
    }
  }

  const sources = (query.data ?? []).filter((source) => {
    const matchesType = typeFilter === "all" || source.type === typeFilter;
    const term = search.trim().toLowerCase();
    const matchesSearch =
      term === "" ||
      source.name.toLowerCase().includes(term) ||
      (source.identifier ?? "").toLowerCase().includes(term);
    return matchesType && matchesSearch;
  });

  const usedByMonitors = deleting
    ? (monitors.data ?? []).filter((monitor) =>
        (configurationOf(monitor).source_ids ?? []).includes(deleting.id),
      )
    : [];

  return (
    <>
      <PageHeader
        eyebrow="Canais"
        title="Fontes"
        description="Cadastre os canais, grupos e feeds de onde as ofertas serão capturadas."
        actions={
          <SourceDialog
            title="Nova fonte"
            description="Defina o canal de origem das ofertas."
            trigger={
              <Button size="sm">
                <Plus className="mr-1.5 size-4" /> Nova fonte
              </Button>
            }
            onSubmit={(values) => handleSubmit(values, null)}
            onSuccess={invalidate}
          />
        }
      />

      <SourceDialog
        open={editingOpen}
        onOpenChange={setEditingOpen}
        title="Editar fonte"
        source={editing}
        onSubmit={(values) => handleSubmit(values, editing)}
        onSuccess={invalidate}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fonte?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? (
                <>
                  A fonte <strong className="font-medium text-foreground">{deleting.name}</strong>{" "}
                  será removida definitivamente. Esta ação não pode ser desfeita.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleting && usedByMonitors.length > 0 ? (
            <p className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                Esta fonte é usada por {usedByMonitors.map((monitor) => monitor.name).join(", ")}.{" "}
                {usedByMonitors.length === 1 ? "Este monitor deixará" : "Estes monitores deixarão"}{" "}
                de acompanhar este grupo.
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
                  await sourcesService.remove(deleting.id);
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
          onValueChange={(value) => setTypeFilter(value as "all" | SourceType)}
        >
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="Todos os tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {SOURCE_TYPES.map((item) => (
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
        isEmpty={sources.length === 0}
        empty={
          <EmptyState
            icon={Inbox}
            title={
              sources.length === 0 && (query.data ?? []).length > 0
                ? "Nenhum resultado"
                : "Nenhuma fonte cadastrada"
            }
            description={
              sources.length === 0 && (query.data ?? []).length > 0
                ? "Ajuste a busca ou o filtro de tipo."
                : "Adicione uma fonte para começar a monitorar ofertas."
            }
          />
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sources.map((source) => {
            const notes = sourceConfiguration(source).notes;
            return (
              <div key={source.id} className="panel flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{source.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {SOURCE_TYPES.find((item) => item.value === source.type)?.label ??
                        source.type}
                      {source.identifier ? ` · ${source.identifier}` : ""}
                    </p>
                  </div>
                  <StatusPill tone={entityTone(source.status)}>
                    {ENTITY_STATUS_LABEL[source.status]}
                  </StatusPill>
                </div>
                {notes ? (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{notes}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  {source.status === "active" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await sourcesService.pause(source.id);
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
                          await sourcesService.activate(source.id);
                          invalidate();
                        } catch (error) {
                          toast.error(toUserMessage(error));
                        }
                      }}
                    >
                      <Play className="mr-1 size-3.5" /> Ativar
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => edit(source)}>
                    <Pencil className="mr-1 size-3.5" /> Editar
                  </Button>
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Testar conexão (em breve)"
                      onClick={() => {
                        try {
                          sourcesService.testConnection();
                        } catch (error) {
                          toast.info(toUserMessage(error));
                        }
                      }}
                    >
                      <FlaskConical className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(source)}>
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
