import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  LogOut,
  Menu,
  Megaphone,
  Tags,
  User as UserIcon,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { NAV_GROUPS } from "./nav-config";
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
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-5">
      <div
        className="grid size-9 place-items-center rounded-xl bg-primary shadow-[0_10px_24px_-10px_var(--color-primary)]"
        aria-hidden="true"
      >
        <Zap className="size-4.5 text-primary-foreground" />
      </div>
      <div className="leading-tight">
        <p className="font-display text-sm font-semibold tracking-tight">Affiliate Hub</p>
        <p className="text-[11px] text-subtle-foreground">Automação para afiliados</p>
      </div>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Menu principal">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="text-eyebrow px-2 pb-1.5">{group.title}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                    )}
                  >
                    <item.icon
                      className={cn("size-4 shrink-0", active && "text-primary")}
                      aria-hidden="true"
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
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
    <div className="border-t border-sidebar-border p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sidebar-accent"
            aria-label={`Conta de ${name}`}
          >
            <Avatar className="size-9">
              <AvatarFallback className="bg-secondary text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
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
    </div>
  );
}

const MOBILE_TABS: { label: string; to?: string; icon: LucideIcon; more?: boolean }[] = [
  { label: "Início", to: "/dashboard", icon: LayoutDashboard },
  { label: "Ofertas", to: "/ofertas", icon: Tags },
  { label: "Automações", to: "/automacoes", icon: Workflow },
  { label: "Publicações", to: "/publicacoes", icon: Megaphone },
  { label: "Mais", more: true, icon: Menu },
];

function MobileTabContent({
  label,
  icon: Icon,
  active,
}: {
  label: string;
  icon: LucideIcon;
  active?: boolean;
}) {
  return (
    <span
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-[52px] flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
      <span className="text-[10px] font-medium tracking-tight">{label}</span>
      <span
        className={cn(
          "h-0.5 w-4 rounded-full transition-opacity",
          active ? "bg-primary opacity-100" : "opacity-0",
        )}
        aria-hidden="true"
      />
    </span>
  );
}

function MobileNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label="Navegação inferior"
      className="glass-nav fixed inset-x-0 bottom-0 z-40 pb-safe lg:hidden"
    >
      <div className="flex items-center gap-1 border-t border-transparent px-2 pt-1.5">
        {MOBILE_TABS.map((tab) =>
          tab.more ? (
            <button
              key={tab.label}
              type="button"
              onClick={onOpenMenu}
              aria-label="Abrir menu completo"
              className="flex min-w-0 flex-1"
            >
              <MobileTabContent label={tab.label} icon={tab.icon} />
            </button>
          ) : (
            <Link key={tab.to} to={tab.to!} className="flex min-w-0 flex-1">
              <MobileTabContent
                label={tab.label}
                icon={tab.icon}
                active={pathname === tab.to || pathname.startsWith(`${tab.to}/`)}
              />
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar/90 backdrop-blur lg:flex">
        <Brand />
        <NavLinks />
        <UserMenu />
      </aside>

      <div className="lg:pl-60">
        <header className="glass-app-bar sticky top-0 z-30 flex h-14 items-center gap-3 px-4 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Abrir menu"
            className="size-10"
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" aria-hidden="true" />
          </Button>
          <span className="font-display text-sm font-semibold tracking-tight">Affiliate Hub</span>
        </header>

        <main className="px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
          {children}
        </main>
      </div>

      <MobileNav onOpenMenu={() => setOpen(true)} />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="flex h-full flex-col">
            <Brand />
            <NavLinks onNavigate={() => setOpen(false)} />
            <UserMenu />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
