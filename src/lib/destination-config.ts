import { type Destination, type DestinationType, type Json } from "@/types";

export interface DestinationFormValues {
  name: string;
  type: DestinationType;
  botToken: string;
  chatId: string;
  webhookUrl: string;
  notes: string;
}

export interface DestinationCredentials {
  token?: string | null;
  chat_id?: string | null;
  url?: string | null;
  notes?: string | null;
}

export function destinationConfiguration(destination: Destination): DestinationCredentials {
  return typeof destination.configuration === "object" && destination.configuration !== null
    ? (destination.configuration as DestinationCredentials)
    : {};
}

export function buildDestinationConfiguration(values: DestinationFormValues): Json {
  const base: DestinationCredentials = {
    notes: values.notes.trim() ? values.notes.trim() : null,
  };
  if (values.type === "other") {
    base.url = values.webhookUrl.trim() ? values.webhookUrl.trim() : null;
  } else {
    base.token = values.botToken.trim() ? values.botToken.trim() : null;
    base.chat_id = values.chatId.trim() ? values.chatId.trim() : null;
  }
  return base as Json;
}

export function initialDestinationForm(
  destination: Destination | null | undefined,
): DestinationFormValues {
  if (!destination) {
    return {
      name: "",
      type: "telegram",
      botToken: "",
      chatId: "",
      webhookUrl: "",
      notes: "",
    };
  }
  const config = destinationConfiguration(destination);
  return {
    name: destination.name,
    type: destination.type,
    botToken: config.token ?? "",
    chatId: config.chat_id ?? "",
    webhookUrl: config.url ?? "",
    notes: typeof config.notes === "string" ? config.notes : "",
  };
}
