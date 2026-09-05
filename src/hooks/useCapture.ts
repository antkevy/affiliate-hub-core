import { useState } from "react";
import { toast } from "sonner";
import { runCapture, type CaptureReport } from "@/lib/capture";
import { toUserMessage } from "@/services/base";

/** Executa um ciclo de captura/publicação com estado e feedback de toast. */
export function useCapture() {
  const [running, setRunning] = useState(false);

  async function run(): Promise<CaptureReport | null> {
    setRunning(true);
    try {
      const report = await runCapture();
      toast.success("Captura concluída", { description: captureSummary(report) });
      return report;
    } catch (error) {
      toast.error("Não foi possível executar a captura", {
        description: toUserMessage(error),
      });
      return null;
    } finally {
      setRunning(false);
    }
  }

  return { running, run };
}

export function captureSummary(report: CaptureReport): string {
  const parts = [
    report.offersCaptured > 0 ? `${report.offersCaptured} oferta(s) capturada(s)` : "",
    report.offersPublished > 0 ? `${report.offersPublished} publicada(s)` : "",
    report.offersIgnored > 0 ? `${report.offersIgnored} duplicada(s)` : "",
    report.offersFailed > 0 ? `${report.offersFailed} com erro` : "",
  ].filter(Boolean);
  const base = parts.length === 0 ? "Nada novo encontrado" : parts.join(" · ");
  return report.errors.length > 0 ? `${base} · ${report.errors.length} aviso(s)` : base;
}
