import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { User } from "lucide-react";
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
      { name: "description", content: "Dados da conta e preferências do seu perfil." },
      { property: "og:title", content: "Configurações — Affiliate Hub" },
      { property: "og:description", content: "Dados da conta e preferências do seu perfil." },
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

  async function save() {
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
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sistema"
        title="Configurações"
        description="Gerencie os dados da sua conta."
      />

      <div className="panel max-w-xl space-y-4 p-5 animate-rise">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <User className="size-4" />
          </span>
          <p className="text-eyebrow">Perfil</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-name">Nome</Label>
          <Input
            id="profile-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Seu nome"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-email">E-mail</Label>
          <Input id="profile-email" value={user?.email ?? ""} disabled className="font-mono" />
          <p className="text-xs text-muted-foreground">
            A alteração de e-mail será configurada posteriormente.
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}
