import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Affiliate Hub" },
      {
        name: "description",
        content: "Acesse o Affiliate Hub para gerenciar ofertas, automações e publicações.",
      },
      { property: "og:title", content: "Entrar — Affiliate Hub" },
      {
        property: "og:description",
        content: "Acesse o Affiliate Hub para gerenciar ofertas, automações e publicações.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível entrar", { description: "Verifique e-mail e senha." });
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleSignUp(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { name },
      },
    });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível criar a conta", { description: error.message });
      return;
    }
    toast.success("Conta criada", { description: "Confirme o e-mail se solicitado e entre." });
    setMode("signin");
  }

  async function handleReset(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível enviar o e-mail de recuperação");
      return;
    }
    toast.success("Enviamos um link de recuperação para o seu e-mail.");
  }

  async function handleGoogle() {
    const { lovable } = await import("@/integrations/lovable/index");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Não foi possível entrar com Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary">
            <Zap className="size-4 text-primary-foreground" />
          </div>
          <div>
            <p className="font-display text-base font-semibold">Affiliate Hub</p>
            <p className="text-xs text-muted-foreground">Automação para afiliados</p>
          </div>
        </div>

        <Tabs value={mode} onValueChange={setMode}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="signin">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Criar conta</TabsTrigger>
            <TabsTrigger value="reset">Recuperar</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleSignIn} className="panel space-y-4 p-5">
              <Field id="email" label="E-mail" value={email} onChange={setEmail} type="email" />
              <Field
                id="password"
                label="Senha"
                value={password}
                onChange={setPassword}
                type="password"
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogle}
                disabled={loading}
              >
                Continuar com Google
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="panel space-y-4 p-5">
              <Field id="name" label="Nome" value={name} onChange={setName} />
              <Field
                id="email-signup"
                label="E-mail"
                value={email}
                onChange={setEmail}
                type="email"
              />
              <Field
                id="password-signup"
                label="Senha"
                value={password}
                onChange={setPassword}
                type="password"
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Criando..." : "Criar conta"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="reset">
            <form onSubmit={handleReset} className="panel space-y-4 p-5">
              <Field
                id="email-reset"
                label="E-mail"
                value={email}
                onChange={setEmail}
                type="email"
              />
              <p className="text-xs text-muted-foreground">
                Enviaremos um link para você definir uma nova senha.
              </p>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        required
        autoComplete={type === "password" ? "current-password" : "on"}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
