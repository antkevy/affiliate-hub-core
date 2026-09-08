import {
  LayoutDashboard,
  Radar,
  Workflow,
  Tags,
  FileText,
  Image,
  Inbox,
  Send,
  Link2,
  Megaphone,
  BarChart3,
  Plug,
  Settings,
  Wand2,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Principal",
    items: [
      { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
      { label: "Monitoramento", to: "/monitoramento", icon: Radar },
      { label: "Automações", to: "/automacoes", icon: Workflow },
      { label: "Ofertas", to: "/ofertas", icon: Tags },
    ],
  },
  {
    title: "Conteúdo",
    items: [
      { label: "Templates", to: "/templates", icon: FileText },
      { label: "Banners", to: "/banners", icon: Image },
    ],
  },
  {
    title: "Canais",
    items: [
      { label: "Fontes", to: "/fontes", icon: Inbox },
      { label: "Destinos", to: "/destinos", icon: Send },
    ],
  },
  {
    title: "Afiliados",
    items: [
      { label: "Conversor de Ofertas", to: "/conversor", icon: Wand2 },
      { label: "Links de Afiliado", to: "/links", icon: Link2 },
    ],
  },
  {
    title: "Relatórios",
    items: [
      { label: "Publicações", to: "/publicacoes", icon: Megaphone },
      { label: "Estatísticas", to: "/estatisticas", icon: BarChart3 },
    ],
  },
  {
    title: "Sistema",
    items: [
      { label: "Integrações", to: "/integracoes", icon: Plug },
      { label: "Configurações", to: "/configuracoes", icon: Settings },
    ],
  },
];
