"use client";

import { Route, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDart, getCheckoutSuggestions } from "@/engine";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/store";

type CheckoutSuggestionsProps = Readonly<{
  className?: string;
  maxRoutes?: number;
}>;

function routeLabel(route: readonly Parameters<typeof formatDart>[0][]): string {
  return route.map(formatDart).join(" → ");
}

export function CheckoutSuggestions({
  className,
  maxRoutes = 3,
}: CheckoutSuggestionsProps) {
  const scoring = useTranslations("Scoring");
  const gameState = useGameStore((state) => state.gameState);
  const activePlayer = gameState?.players.find((player) => player.id === gameState.activePlayerId);
  const remainingScore = activePlayer?.modeState.mode === "x01"
    ? activePlayer.modeState.remainingScore
    : null;
  const routes = useMemo(() => {
    if (remainingScore === null) {
      return [];
    }

    return getCheckoutSuggestions(remainingScore).slice(0, maxRoutes);
  }, [maxRoutes, remainingScore]);

  return (
    <Card
        className={cn("border-primary/20 bg-card/90 shadow-xl shadow-primary/5", className)}
      data-testid="checkout-suggestions"
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Badge variant="outline" className="bg-background/70 uppercase tracking-[0.18em] text-primary">
              <Sparkles className="size-3" aria-hidden="true" />
              {scoring("checkoutSuggestions")}
            </Badge>
            <div className="space-y-1">
              <CardTitle className="text-xl tracking-tight">{scoring("checkoutTitle")}</CardTitle>
              <CardDescription>
                {remainingScore === null
                  ? scoring("checkoutX01Only")
                  : scoring("checkoutFor", { player: activePlayer?.name ?? scoring("activePlayer"), score: remainingScore })}
              </CardDescription>
            </div>
          </div>
          <Route className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent>
        {routes.length > 0 ? (
          <ol className="space-y-2">
            {routes.map((checkoutRoute, index) => (
              <li
                key={`${remainingScore}-${routeLabel(checkoutRoute)}-${index}`}
                 className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/65 px-4 py-3"
              >
                <span className="text-sm font-medium text-muted-foreground">
                  {scoring("routeNumber", { number: index + 1 })}
                </span>
                 <span className="font-mono text-xl font-black tracking-tight">{routeLabel(checkoutRoute)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-xl border border-dashed border-primary/20 bg-background/55 px-4 py-6 text-center text-sm text-muted-foreground">
            {remainingScore === null ? scoring("checkoutX01Only") : scoring("noCheckout")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
