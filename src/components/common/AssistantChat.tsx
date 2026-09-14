import { useState, useRef, useEffect } from "react";
import { Bot, Send, Sparkles, X, Loader2 } from "lucide-react";
import type { AIChatMessage } from "@/lib/ai.server";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Como melhorar minha taxa de sucesso?",
  "Sugira um texto para uma oferta com 40% OFF",
  "O que devo analisar na operação?",
];

export function AssistantChat({ context }: { context?: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: AIChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const payload = context ? { messages: next, context } : { messages: next };
      const { chatWithAssistant } = await import("@/lib/ai.server");
      const result = await chatWithAssistant({ data: payload });
      setMessages([
        ...next,
        { role: "assistant", content: result.ok ? (result.text ?? "") : `⚠️ ${result.error}` },
      ]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Falha ao conectar com o assistente." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Fechar assistente" : "Abrir assistente"}
        className={cn(
          "fixed right-4 bottom-4 z-50 grid size-12 place-items-center rounded-full border shadow-lg transition-all duration-300",
          open
            ? "border-border bg-secondary text-foreground hover:bg-secondary/80"
            : "border-primary/30 bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-primary/25",
        )}
      >
        {open ? <X className="size-5" /> : <Sparkles className="size-5" />}
      </button>

      {open ? (
        <div className="fixed right-4 bottom-20 z-50 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-rise">
          <header className="flex items-center justify-between gap-3 border-b border-border bg-secondary/40 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <Bot className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight">Assistente</p>
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-success" />
                  Operação em tempo real
                </p>
              </div>
            </div>
          </header>

          <div ref={scrollRef} className="h-80 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-dashed border-border bg-secondary/20 px-3 py-2.5 text-xs text-muted-foreground">
                  Converse com o assistente: estratégia de copy, análise da operação, ajustes de
                  público. As respostas usam os dados atuais do seu dashboard.
                </div>
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void send(suggestion)}
                    className="block w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-left text-xs text-foreground transition-colors hover:border-primary/25 hover:bg-secondary"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-secondary/50 text-foreground",
                    )}
                  >
                    {message.content}
                  </div>
                </div>
              ))
            )}

            {loading ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Pensando...
                </div>
              </div>
            ) : null}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
            className="flex items-center gap-2 border-t border-border bg-secondary/40 p-3"
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Pergunte ao assistente..."
              className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/40 focus:ring-1 focus:ring-primary/30"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Enviar mensagem"
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
