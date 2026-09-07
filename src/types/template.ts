import type { Database } from "@/integrations/supabase/types";

type T = Database["public"]["Tables"];

export type Template = T["templates"]["Row"];
export type TemplateInsert = T["templates"]["Insert"];
export type TemplateUpdate = T["templates"]["Update"];

export type Banner = T["banners"]["Row"];
export type BannerInsert = T["banners"]["Insert"];

export interface BannerConfiguration {
  image_url?: string;
  logo_url?: string;
  title?: string;
  price?: string;
  old_price?: string;
  discount?: string;
  coupon?: string;
  cta?: string;
  theme?: "dark" | "light" | "blue";
}

export const TEMPLATE_VARIABLES = [
  { token: "{titulo}", label: "Título da oferta" },
  { token: "{preco}", label: "Preço atual" },
  { token: "{preco_antigo}", label: "Preço antigo" },
  { token: "{desconto}", label: "Desconto" },
  { token: "{cupom}", label: "Cupom" },
  { token: "{moedas}", label: 'Moedas AliExpress (ex.: "581 moedas no APP")' },
  { token: "{link}", label: "Link de afiliado" },
  { token: "{marketplace}", label: "Marketplace" },
  { token: "{categoria}", label: "Categoria" },
] as const;
