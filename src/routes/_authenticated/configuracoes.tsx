import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { profileService } from "@/services/profile";
import { toUserMessage } from "@/services/base";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Affiliate Hub" },
      { name: "description", content: "Dados do perfil e preferências da conta." },
      { property: "og:title", content: "Configurações — Affiliate Hub" },
      { property: "og:description", content: "Dados do perfil e preferências da conta." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(profile?.name ?? "");
  }, [profile?.name]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await profileService.upsert(user.id, { name });
      await refreshProfile();
      toast.success("Perfil atualizado.");
    } catch (error) {
      toast.error("Não foi possível salvar", { description: toUserMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Sistema"
        title="Configurações"
        description="Gerencie seus dados de perfil e as preferências da conta."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={handleSave} className="panel space-y-4 p-5">
          <p className="text-eyebrow">Perfil</p>
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" value={user?.email ?? ""} disabled />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </form>

        <div className="panel space-y-3 p-5">
          <p className="text-eyebrow">Preferências avançadas</p>
          <p className="text-sm text-muted-foreground">
            Notificações, fuso horário e limites de publicação. Esta funcionalidade será configurada
            posteriormente.
          </p>
        </div>
      </div>
    </>
  );
}
