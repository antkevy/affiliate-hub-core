import type { ChangeEvent } from "react";
import type {
  BannerAspectRatio,
  BannerConfig,
  BannerStyle,
  MarketplaceBrand,
} from "@/types/banner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Image as ImageIcon,
  Layout,
  Palette,
  RefreshCw,
  Sparkles,
  Type,
  Upload,
} from "lucide-react";

interface BannerEditorProps {
  config: BannerConfig;
  onChange: (config: BannerConfig) => void;
  onReset: () => void;
}

const GRADIENT_PRESETS = [
  {
    name: "Fogo Relâmpago",
    value: "from-red-600 via-rose-600 to-orange-500",
    text: "text-white",
    accent: "text-yellow-300",
  },
  {
    name: "Black Deluxe",
    value: "from-slate-950 via-zinc-900 to-black",
    text: "text-white",
    accent: "text-amber-400",
  },
  {
    name: "Esmeralda Cashback",
    value: "from-emerald-900 via-teal-800 to-cyan-900",
    text: "text-white",
    accent: "text-emerald-300",
  },
  {
    name: "Oceano Frete Grátis",
    value: "from-blue-700 via-indigo-600 to-cyan-500",
    text: "text-white",
    accent: "text-cyan-200",
  },
  {
    name: "Cyber Neon",
    value: "from-purple-950 via-indigo-900 to-fuchsia-900",
    text: "text-white",
    accent: "text-fuchsia-300",
  },
  {
    name: "Amarelo Mercado",
    value: "from-amber-500 via-yellow-400 to-orange-400",
    text: "text-slate-950",
    accent: "text-red-600",
  },
  {
    name: "Rosa Pop Sale",
    value: "from-pink-600 via-rose-500 to-purple-600",
    text: "text-white",
    accent: "text-yellow-300",
  },
  {
    name: "Clean Minimal",
    value: "from-slate-100 via-gray-100 to-slate-200",
    text: "text-slate-900",
    accent: "text-slate-600",
  },
];

export function BannerEditor({ config, onChange, onReset }: BannerEditorProps) {
  function handleInputChange<K extends keyof BannerConfig>(field: K, value: BannerConfig[K]) {
    onChange({ ...config, [field]: value });
  }

  function handleStyleChange<K extends keyof BannerStyle>(field: K, value: BannerStyle[K]) {
    onChange({ ...config, style: { ...config.style, [field]: value } });
  }

  function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        if (loadEvent.target?.result) {
          handleInputChange("imageUrl", loadEvent.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  return (
    <Card className="border-border/60 shadow-lg bg-card">
      <CardContent className="p-5 space-y-6">
        <div className="flex items-center justify-between pb-2 border-b border-border/50">
          <div>
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Estúdio de Edição do Banner
            </h3>
            <p className="text-xs text-muted-foreground">Personalize cada detalhe da sua oferta</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Resetar
          </Button>
        </div>

        <Tabs defaultValue="conteudo" className="w-full">
          <TabsList className="grid grid-cols-4 w-full bg-muted/60 p-1">
            <TabsTrigger value="conteudo" className="gap-1 text-xs">
              <Type className="h-3.5 w-3.5" />
              Textos
            </TabsTrigger>
            <TabsTrigger value="design" className="gap-1 text-xs">
              <Palette className="h-3.5 w-3.5" />
              Estilo
            </TabsTrigger>
            <TabsTrigger value="formato" className="gap-1 text-xs">
              <Layout className="h-3.5 w-3.5" />
              Formato
            </TabsTrigger>
            <TabsTrigger value="imagem" className="gap-1 text-xs">
              <ImageIcon className="h-3.5 w-3.5" />
              Imagem
            </TabsTrigger>
          </TabsList>

          <TabsContent value="conteudo" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="banner-title" className="text-xs font-semibold">
                Título do Produto
              </Label>
              <Input
                id="banner-title"
                value={config.title}
                onChange={(event) => handleInputChange("title", event.target.value)}
                placeholder="Ex: Smartphone Galaxy S24 Ultra"
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="banner-subtitle" className="text-xs font-semibold">
                Subtítulo / Descrição Curta
              </Label>
              <Input
                id="banner-subtitle"
                value={config.subtitle ?? ""}
                onChange={(event) => handleInputChange("subtitle", event.target.value)}
                placeholder="Ex: Menor preço dos últimos 60 dias"
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="banner-orig-price" className="text-xs font-semibold">
                  Preço Original (De:)
                </Label>
                <Input
                  id="banner-orig-price"
                  value={config.originalPrice}
                  onChange={(event) => handleInputChange("originalPrice", event.target.value)}
                  placeholder="R$ 1.999,00"
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="banner-curr-price" className="text-xs font-semibold text-primary">
                  Preço Promocional (Por:)
                </Label>
                <Input
                  id="banner-curr-price"
                  value={config.currentPrice}
                  onChange={(event) => handleInputChange("currentPrice", event.target.value)}
                  placeholder="R$ 1.299,00"
                  className="text-sm font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="banner-discount-badge" className="text-xs font-semibold">
                  Selo de Desconto
                </Label>
                <Input
                  id="banner-discount-badge"
                  value={config.discountBadge}
                  onChange={(event) => handleInputChange("discountBadge", event.target.value)}
                  placeholder="35% OFF"
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="banner-coupon" className="text-xs font-semibold">
                  Código do Cupom (Opcional)
                </Label>
                <Input
                  id="banner-coupon"
                  value={config.couponCode ?? ""}
                  onChange={(event) => handleInputChange("couponCode", event.target.value)}
                  placeholder="Ex: DESCONTO10"
                  className="text-sm font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="banner-installment" className="text-xs font-semibold">
                  Condição de Parcelamento
                </Label>
                <Input
                  id="banner-installment"
                  value={config.installmentText ?? ""}
                  onChange={(event) => handleInputChange("installmentText", event.target.value)}
                  placeholder="em até 10x sem juros"
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="banner-button-text" className="text-xs font-semibold">
                    Texto do Botão (CTA)
                  </Label>
                  {config.showButton === false && (
                    <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      Oculto (Post de Grupo)
                    </span>
                  )}
                </div>
                <Input
                  id="banner-button-text"
                  value={config.buttonText}
                  onChange={(event) => handleInputChange("buttonText", event.target.value)}
                  placeholder="PEGAR OFERTA"
                  disabled={config.showButton === false}
                  className="text-sm uppercase font-bold"
                />
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">Modo Post de Grupo (Sem Botão)</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Oculta o botão CTA inferior para gerar imagens focadas em anúncios de grupos
                  </p>
                </div>
                <Switch
                  checked={config.showButton === false}
                  onCheckedChange={(isGroupPost) => handleInputChange("showButton", !isGroupPost)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="design" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Paleta de Cores e Gradientes</Label>
              <div className="grid grid-cols-2 gap-2">
                {GRADIENT_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      onChange({
                        ...config,
                        style: {
                          ...config.style,
                          backgroundGradient: preset.value,
                          textColor: preset.text,
                          accentColor: preset.accent,
                        },
                      });
                    }}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all ${
                      config.style.backgroundGradient === preset.value
                        ? "border-primary ring-2 ring-primary/20 bg-accent"
                        : "border-border hover:bg-accent/50"
                    }`}
                  >
                    <div
                      className={`h-6 w-6 rounded-full bg-gradient-to-br ${preset.value} shrink-0 border border-white/20`}
                    />
                    <span className="font-medium truncate">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Plataforma / Marketplace</Label>
                <Select
                  value={config.marketplace}
                  onValueChange={(value: MarketplaceBrand) =>
                    handleInputChange("marketplace", value)
                  }
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mercado-livre">Mercado Livre</SelectItem>
                    <SelectItem value="shopee">Shopee</SelectItem>
                    <SelectItem value="amazon">Amazon</SelectItem>
                    <SelectItem value="magalu">Magalu</SelectItem>
                    <SelectItem value="aliexpress">AliExpress</SelectItem>
                    <SelectItem value="none">Nenhum (Neutro)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Efeito de Fundo (Textura)</Label>
                <Select
                  value={config.style.patternOverlay ?? "none"}
                  onValueChange={(value) =>
                    handleStyleChange("patternOverlay", value as BannerStyle["patternOverlay"])
                  }
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem Textura</SelectItem>
                    <SelectItem value="dots">Pontos (Dots)</SelectItem>
                    <SelectItem value="grid">Grade (Grid Tech)</SelectItem>
                    <SelectItem value="waves">Ondas (Fluido)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">Selo Destacado (Sticker Floating)</Label>
                  <p className="text-[11px] text-muted-foreground">Exibe uma tag animada no topo</p>
                </div>
                <Switch
                  checked={config.showSticker ?? false}
                  onCheckedChange={(checked) => handleInputChange("showSticker", checked)}
                />
              </div>

              {config.showSticker && (
                <div className="space-y-1.5">
                  <Label htmlFor="sticker-text" className="text-xs font-semibold">
                    Texto do Selo Animado
                  </Label>
                  <Input
                    id="sticker-text"
                    value={config.stickerText ?? ""}
                    onChange={(event) => handleInputChange("stickerText", event.target.value)}
                    placeholder="Ex: ÚLTIMAS UNIDADES"
                    className="text-sm uppercase font-bold"
                  />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="formato" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Formato do Banner (Proporção)</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { ratio: "1:1", name: "Quadrado (1:1)", desc: "WhatsApp, Telegram, Feed" },
                  {
                    ratio: "9:16",
                    name: "Vertical Story (9:16)",
                    desc: "Instagram Stories, Reels, TikTok",
                  },
                  {
                    ratio: "16:9",
                    name: "Horizontal Web (16:9)",
                    desc: "Sites, Banners, Cabeçalho",
                  },
                  { ratio: "4:5", name: "Retrato Feed (4:5)", desc: "Instagram Feed Otimizado" },
                ].map((item) => (
                  <button
                    key={item.ratio}
                    type="button"
                    onClick={() =>
                      handleInputChange("aspectRatio", item.ratio as BannerAspectRatio)
                    }
                    className={`p-3 rounded-xl border text-left transition-all ${
                      config.aspectRatio === item.ratio
                        ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                        : "border-border hover:bg-accent/40"
                    }`}
                  >
                    <div className="font-bold text-xs text-foreground">{item.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <Label htmlFor="tagline-input" className="text-xs font-semibold">
                Tagline do Topo (Header Badge)
              </Label>
              <Input
                id="tagline-input"
                value={config.tagline ?? ""}
                onChange={(event) => handleInputChange("tagline", event.target.value)}
                placeholder="Ex: ⚡ OFERTA RELÂMPAGO"
                className="text-sm uppercase"
              />
            </div>

            <div className="space-y-3 pt-3 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">Ocultar Botão Inferior (Post de Grupo)</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Mantém apenas imagem do produto, background e preços no banner
                  </p>
                </div>
                <Switch
                  checked={config.showButton === false}
                  onCheckedChange={(isGroupPost) => handleInputChange("showButton", !isGroupPost)}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="imagem" className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Enviar Imagem Personalizada</Label>
              <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/30 p-6 bg-muted/20 hover:bg-muted/40 transition-colors">
                <div className="text-center space-y-2">
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="text-xs font-medium text-foreground">
                    Clique para selecionar uma imagem do seu computador
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    PNG com fundo transparente funciona melhor!
                  </p>
                  <label className="inline-flex">
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      className="cursor-pointer"
                      asChild
                    >
                      <span>
                        Selecionar Arquivo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="image-url" className="text-xs font-semibold">
                Ou insira o URL da Imagem
              </Label>
              <Input
                id="image-url"
                value={config.imageUrl}
                onChange={(event) => handleInputChange("imageUrl", event.target.value)}
                placeholder="https://exemplo.com/produto.jpg"
                className="text-xs"
              />
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center text-xs">
                <Label className="font-semibold">
                  Zoom da Imagem ({Math.round((config.imageScale ?? 1) * 100)}%)
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleInputChange("imageScale", 1)}
                  className="h-6 text-[10px] px-2"
                >
                  Redefinir Zoom
                </Button>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.05"
                value={config.imageScale ?? 1}
                onChange={(event) =>
                  handleInputChange("imageScale", parseFloat(event.target.value))
                }
                className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
