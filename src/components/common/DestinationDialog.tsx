import { useState, type ReactNode } from "react";
import { Globe, MessageCircle, Send, type LucideIcon } from "lucide-react";
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
import { initialDestinationForm, type DestinationFormValues } from "@/lib/destination-config";
import { toUserMessage } from "@/services/base";
import { DESTINATION_TYPES, type Destination, type DestinationType } from "@/types";

const TYPE_ICONS: Record<DestinationType, LucideIcon> = {
  telegram: Send,
  whatsapp: MessageCircle,
  other: Globe,
};

interface DestinationDialogProps {
  title: string;
  description?: string;
  destination?: Destination | null;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit: (values: DestinationFormValues) => Promise<void>;
  onSuccess?: () => void;
}

export function DestinationDialog({
  title,
  description,
  destination,
  trigger,
  open: openProp,
  onOpenChange,
  onSubmit,
  onSuccess,
}: DestinationDialogProps) {
  const [openLocal, setOpenLocal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<DestinationFormValues>(() =>
    initialDestinationForm(destination),
  );

  const open = openProp ?? openLocal;

  function handleOpenChange(next: boolean) {
    if (next) setForm(initialDestinationForm(destination ?? null));
    if (openProp === undefined) setOpenLocal(next);
    onOpenChange?.(next);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSubmit(form);
      toast.success(destination ? "Destino atualizado." : "Destino criado.");
      handleOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error("Não foi possível salvar", { description: toUserMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  const isOther = form.type === "other";

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
            <Label htmlFor="destination-name">Nome</Label>
            <Input
              id="destination-name"
              required
              placeholder="Canal de ofertas no Telegram"
              value={form.name}
              onChange={(event) => setForm((form) => ({ ...form, name: event.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de destino</Label>
            <RadioGroup
              value={form.type}
              onValueChange={(value) =>
                setForm((form) => ({ ...form, type: value as DestinationFormValues["type"] }))
              }
              className="grid gap-2 sm:grid-cols-3"
            >
              {DESTINATION_TYPES.map((item) => {
                const Icon = TYPE_ICONS[item.value];
                const selected = form.type === item.value;
                return (
                  <Label
                    key={item.value}
                    htmlFor={`destination-type-${item.value}`}
                    className="cursor-pointer"
                  >
                    <RadioGroupItem
                      id={`destination-type-${item.value}`}
                      value={item.value}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
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

          {isOther ? (
            <div className="space-y-1.5">
              <Label htmlFor="destination-webhook">URL do webhook</Label>
              <Input
                id="destination-webhook"
                type="url"
                placeholder="https://hook.exemplo.com/..."
                value={form.webhookUrl}
                onChange={(event) =>
                  setForm((form) => ({ ...form, webhookUrl: event.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Endpoint que receberá as ofertas processadas.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="destination-token">
                  {form.type === "telegram" ? "Token do bot" : "Token / número do remetente"}
                </Label>
                <Input
                  id="destination-token"
                  type="password"
                  placeholder="123456:ABC-DEF..."
                  value={form.botToken}
                  onChange={(event) =>
                    setForm((form) => ({ ...form, botToken: event.target.value }))
                  }
                />
                {form.type === "telegram" ? (
                  <p className="text-xs text-muted-foreground">
                    Crie seu bot em @BotFather e cole o token aqui. O token fica salvo apenas na sua
                    conta.
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="destination-chat">Canal / grupo de publicação</Label>
                <Input
                  id="destination-chat"
                  placeholder="@canal ou ID numérico (ex.: -100123456789)"
                  value={form.chatId}
                  onChange={(event) => setForm((form) => ({ ...form, chatId: event.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Canal público: basta <code className="rounded bg-muted px-1">@canal</code>.
                  Privado: use o ID numérico (consulte{" "}
                  <code className="rounded bg-muted px-1">@userinfobot</code>).
                </p>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="destination-notes">Observações</Label>
            <Textarea
              id="destination-notes"
              rows={3}
              placeholder="Links de embaixada, formato das mensagens, horários."
              value={form.notes}
              onChange={(event) => setForm((form) => ({ ...form, notes: event.target.value }))}
            />
          </div>

          <DialogFooter className="sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : destination ? "Salvar alterações" : "Criar destino"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
