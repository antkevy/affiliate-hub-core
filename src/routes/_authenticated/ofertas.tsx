import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Tags } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { DataState } from "@/components/common/DataState";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusPill, entityTone } from "@/components/common/StatusPill";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { offersService } from "@/services/offers";
import { OFFER_STATUSES, OFFER_STATUS_LABEL } from "@/types";

export const Route = createFileRoute("/_authenticated/ofertas")({
  head: () => ({
    meta: [
      { title: "Ofertas — Affiliate Hub" },
      { name: "description", content: "Ofertas capturadas, processadas e prontas para publicação." },
      { property: "og:title", content: "Ofertas — Affiliate Hub" },
      {
        property: "og:description",
        content: "Ofertas capturadas, processadas e prontas para publicação.",
      },
    ],
  }),
  component: OffersPage,
});

function OffersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const query = useQuery({
    queryKey: ["offers", search, status],
    queryFn: () =>
      offersService.listWithRelations({
        search,
        ...(status !== "all" ? { status } : {}),
      }),
  });

  return (
    <>
      <PageHeader
        eyebrow="Principal"
        title="Ofertas"
        description="Todas as ofertas capturadas pelas suas fontes e automações."
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Buscar por título"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {OFFER_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {OFFER_STATUS_LABEL[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataState
        isLoading={query.isLoading}
        error={query.error}
        isEmpty={(query.data ?? []).length === 0}
        empty={
          <EmptyState
            icon={Tags}
            title="Nenhuma oferta encontrada"
            description="As ofertas capturadas pelas automações aparecerão aqui."
          />
        }
      >
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Oferta</th>
                <th className="px-4 py-2 font-medium">Preço</th>
                <th className="px-4 py-2 font-medium">Desconto</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Capturada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(query.data ?? []).map((offer) => (
                <tr key={offer.id}>
                  <td className="max-w-xs px-4 py-2.5">
                    <p className="truncate">{offer.title}</p>
                    {offer.coupon ? (
                      <p className="text-xs text-muted-foreground">Cupom {offer.coupon}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{money(offer.sale_price)}</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {offer.discount_percentage ? `${offer.discount_percentage}%` : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusPill tone={entityTone(offer.status)}>
                      {OFFER_STATUS_LABEL[offer.status]}
                    </StatusPill>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {new Date(offer.captured_at).toLocaleString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>
    </>
  );
}

function money(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
