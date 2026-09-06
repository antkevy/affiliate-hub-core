import { useEffect, useRef } from "react";
import { automationsService } from "@/services/automations";
import { automationConfigOf } from "@/lib/automation-config";
import type { Automation } from "@/types";

/**
 * Agenda a execução das automações ativas enquanto o app estiver aberto,
 * respeitando o intervalo (em minutos) configurado em cada automação.
 *
 * Se a configuração não define interval_minutes, a automação só roda
 * manualmente (não é agendada).
 */
export function useAutomationScheduler(automations: Automation[]): void {
  const running = useRef(new Set<string>());

  useEffect(() => {
    const timers: number[] = [];

    for (const automation of automations) {
      if (automation.status !== "active") continue;
      const config = automationConfigOf(automation);
      const intervalMinutes = config.interval_minutes;
      if (intervalMinutes === null || intervalMinutes <= 0) continue;

      const id = window.setInterval(() => {
        if (running.current.has(automation.id)) return;
        running.current.add(automation.id);
        automationsService
          .run(automation.id)
          .catch(() => undefined)
          .finally(() => running.current.delete(automation.id));
      }, intervalMinutes * 60_000);
      timers.push(id);
    }

    return () => {
      for (const id of timers) window.clearInterval(id);
    };
  }, [automations]);
}
