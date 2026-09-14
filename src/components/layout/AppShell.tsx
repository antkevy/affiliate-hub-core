import { useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
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
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

const MOBILE_TAB_ITEMS: Array<{ item: NavItem; extra?: boolean }> = [
  { item: { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard } },
  { item: { label: "Ofertas", to: "/ofertas", icon: Tags } },
  { item: { label: "Conversor", to: "/conversor", icon: Wand2 } },
  { item: { label: "Publicações", to: "/publicacoes", icon: Megaphone } },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-4">
      <div className="grid size-8 place-items-center rounded-xl border border-primary/25 bg-primary/15 text-primary">
        <Zap className="size-4" />
      </div>
      <div className="leading-tight">
        <p className="font-display text-sm font-semibold">Affiliate Hub</p>
        <p className="text-[11px] text-muted-foreground">Automação para afiliados</p>
      </div>
    </div>
  );
}

function isActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

function NavItemRow({
  item,
  active,
  onNavigate,
  chat = true,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: (() => void) | undefined;
  chat?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={cn(
        "chat-row w-full text-sm",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full border",
          active
            ? "border-primary/30 bg-primary/15 text-primary"
            : "border-border bg-secondary/60 text-muted-foreground group-hover:text-foreground",
        )}
      >
        <Icon className="size-4" />
      </span>
      {chat ? (
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{item.label}</span>
        </span>
      ) : (
        <span className="font-medium">{item.label}</span>
      )}
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 pb-4 pt-1">
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle-foreground">
            {group.title}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavItemRow
                  item={item}
                  active={isActive(pathname, item.to)}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
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
    <div className="border-t border-sidebar-border p-2.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="chat-row w-full rounded-lg text-left hover:bg-sidebar-accent">
            <Avatar className="size-9">
              <AvatarFallback className="border border-border bg-secondary text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {user?.email}
              </span>
            </span>
            <MoreHorizontal className="size-4 shrink-0 text-subtle-foreground" />
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

function FullNavigation({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  return (
    <div className="flex h-full flex-col">
      <Brand />
      <NavLinks onNavigate={onNavigate} />
      <UserMenu />
    </div>
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
              className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2"
            >
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full transition-colors",
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
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2"
        >
          <span className="grid size-7 place-items-center rounded-full text-muted-foreground">
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
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <FullNavigation />
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur lg:hidden">
          <span className="font-display text-sm font-semibold">Affiliate Hub</span>
        </header>

        <main className="px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-8 lg:pt-8">{children}</main>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <FullNavigation onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <MobileBottomBar onOpenMenu={() => setOpen(true)} />
    </div>
  );
}
