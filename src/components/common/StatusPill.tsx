import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONES: Record<StatusTone, string> = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-primary/10 text-primary border-primary/20",
  neutral: "bg-secondary text-muted-foreground border-border",
};

export function StatusPill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function entityTone(status: string | null | undefined): StatusTone {
  switch (status) {
    case "active":
    case "published":
    case "approved":
    case "sent":
    case "completed":
    case "connected":
      return "success";
    case "paused":
    case "pending":
    case "processing":
    case "queued":
      return "warning";
    case "error":
    case "failed":
    case "rejected":
      return "danger";
    default:
      return "neutral";
  }
}
