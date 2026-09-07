import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ImagePlus, Image as ImageIcon, Loader2, Star, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataState } from "@/components/common/DataState";
import { EmptyState } from "@/components/common/EmptyState";
import { CreateEntityDialog } from "@/components/common/CreateEntityDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BannerCanvas } from "@/components/banners/BannerCanvas";
import { BannerEditor } from "@/components/banners/BannerEditor";
import { SavedBannersGrid } from "@/components/banners/SavedBannersGrid";
import { BANNER_TEMPLATES } from "@/components/banners/bannerTemplatesData";
import { bannerConfigOf, buildBannerConfiguration } from "@/lib/banner-config";
import { cn } from "@/lib/utils";
import { bannersService } from "@/services/banners";
import { toUserMessage } from "@/services/base";
import type { Banner } from "@/types";
import type { BannerAspectRatio, BannerConfig } from "@/types/banner";

export const Route = createFileRoute("/_authenticated/banners")({
  head: () => ({
    meta: [
      { title: "Banners — Affiliate Hub" },
      {
        name: "description",
        content: "Modelos visuais para acompanhar as publicações de ofertas.",
      },
      { property: "og:title", content: "Banners — Affiliate Hub" },
      {
        property: "og:description",
        content: "Modelos visuais para acompanhar as publicações de ofertas.",
      },
    ],
  }),
  component: BannersPage,
});

function BannersPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["banners"], queryFn: () => bannersService.list() });

  const [editing, setEditing] = useState<Banner | null>(null);
  const [draft, setDraft] = useState<BannerConfig | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState<Banner | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["banners"] });
  }

  function edit(banner: Banner) {
    setEditing(banner);
    setDraft(JSON.parse(JSON.stringify(bannerConfigOf(banner))));
    setName(banner.name);
  }

  function closeEditor() {
    setEditing(null);
    setDraft(null);
  }

  function applyTemplate(templateId: string) {
    const template = BANNER_TEMPLATES.find((item) => item.id === templateId);
    if (!template || !draft) return;
    const base = JSON.parse(JSON.stringify(template.defaultConfig)) as BannerConfig;
    setDraft({
      ...base,
      title: draft.title || base.title,
      subtitle: draft.subtitle ?? base.subtitle ?? "",
      originalPrice: draft.originalPrice || base.originalPrice,
      currentPrice: draft.currentPrice || base.currentPrice,
      discountBadge: draft.discountBadge || base.discountBadge,
      couponCode: draft.couponCode ?? base.couponCode ?? "",
      imageUrl: draft.imageUrl || base.imageUrl,
      imageScale: draft.imageScale ?? base.imageScale ?? 1,
      imagePositionX: draft.imagePositionX ?? base.imagePositionX ?? 0,
      imagePositionY: draft.imagePositionY ?? base.imagePositionY ?? 0,
      isDefault: draft.isDefault ?? false,
    });
  }

  function resetDraft() {
    if (editing) setDraft(JSON.parse(JSON.stringify(bannerConfigOf(editing))));
  }

  async function saveBanner() {
    if (!editing || !draft) return;
    setSaving(true);
    try {
      if (draft.isDefault) {
        await bannersService.setDefault(editing.id);
      }
      await bannersService.update(editing.id, {
        name: name.trim() || editing.name,
        configuration: buildBannerConfiguration(draft),
      });
      invalidate();
      toast.success("Banner atualizado.");
    } catch (error) {
      toast.error("Não foi possível salvar", { description: toUserMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(banner: Banner) {
    try {
      await bannersService.setDefault(banner.id);
      invalidate();
      toast.success(`⭐ Banner "${banner.name}" configurado como padrão de automação.`);
    } catch (error) {
      toast.error("Erro ao definir banner padrão", { description: toUserMessage(error) });
    }
  }

  async function generateImage() {
    if (!editing || !draft || !canvasRef.current) return;
    setGenerating(true);
    try {
      if (draft.isDefault) {
        await bannersService.setDefault(editing.id);
      }
      await bannersService.update(editing.id, {
        name: name.trim() || editing.name,
        configuration: buildBannerConfiguration(draft),
      });
      const blob = await bannersService.renderBannerToBlob(canvasRef.current, 2);
      const url = await bannersService.uploadPreview(editing.user_id, editing.id, blob);
      await bannersService.updatePreview(editing.id, url);
      invalidate();
      toast.success("Imagem do banner gerada.");
    } catch (error) {
      toast.error("Não foi possível gerar a imagem", { description: toUserMessage(error) });
    } finally {
      setGenerating(false);
    }
  }

  async function downloadBanner() {
    if (!editing || !draft || !canvasRef.current) return;
    try {
      const slug = (draft.title || "banner")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 40);
      await bannersService.downloadPng(canvasRef.current, `banner-${slug || "oferta"}.png`);
    } catch (error) {
      toast.error("Não foi possível baixar a imagem", { description: toUserMessage(error) });
    }
  }

  async function deleteBanner() {
    if (!deleting) return;
    try {
      await bannersService.remove(deleting.id);
      if (editing?.id === deleting.id) closeEditor();
      setDeleting(null);
      invalidate();
    } catch (error) {
      setDeleting(null);
      toast.error("Não foi possível excluir", { description: toUserMessage(error) });
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Conteúdo"
        title="Banners"
        description="Crie modelos de banner, personalize a oferta e gere a imagem em PNG."
        actions={
          <CreateEntityDialog
            title="Novo banner"
            fields={[
              { key: "name", label: "Nome", required: true, placeholder: "Banner promocional" },
            ]}
            onSubmit={(get) =>
              bannersService.create({
                name: get("name"),
                configuration: {},
              })
            }
            onSuccess={invalidate}
          />
        }
      />

      {editing && draft ? (
        <BannerStudio
          banner={editing}
          draft={draft}
          name={name}
          saving={saving}
          generating={generating}
          canvasRef={canvasRef}
          onNameChange={setName}
          onConfigChange={setDraft}
          onTemplateChange={applyTemplate}
          onReset={resetDraft}
          onAspectRatioChange={(ratio) =>
            setDraft((prev) => (prev ? { ...prev, aspectRatio: ratio } : prev))
          }
          onSave={saveBanner}
          onGenerate={generateImage}
          onDownload={downloadBanner}
          onClose={closeEditor}
        />
      ) : (
        <DataState
          isLoading={query.isLoading}
          error={query.error}
          isEmpty={(query.data ?? []).length === 0}
          empty={
            <EmptyState
              icon={ImageIcon}
              title="Nenhum banner criado"
              description="Crie um modelo de banner para gerar imagens promocionais."
            />
          }
        >
          <SavedBannersGrid
            banners={query.data ?? []}
            onSelectEdit={edit}
            onDelete={setDeleting}
            onSetDefault={handleSetDefault}
          />
        </DataState>
      )}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir banner?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? (
                <>
                  O banner <strong className="font-medium text-foreground">{deleting.name}</strong>{" "}
                  será removido definitivamente. Esta ação não pode ser desfeita.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleting(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteBanner}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface BannerStudioProps {
  banner: Banner;
  draft: BannerConfig;
  name: string;
  saving: boolean;
  generating: boolean;
  canvasRef: RefObject<HTMLDivElement | null>;
  onNameChange: (value: string) => void;
  onConfigChange: (config: BannerConfig) => void;
  onTemplateChange: (templateId: string) => void;
  onReset: () => void;
  onAspectRatioChange: (ratio: BannerAspectRatio) => void;
  onSave: () => void;
  onGenerate: () => void;
  onDownload: () => void;
  onClose: () => void;
}

const RATIOS: BannerAspectRatio[] = ["1:1", "9:16", "16:9", "4:5"];

function BannerStudio({
  draft,
  name,
  saving,
  generating,
  canvasRef,
  onNameChange,
  onConfigChange,
  onTemplateChange,
  onReset,
  onAspectRatioChange,
  onSave,
  onGenerate,
  onDownload,
  onClose,
}: BannerStudioProps) {
  const previewBoxRef = useRef<HTMLDivElement>(null);
  const previewScalerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState<number | null>(null);

  useLayoutEffect(() => {
    const box = previewBoxRef.current;
    const node = previewScalerRef.current;
    if (!box || !node) return;
    const width = node.offsetWidth;
    const height = node.offsetHeight;
    const boxWidth = box.clientWidth - 32;
    const boxHeight = box.clientHeight - 32;
    if (!width || !height || !boxWidth || !boxHeight) return;
    setPreviewScale(Math.min(1, boxWidth / width, boxHeight / height));
  }, [draft]);

  return (
    <section className="space-y-4">
      <div className="panel p-5">
        <div className="mb-4 flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-eyebrow mb-1">Estúdio de criação</p>
            <h2 className="font-display text-lg font-semibold tracking-tight">Editar banner</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Visualize as alterações em tempo real e gere a imagem em alta resolução.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 h-9">
              <Switch
                id="default-banner-toggle"
                checked={draft.isDefault === true}
                onCheckedChange={(checked) => onConfigChange({ ...draft, isDefault: checked })}
              />
              <Label
                htmlFor="default-banner-toggle"
                className="cursor-pointer text-xs font-medium flex items-center gap-1"
              >
                <Star
                  className={`size-3.5 ${draft.isDefault ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`}
                />
                Banner Padrão
              </Label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="banner-name">Nome do banner</Label>
              <Input
                id="banner-name"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                className="sm:w-52"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="banner-template">Template visual</Label>
              <Select value={draft.templateId} onValueChange={onTemplateChange}>
                <SelectTrigger id="banner-template" className="sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BANNER_TEMPLATES.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar editor">
              <X />
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <div className="rounded-lg border border-border bg-secondary p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Pré-visualização ao vivo
                  </span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {draft.aspectRatio}
                  </Badge>
                </div>
                <div className="flex items-center gap-1 rounded-md bg-background p-1">
                  {RATIOS.map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => onAspectRatioChange(ratio)}
                      className={cn(
                        "rounded px-2 py-0.5 text-[10px] font-bold transition-colors",
                        draft.aspectRatio === ratio
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>
              <div
                ref={previewBoxRef}
                className="flex h-[480px] items-center justify-center overflow-hidden rounded-md bg-background"
              >
                <div
                  ref={previewScalerRef}
                  className="shrink-0 w-full max-w-md origin-center transition-transform"
                  style={{ transform: previewScale ? `scale(${previewScale})` : undefined }}
                >
                  <BannerCanvas ref={canvasRef} config={draft} />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={onGenerate} disabled={generating}>
                {generating ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                {generating ? "Gerando imagem..." : "Gerar imagem"}
              </Button>
              <Button variant="outline" onClick={onDownload} disabled={generating}>
                <Download />
                Baixar PNG
              </Button>
              <Button variant="outline" onClick={onSave} disabled={saving}>
                {saving ? <Loader2 className="animate-spin" /> : null}
                {saving ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <BannerEditor config={draft} onChange={onConfigChange} onReset={onReset} />
          </div>
        </div>
      </div>
    </section>
  );
}
