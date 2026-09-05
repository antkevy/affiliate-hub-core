import { createCrud } from "./base";
import { runCapture, type CaptureReport } from "@/lib/capture";

export const publicationsService = {
  ...createCrud("publications"),

  /** Publicação real nos destinos configurados. */
  publishNow(): Promise<CaptureReport> {
    return runCapture();
  },
};

export const jobsService = createCrud("jobs");
export const auditLogsService = createCrud("audit_logs");
