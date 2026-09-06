import { useEffect, useState, type ReactNode } from "react";
import { ClipboardList, MessageCircle, Rss, Send, Webhook, type LucideIcon } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  initialSourceForm,
  SOURCE_IDENTIFIER_HINTS,
  type SourceFormValues,
} from "@/lib/source-config";
import { toUserMessage } from "@/services/base";
import { SOURCE_TYPES, type Source, type SourceType } from "@/types";

const TYPE_ICONS: Record<SourceType, LucideIcon> = {
  telegram: Send,
  whatsapp: MessageCircle,
  feed: Rss,
  api: Webhook,
  manual: ClipboardList,
};

interface SourceDialogProps {
  title: string;
  description?: string;
  source?: Source | null;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit: (values: SourceFormValues) => Promise<void>;
  onSuccess?: () => void;
}

export function SourceDialog({
  title,
  description,
  source,
  trigger,
  open: openProp,
  onOpenChange,
  onSubmit,
  onSuccess,
}: SourceDialogProps) {
  const [openLocal, setOpenLocal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SourceFormValues>(() => initialSourceForm(source));

  const open = openProp ?? openLocal;

  useEffect(() => {
    if (open) setForm(initialSourceForm(source ?? null));
  }, [open, source]);

  function handleOpenChange(next: boolean) {
    if (next) setForm(initialSourceForm(source ?? null));
    if (openProp === undefined) setOpenLocal(next);
    onOpenChange?.(next);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit(form);
      toast.success(source ? "Fonte atualizada." : "Fonte criada.");
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="source-name">Nome</Label>
            <Input
              id="source-name"
              required
              placeholder="Canal de promoções do grupo"
              value={form.name}
              onChange={(event) => setForm((form) => ({ ...form, name: event.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de fonte</Label>
            <RadioGroup
              value={form.type}
              onValueChange={(value) =>
                setForm((form) => ({ ...form, type: value as SourceFormValues["type"] }))
              }
              className="grid gap-2 sm:grid-cols-2"
            >
              {SOURCE_TYPES.map((item) => {
                const Icon = TYPE_ICONS[item.value];
                const selected = form.type === item.value;
                return (
                  <Label
                    key={item.value}
                    htmlFor={`source-type-${item.value}`}
                    className="cursor-pointer"
                  >
                    <RadioGroupItem
                      id={`source-type-${item.value}`}
                      value={item.value}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50",
                      )}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </span>
                  </Label>
                );
              })}
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="source-identifier">Identificador</Label>
            <Input
              id="source-identifier"
              placeholder={SOURCE_IDENTIFIER_HINTS[form.type]}
              value={form.identifier}
              onChange={(event) => setForm((form) => ({ ...form, identifier: event.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Usado para abrir conexão com o canal. Ex.: link de convite, @usuário ou URL de feed.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="source-notes">Observações</Label>
            <Textarea
              id="source-notes"
              rows={3}
              placeholder="Instruções de acesso, horários, ou qual tipo de oferta publicar."
              value={form.notes}
              onChange={(event) => setForm((form) => ({ ...form, notes: event.target.value }))}
            />
          </div>

          <DialogFooter className="sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : source ? "Salvar alterações" : "Criar fonte"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
