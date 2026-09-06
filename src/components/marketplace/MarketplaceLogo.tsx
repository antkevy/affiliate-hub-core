import { ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

type MarketplaceMeta = { label: string; bg: string; text: string };

const MARKETPLACE_META: Record<string, MarketplaceMeta> = {
  "mercado-livre": { label: "Mercado Livre", bg: "bg-yellow-400", text: "text-blue-950" },
  mercado_livre: { label: "Mercado Livre", bg: "bg-yellow-400", text: "text-blue-950" },
  shopee: { label: "Shopee", bg: "bg-orange-500", text: "text-white" },
  amazon: { label: "Amazon", bg: "bg-amber-500", text: "text-slate-950" },
  magalu: { label: "Magalu", bg: "bg-blue-600", text: "text-white" },
  aliexpress: { label: "AliExpress", bg: "bg-red-600", text: "text-white" },
  shein: { label: "Shein", bg: "bg-pink-600", text: "text-white" },
  kabum: { label: "KaBuM!", bg: "bg-red-600", text: "text-white" },
  none: { label: "Neutro", bg: "bg-secondary", text: "text-muted-foreground" },
};

export function normalizeMarketplace(input?: string | null): string {
  const raw = (input || "").trim().toLowerCase();
  if (!raw) return "none";
  if (
    raw === "mercado-livre" ||
    raw === "mercado_livre" ||
    raw === "mercadolivre" ||
    raw.includes("mercado")
  )
    return "mercado_livre";
  if (raw === "ali-express" || raw === "aliexpress" || raw === "aliex") return "aliexpress";
  if (raw.includes("amazon")) return "amazon";
  if (raw.includes("shopee")) return "shopee";
  if (raw.includes("magalu") || raw.includes("magazine")) return "magalu";
  if (raw.includes("shein")) return "shein";
  if (raw.includes("kabum")) return "kabum";
  return "none";
}

export function marketplaceLabel(input?: string | null): string {
  const meta = MARKETPLACE_META[normalizeMarketplace(input)];
  return meta?.label ?? input ?? "Desconhecido";
}

const FALLBACK_META: MarketplaceMeta = {
  label: "Neutro",
  bg: "bg-secondary",
  text: "text-muted-foreground",
};

interface MarketplaceLogoProps {
  marketplace?: string | null;
  size?: number;
  className?: string;
  showLabel?: boolean;
}

export function MarketplaceLogo({
  marketplace,
  size = 18,
  className = "",
  showLabel = false,
}: MarketplaceLogoProps) {
  const meta = MARKETPLACE_META[normalizeMarketplace(marketplace)] ?? FALLBACK_META;
  const initials = (meta.label || "MP").substring(0, 2).toUpperCase();

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold uppercase leading-none",
          meta.bg,
          meta.text,
        )}
        style={{ width: size, height: size }}
        title={meta.label}
      >
        {normalizeMarketplace(marketplace) === "none" ? (
          <ShoppingBag className="opacity-70" style={{ width: size * 0.65, height: size * 0.65 }} />
        ) : (
          initials
        )}
      </span>
      {showLabel ? <span className="text-xs font-semibold">{meta.label}</span> : null}
    </span>
  );
}
