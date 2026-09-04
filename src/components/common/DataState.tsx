import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DataStateProps {
  isLoading: boolean;
  error: unknown;
  isEmpty?: boolean;
  empty?: ReactNode;
  children: ReactNode;
  rows?: number;
}

export function DataState({
  isLoading,
  error,
  isEmpty = false,
  empty = null,
  children,
  rows = 4,
}: DataStateProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel flex items-start gap-3 p-5">
        <AlertTriangle className="mt-0.5 size-4 text-destructive" />
        <div>
          <p className="text-sm font-medium">Não foi possível carregar os dados</p>
          <p className="text-sm text-muted-foreground">
            Verifique sua conexão e tente novamente em instantes.
          </p>
        </div>
      </div>
    );
  }

  if (isEmpty) return <>{empty}</>;
  return <>{children}</>;
}
