// ============================================================
// Offer Engine - Platform Connectors
//
// Interface + architecture for platform integrations.
// Real integrations are NOT implemented or simulated. When a
// connector is not configured it reports NOT_CONNECTED.
// ============================================================

import type { IncomingMessage, PublicationPayload, PublicationResult } from "@/lib/engine/types";

export type ConnectorStatus = "CONNECTED" | "NOT_CONNECTED" | "ERROR" | "DISCONNECTED";

export interface PlatformConnector {
  platform: string;
  connect(): Promise<ConnectorStatus>;
  disconnect(): Promise<void>;
  getStatus(): ConnectorStatus;
  receiveMessage(): Promise<IncomingMessage | null>;
  publishMessage(payload: PublicationPayload): Promise<PublicationResult>;
  publishMedia(media: { type: string; url: string }): Promise<PublicationResult>;
}

abstract class BaseConnector implements PlatformConnector {
  abstract platform: string;
  protected status: ConnectorStatus = "NOT_CONNECTED";

  async connect(): Promise<ConnectorStatus> {
    // Not implemented yet. Requires official API + credentials.
    return "NOT_CONNECTED";
  }

  async disconnect(): Promise<void> {
    this.status = "NOT_CONNECTED";
  }

  getStatus(): ConnectorStatus {
    return this.status;
  }

  async receiveMessage(): Promise<IncomingMessage | null> {
    return null;
  }

  async publishMessage(_payload: PublicationPayload): Promise<PublicationResult> {
    return { ok: false, errorMessage: "connector_not_connected" };
  }

  async publishMedia(_media: { type: string; url: string }): Promise<PublicationResult> {
    return { ok: false, errorMessage: "connector_not_connected" };
  }
}

export class TelegramConnector extends BaseConnector {
  platform = "telegram";
}

export class WhatsAppConnector extends BaseConnector {
  platform = "whatsapp";
}

export class ApiConnector extends BaseConnector {
  platform = "api";
}

export const connectorRegistry: Record<string, PlatformConnector> = {
  telegram: new TelegramConnector(),
  whatsapp: new WhatsAppConnector(),
  api: new ApiConnector(),
};

export function getConnector(platform: string): PlatformConnector {
  return connectorRegistry[platform] || new TelegramConnector();
}

export function isConnected(platform: string): boolean {
  return getConnector(platform).getStatus() === "CONNECTED";
}
