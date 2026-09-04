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
    <>
      <PageHeader
        eyebrow="Sistema"
        title="Configurações"
        description="Gerencie os dados da sua conta."
      />

      <div className="panel max-w-xl space-y-4 p-5">
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
          <Input id="profile-email" value={user?.email ?? ""} disabled />
          <p className="text-xs text-muted-foreground">
            A alteração de e-mail será configurada posteriormente.
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </>
  );
}
