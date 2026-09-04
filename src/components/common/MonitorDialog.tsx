import { useState, type ReactNode } from "react";
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
import { toUserMessage } from "@/services/base";
import { initialForm, type MonitorFormValues } from "@/lib/monitor-config";
import type { Destination, Marketplace, Monitor, Source, Template } from "@/types";

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
      await onSubmit({
        ...form,
        source_id: form.source_id || null,
      });
      toast.success(monitor ? "Monitor atualizado." : "Monitor criado.");
      handleOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error("Não foi possível salvar", { description: toUserMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="monitor-name">Nome</Label>
            <Input
              id="monitor-name"
              required
              placeholder="Monitor principal"
              value={form.name}
              onChange={(event) => setForm((form) => ({ ...form, name: event.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="monitor-source">Fonte</Label>
            <FieldSelect
              id="monitor-source"
              value={form.source_id ?? ""}
              onValueChange={(value) => setForm((form) => ({ ...form, source_id: value }))}
              options={sources.map((source) => ({ value: source.id, label: source.name }))}
              placeholder="Selecione a fonte"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="monitor-marketplace">Marketplace</Label>
            <FieldSelect
              id="monitor-marketplace"
              value={form.marketplace_id ?? ""}
              onValueChange={(value) => setForm((form) => ({ ...form, marketplace_id: value }))}
              options={marketplaces.map((item) => ({ value: item.id, label: item.name }))}
              placeholder="Todos os marketplaces"
            />
          </div>

          <div className="space-y-3">
            <p className="text-eyebrow">Filtros</p>
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
          </div>

          <div className="space-y-3">
            <p className="text-eyebrow">Publicação</p>
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
            <Label htmlFor="monitor-notes">Configurações</Label>
            <Textarea
              id="monitor-notes"
              rows={3}
              placeholder="Observações e ajustes de configuração do monitor."
              value={form.notes}
              onChange={(event) => setForm((form) => ({ ...form, notes: event.target.value }))}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : monitor ? "Salvar alterações" : "Criar monitor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
