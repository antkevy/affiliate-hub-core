import { useRef, useState, type RefObject } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ImagePlus, Image as ImageIcon, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataState } from "@/components/common/DataState";
import { EmptyState } from "@/components/common/EmptyState";
import { CreateEntityDialog } from "@/components/common/CreateEntityDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
    setDraft(bannerConfigOf(banner));
    setName(banner.name);
  }

  function closeEditor() {
    setEditing(null);
    setDraft(null);
  }

  function applyTemplate(templateId: string) {
    const template = BANNER_TEMPLATES.find((item) => item.id === templateId);
    if (template) setDraft({ ...template.defaultConfig });
  }

  function resetDraft() {
    if (editing) setDraft(bannerConfigOf(editing));
  }

  async function saveBanner() {
    if (!editing || !draft) return;
    setSaving(true);
    try {
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

  async function generateImage() {
    if (!editing || !draft || !canvasRef.current) return;
    setGenerating(true);
    try {
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
          <SavedBannersGrid banners={query.data ?? []} onSelectEdit={edit} onDelete={setDeleting} />
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
            <div className="space-y-1.5">
              <Label htmlFor="banner-name">Nome do banner</Label>
              <Input
                id="banner-name"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                className="sm:w-60"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="banner-template">Template visual</Label>
              <Select value={draft.templateId} onValueChange={onTemplateChange}>
                <SelectTrigger id="banner-template" className="sm:w-56">
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
              <div className="flex min-h-[420px] items-center justify-center overflow-hidden rounded-md">
                <div className="w-full max-w-md">
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
