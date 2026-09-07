import { useEffect, useState, useId } from "react";
import { Link } from "@tanstack/react-router";
import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
  spark,
  sparkColor,
  delta,
  delay = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  hint: string;
  accent: string;
  spark?: number[];
  sparkColor?: string;
  delta?: { current: number; previous: number };
  delay?: number;
}) {
  const count = useCountUp(value);

  return (
    <div
      className="panel relative overflow-hidden p-4 animate-rise transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 active:scale-[0.99]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg border", accent)}>
            <Icon className="size-4" />
          </span>
          <p className="truncate text-[13px] font-medium text-muted-foreground">{label}</p>
        </div>
        {spark && sparkColor ? <Sparkline data={spark} color={sparkColor} /> : null}
      </div>

      <p className="mt-3 font-mono text-[1.75rem] font-semibold leading-none tabular-nums">
        {count}
      </p>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="truncate text-xs text-subtle-foreground">{hint}</p>
        {delta ? (
          <Delta current={delta.current} previous={delta.previous} />
        ) : (
          <span className="shrink-0 text-[11px] text-subtle-foreground">—</span>
        )}
      </div>
    </div>
  );
}

export function LiveBadge({
  active,
  idleLabel,
  to,
}: {
  active: number;
  idleLabel: string;
  to?: string;
}) {
  const content =
    active === 0 ? (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
        {idleLabel}
      </span>
    ) : (
      <span className="inline-flex items-center gap-2 rounded-full border border-success/25 bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success transition-colors hover:bg-success/15">
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-success animate-pulse-dot" />
          <span className="relative inline-flex size-2 rounded-full bg-success" />
        </span>
        AO VIVO · {active}
      </span>
    );

  if (to && active > 0) {
    return (
      <Link to={to} className="rounded-full">
        {content}
      </Link>
    );
  }
  return content;
}

export function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(minutes)) return "—";
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `há ${days} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function formatPrice(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined) return "—";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency || "BRL",
    }).format(value);
  } catch {
    return String(value);
  }
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const id = useId();
  const gradientId = `spark-${id}`;
  const series = data.map((value, index) => ({ index, value }));
  const hasData = series.some((point) => point.value > 0);

  if (!hasData) {
    return (
      <div className="flex h-9 w-22 items-center text-[11px] text-subtle-foreground">
        sem histórico
      </div>
    );
  }

  return (
    <div className="h-9 w-22 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous <= 0) {
    return current > 0 ? (
      <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-success">
        novo
      </span>
    ) : (
      <span className="shrink-0 text-[11px] text-subtle-foreground">—</span>
    );
  }
  const pct = ((current - previous) / previous) * 100;
  const up = pct >= 0;
  const Trend = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 font-mono text-xs font-medium",
        up ? "text-success" : "text-destructive",
      )}
    >
      <Trend className="size-3.5" />
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const reduce = usePrefersReducedMotion();

  useEffect(() => {
    if (reduce) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduce]);

  return value;
}

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduce(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return reduce;
}
