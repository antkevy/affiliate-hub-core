import { createCrud, notImplemented } from "./base";

export const publicationsService = {
  ...createCrud("publications"),

  /** Publicação real nos destinos configurados. */
  publishNow(): never {
    return notImplemented("publicação automática");
  },
};

export const jobsService = createCrud("jobs");
export const auditLogsService = createCrud("audit_logs");
