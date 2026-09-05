import { useState, type ReactNode } from "react";
import { Inbox, Landmark, Megaphone, SlidersHorizontal, Tag, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/common/MultiSelect";
import { toUserMessage } from "@/services/base";
import { initialForm, type MonitorFormValues } from "@/lib/monitor-config";
import {
  SOURCE_TYPES,
  type Destination,
  type Marketplace,
  type Monitor,
  type Source,
  type Template,
} from "@/types";

interface MonitorDialogProps {
  title: string;
  description?: string;
  monitor?: Monitor | null;
  sources: Source[];
  marketplaces: Marketplace[];
  destinations: Destination[];
  templates: Template[];
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit: (values: MonitorFormValues) => Promise<void>;
  onSuccess?: () => void;
}

interface Option {
  value: string;
  label: string;
}

export function MonitorDialog({
  title,
  description,
  monitor,
  sources,
  marketplaces,
  destinations,
  templates,
  trigger,
  open: openProp,
  onOpenChange,
  onSubmit,
  onSuccess,
}: MonitorDialogProps) {
  const [openLocal, setOpenLocal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<MonitorFormValues>(() => initialForm(monitor));

  const open = openProp ?? openLocal;

  function handleOpenChange(next: boolean) {
    if (next) setForm(initialForm(monitor ?? null));
    if (openProp === undefined) setOpenLocal(next);
    onOpenChange?.(next);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit(form);
      toast.success(monitor ? "Monitor atualizado." : "Monitor criado.");
      handleOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error("Não foi possível salvar", { description: toUserMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  const sourceOptions = sources.map((source) => ({
    value: source.id,
    label: source.name,
    hint: `${SOURCE_TYPES.find((item) => item.value === source.type)?.label ?? source.type}${
      source.identifier ? ` · ${source.identifier}` : ""
    }`,
  }));

  const marketplaceOptions = marketplaces.map((item) => ({ value: item.id, label: item.name }));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Section
            icon={Tag}
            title="Identificação"
            hint="Um nome para reconhecer este monitor à primeira vista."
          >
            <div className="space-y-1.5">
              <Label htmlFor="monitor-name">Nome</Label>
              <Input
                id="monitor-name"
                required
                placeholder="Ofertas diárias do Telegram"
                value={form.name}
                onChange={(event) => setForm((form) => ({ ...form, name: event.target.value }))}
              />
            </div>
          </Section>

          <Section
            icon={Users}
            title="Fontes assistidas"
            hint="Grupos e canais de Telegram, WhatsApp ou feeds que este monitor vai acompanhar."
          >
            <div className="space-y-1.5">
              <Label htmlFor="monitor-sources">Grupos e canais</Label>
              <MultiSelect
                id="monitor-sources"
                options={sourceOptions}
                value={form.source_ids}
                onChange={(source_ids) => setForm((form) => ({ ...form, source_ids }))}
                placeholder="Selecione os grupos e canais"
                searchPlaceholder="Buscar por nome, tipo ou identificador"
                emptyText="Nenhum grupo ou canal encontrado."
              />
              {sources.length === 0 ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Inbox className="size-3.5 shrink-0" />
                  Nenhuma fonte cadastrada. Crie uma em <strong>Fontes</strong> primeiro.
                </p>
              ) : null}
            </div>
          </Section>

          <Section
            icon={Landmark}
            title="Marketplaces"
            hint="De quais marketplaces as ofertas podem ser capturadas. Deixe vazio para aceitar todos."
          >
            <div className="space-y-1.5">
              <Label htmlFor="monitor-marketplaces">Plataformas permitidas</Label>
              <MultiSelect
                id="monitor-marketplaces"
                options={marketplaceOptions}
                value={form.marketplace_ids}
                onChange={(marketplace_ids) => setForm((form) => ({ ...form, marketplace_ids }))}
                placeholder="Todos os marketplaces"
                searchPlaceholder="Buscar marketplace"
                emptyText="Nenhum marketplace encontrado."
              />
            </div>
          </Section>

          <Section
            icon={SlidersHorizontal}
            title="Filtros de oferta"
            hint="Critérios para decidir se uma oferta será aproveitada."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="monitor-discount">Desconto mínimo (%)</Label>
                <Input
                  id="monitor-discount"
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  placeholder="Ex.: 30"
                  value={form.min_discount ?? ""}
                  onChange={(event) =>
                    setForm((form) => ({
                      ...form,
                      min_discount: parseNumber(event.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="monitor-price">Preço máximo (R$)</Label>
                <Input
                  id="monitor-price"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Ex.: 149,90"
                  value={form.max_price ?? ""}
                  onChange={(event) =>
                    setForm((form) => ({ ...form, max_price: parseNumber(event.target.value) }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="monitor-keywords">Palavras-chave</Label>
              <Input
                id="monitor-keywords"
                placeholder="fone, bluetooth, 50% off (separadas por vírgula)"
                value={form.keywords}
                onChange={(event) => setForm((form) => ({ ...form, keywords: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="monitor-blocked">Palavras a excluir</Label>
              <Input
                id="monitor-blocked"
                placeholder="usado, recondicionado, genérico, importado"
                value={form.blocked_keywords}
                onChange={(event) =>
                  setForm((form) => ({ ...form, blocked_keywords: event.target.value }))
                }
              />
            </div>
          </Section>

          <Section
            icon={Megaphone}
            title="Publicação"
            hint="Onde a oferta será publicada e qual modelo de mensagem será usado."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="monitor-destination">Destino</Label>
                <FieldSelect
                  id="monitor-destination"
                  value={form.destination_id ?? ""}
                  onValueChange={(value) => setForm((form) => ({ ...form, destination_id: value }))}
                  options={destinations.map((item) => ({ value: item.id, label: item.name }))}
                  placeholder="Sem destino vinculado"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="monitor-template">Template</Label>
                <FieldSelect
                  id="monitor-template"
                  value={form.template_id ?? ""}
                  onValueChange={(value) => setForm((form) => ({ ...form, template_id: value }))}
                  options={templates.map((item) => ({ value: item.id, label: item.name }))}
                  placeholder="Sem template vinculado"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="monitor-spacing">Intervalo entre posts (min)</Label>
              <Input
                id="monitor-spacing"
                type="number"
                min={1}
                step={1}
                placeholder="Ex.: 30 — em branco publica todas"
                value={form.spacing_minutes ?? ""}
                onChange={(event) =>
                  setForm((form) => ({ ...form, spacing_minutes: parseNumber(event.target.value) }))
                }
              />
            </div>
          </Section>

          <Section icon={Tag} title="Configurações" hint="Ajustes adicionais e observações.">
            <div className="space-y-1.5">
              <Label htmlFor="monitor-notes">Notas</Label>
              <Textarea
                id="monitor-notes"
                rows={3}
                placeholder="Observações e ajustes de configuração do monitor."
                value={form.notes}
                onChange={(event) => setForm((form) => ({ ...form, notes: event.target.value }))}
              />
            </div>
          </Section>

          <DialogFooter className="sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : monitor ? "Salvar alterações" : "Criar monitor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 border-t border-border pt-4">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">{title}</h3>
        </div>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function FieldSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder,
}: {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function parseNumber(value: string): number | null {
  if (value === "") return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}
