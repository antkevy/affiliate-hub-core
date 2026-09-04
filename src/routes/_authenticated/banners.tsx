import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { DataState } from "@/components/common/DataState";
import { EmptyState } from "@/components/common/EmptyState";
import { CreateEntityDialog } from "@/components/common/CreateEntityDialog";
import { Button } from "@/components/ui/button";
import { bannersService } from "@/services/banners";
import { toUserMessage } from "@/services/base";

export const Route = createFileRoute("/_authenticated/banners")({
  head: () => ({
    meta: [
      { title: "Banners — Affiliate Hub" },
      { name: "description", content: "Modelos visuais para acompanhar as publicações de ofertas." },
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

  return (
    <>
      <PageHeader
        eyebrow="Conteúdo"
        title="Banners"
        description="Modelos visuais aplicados às ofertas. A geração de imagem será configurada posteriormente."
        actions={
          <CreateEntityDialog
            title="Novo banner"
            fields={[
              { key: "name", label: "Nome", required: true, placeholder: "Banner promocional" },
              { key: "description", label: "Descrição", type: "textarea" },
            ]}
            onSubmit={(get) =>
              bannersService.create({
                name: get("name"),
                description: get("description") || null,
                configuration: {},
              })
            }
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ["banners"] })}
          />
        }
      />

      <DataState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={(query.data ?? []).length === 0}
        empty={
          <EmptyState
            icon={ImageIcon}
            title="Nenhum banner criado"
            description="Crie um modelo de banner para usar nas publicações."
          />
        }
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(query.data ?? []).map((banner) => (
            <div key={banner.id} className="panel space-y-3 p-4">
              <div className="flex aspect-[16/9] items-center justify-center rounded-md bg-secondary">
                <ImageIcon className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="truncate text-sm font-medium">{banner.name}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {banner.description ?? "Sem descrição"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    try {
                      bannersService.generateImage();
                    } catch (error) {
                      toast.info(toUserMessage(error));
                    }
                  }}
                >
                  Gerar imagem
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await bannersService.remove(banner.id);
                    queryClient.invalidateQueries({ queryKey: ["banners"] });
                  }}
                >
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DataState>
    </>
  );
}
