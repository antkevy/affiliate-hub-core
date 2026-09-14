import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MoreHorizontal,
  Tags,
  User as UserIcon,
  Wand2,
  Zap,
} from "lucide-react";
import { NAV_GROUPS, type NavItem } from "./nav-config";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { offersService } from "@/services/offers";
import { publicationsService } from "@/services/publications";
import { automationsService } from "@/services/automations";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

const MOBILE_TAB_ITEMS: Array<{ item: NavItem; extra?: boolean }> = [
  { item: { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard } },
  { item: { label: "Ofertas", to: "/ofertas", icon: Tags } },
  { item: { label: "Conversor", to: "/conversor", icon: Wand2 } },
  { item: { label: "Publicações", to: "/publicacoes", icon: Megaphone } },
];

type MenuEntry =
  { label: string; to: string } | { label: string; items: Array<{ label: string; to: string }> };

const MENU_BAR: MenuEntry[] = [
  { label: "Painel", to: "/dashboard" },
  { label: "Ofertas", to: "/ofertas" },
  {
    label: "Canais",
    items: [
      { label: "Fontes", to: "/fontes" },
      { label: "Monitoramento", to: "/monitoramento" },
      { label: "Destinos", to: "/destinos" },
      { label: "Automações", to: "/automacoes" },
    ],
  },
  {
    label: "Conteúdo",
    items: [
      { label: "Templates", to: "/templates" },
      { label: "Banners", to: "/banners" },
    ],
  },
  {
    label: "Afiliados",
    items: [
      { label: "Conversor de Ofertas", to: "/conversor" },
      { label: "Links de Afiliado", to: "/links" },
    ],
  },
  {
    label: "Relatórios",
    items: [
      { label: "Publicações", to: "/publicacoes" },
      { label: "Estatísticas", to: "/estatisticas" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { label: "Integrações", to: "/integracoes" },
      { label: "Configurações", to: "/configuracoes" },
    ],
  },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", compact ? "px-1" : "px-1 lg:px-4")}>
      <div className="relative grid size-8 place-items-center rounded-md border border-primary/30 bg-primary/15 text-primary">
        <Zap className="size-4" />
        <span className="absolute -right-1 -top-1 size-1.5 rounded-full bg-primary" />
      </div>
      {!compact ? (
        <div className="leading-tight">
          <p className="font-display text-sm font-semibold">Affiliate Hub</p>
          <p className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground md:block">
            Automação para afiliados
          </p>
        </div>
      ) : null}
    </div>
  );
}

function isActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

function entryOwnedBy(entry: MenuEntry, pathname: string): boolean {
  if ("to" in entry) return isActive(pathname, entry.to);
  return entry.items.some((item) => isActive(pathname, item.to));
}

/** Ticker global: contagens vivas do pipeline com a hora da última leitura. */
function PipelineTicker() {
  const offers = useQuery({
    queryKey: ["tape", "offers"],
    queryFn: () => offersService.count(),
  });
  const pending = useQuery({
    queryKey: ["tape", "pending"],
    queryFn: () => publicationsService.count({ status: "pending" }),
  });
  const processing = useQuery({
    queryKey: ["tape", "processing"],
    queryFn: () => publicationsService.count({ status: "processing" }),
  });
  const sent = useQuery({
    queryKey: ["tape", "sent"],
    queryFn: () => publicationsService.count({ status: "published" }),
  });
  const active = useQuery({
    queryKey: ["tape", "active"],
    queryFn: () => automationsService.count({ status: "active" }),
  });

  const ready =
    offers.isSuccess &&
    pending.isSuccess &&
    processing.isSuccess &&
    sent.isSuccess &&
    active.isSuccess;
  if (!ready) return null;

  const queued = (pending.data ?? 0) + (processing.data ?? 0);
  const updatedAt = Math.max(offers.dataUpdatedAt, sent.dataUpdatedAt);
  const clock = new Date(updatedAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className="flex min-w-0 items-center gap-2 overflow-hidden font-mono text-[11px] uppercase tracking-[0.1em]"
      aria-label={`Ciclo: ${offers.data ?? 0} capturadas, ${queued} na fila, ${sent.data ?? 0} enviadas.`}
    >
      <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
        <span
          className={cn(
            "size-1.5 rounded-full",
            (active.data ?? 0) > 0 ? "bg-primary" : "bg-muted-foreground/50",
          )}
        />
        {(active.data ?? 0) > 0 ? "operando" : "parado"}
      </span>
      <span className="hidden items-center gap-1.5 md:flex">
        <span className="flex items-center gap-0.5">
          <span className="text-subtle-foreground">cap</span>
          <span className="text-foreground tabular-nums">{offers.data ?? 0}</span>
        </span>
        <span className="flex items-center gap-0.5">
          <span className={cn(queued > 0 ? "text-warning" : "text-subtle-foreground")}>fila</span>
          <span className="text-foreground tabular-nums">{queued}</span>
        </span>
        <span className="flex items-center gap-0.5">
          <span className="text-subtle-foreground">env</span>
          <span className="text-foreground tabular-nums">{sent.data ?? 0}</span>
        </span>
      </span>
      <span className="hidden shrink-0 text-subtle-foreground sm:inline" title="Última leitura">
        · {clock}
      </span>
    </div>
  );
}

function UserMenu() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const name = profile?.name ?? user?.email?.split("@")[0] ?? "Usuário";
  const initials = name.slice(0, 2).toUpperCase();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-lg p-1.5 text-left transition-colors hover:bg-sidebar-accent">
          <Avatar className="size-7">
            <AvatarFallback className="border border-border bg-secondary text-[11px]">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden min-w-0 text-left leading-tight xl:block">
            <span className="block truncate text-xs font-medium text-foreground">{name}</span>
            <span className="block truncate text-[10px] text-muted-foreground">{user?.email}</span>
          </span>
          <MoreHorizontal className="size-4 shrink-0 text-subtle-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {user?.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/configuracoes">
            <UserIcon className="mr-2 size-4" /> Perfil e configurações
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleSignOut}>
          <LogOut className="mr-2 size-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label="Menu principal"
      className="hidden items-center gap-1 border-b border-border px-4 lg:flex"
    >
      {MENU_BAR.map((entry) => {
        if ("to" in entry) {
          const active = isActive(pathname, entry.to);
          return (
            <Link
              key={entry.to}
              to={entry.to}
              className={cn(
                "relative px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.label}
              {active ? (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
              ) : null}
            </Link>
          );
        }
        const active = entryOwnedBy(entry, pathname);
        return (
          <DropdownMenu key={entry.label}>
            <DropdownMenuTrigger
              className={cn(
                "relative inline-flex items-center gap-1 px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] outline-none transition-colors data-[state=open]:text-primary",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.label}
              <MoreHorizontal className="size-3" />
              {active ? (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
              ) : null}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-44">
              {entry.items.map((item) => (
                <DropdownMenuItem asChild key={item.to}>
                  <Link to={item.to} className="font-medium">
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </nav>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 pb-4 pt-1">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="px-2.5 pb-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-subtle-foreground">
            {group.title}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <Link to={item.to} onClick={onNavigate} className="inst-row w-full text-sm">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-secondary/60 text-muted-foreground">
                    <item.icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function MobileBottomBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
        {MOBILE_TAB_ITEMS.map(({ item }) => {
          const active = isActive(pathname, item.to);
          const Icon = item.icon as React.ComponentType<{ className?: string }>;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2"
            >
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-md transition-colors",
                  active ? "bg-primary/15 text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-[18px]" />
              </span>
              <span
                className={cn(
                  "max-w-full truncate text-[10px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
        <button
          onClick={onOpenMenu}
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2"
        >
          <span className="grid size-7 place-items-center rounded-md text-muted-foreground">
            <Menu className="size-[18px]" />
          </span>
          <span className="text-[10px] font-medium text-muted-foreground">Mais</span>
        </button>
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-4 px-4 lg:px-6">
          <Brand />
          <div className="hidden min-w-0 flex-1 justify-center px-6 lg:flex">
            <PipelineTicker />
          </div>
          <div className="flex items-center gap-2">
            <div className="lg:hidden">
              <PipelineTicker />
            </div>
            <UserMenu />
          </div>
        </div>
        <MenuBar />
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10">
        {children}
      </main>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="flex h-full flex-col">
            <Brand compact={false} />
            <NavLinks onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <MobileBottomBar onOpenMenu={() => setOpen(true)} />
    </div>
  );
}
