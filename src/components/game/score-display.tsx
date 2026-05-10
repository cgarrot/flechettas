"use client";

import { Activity, Crown, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { formatDart, getCheckoutSuggestions } from "@/engine";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/store";

import type { PlayerState } from "@/types";

type ScoreDisplayProps = Readonly<{
  className?: string;
}>;

type PrimaryMetric = Readonly<{
  label: string;
  value: string;
}>;

function primaryMetricFor(player: PlayerState, label: (key: string) => string): PrimaryMetric {
  switch (player.modeState.mode) {
    case "x01":
      return { label: label("remaining"), value: String(player.modeState.remainingScore) };
    case "cricket":
      return { label: label("points"), value: String(player.modeState.points) };
    case "around-the-clock":
      return { label: label("currentTarget"), value: String(player.modeState.currentTarget) };
    case "bobs-27":
      return { label: label("score"), value: String(player.modeState.score) };
    case "checkout-121":
      return { label: label("remaining"), value: String(player.modeState.remainingTargetScore) };
    case "shanghai":
      return { label: label("score"), value: String(player.modeState.score) };
    case "training":
      return { label: label("hits"), value: String(player.modeState.hits) };
    case "killer":
      return { label: label("lives"), value: String(player.modeState.lives) };
  }
}

function isPlayerState(player: PlayerState | undefined): player is PlayerState {
  return player !== undefined;
}

function routeLabel(route: ReturnType<typeof getCheckoutSuggestions>[number]): string {
  return route.map(formatDart).join(" · ");
}

function ordinalLabel(rank: number, locale: string): string {
  if (locale === "fr") {
    return rank === 1 ? "1er" : `${rank}e`;
  }

  const tens = rank % 100;

  if (tens >= 11 && tens <= 13) {
    return `${rank}th`;
  }

  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}

export function ScoreDisplay({ className }: ScoreDisplayProps) {
  const locale = useLocale();
  const scoring = useTranslations("Scoring");
  const gameState = useGameStore((state) => state.gameState);
  const eventLog = useGameStore((state) => state.eventLog);

  if (!gameState) {
    return (
      <Card className={cn("border-dashed border-primary/20 bg-card/75", className)}>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {scoring("noActiveGame")}
        </CardContent>
      </Card>
    );
  }

  const activePlayer = gameState.players.find((player) => player.id === gameState.activePlayerId);

  if (!activePlayer) {
    return (
      <Card className={cn("border-dashed border-primary/20 bg-card/75", className)}>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {scoring("noActiveGame")}
        </CardContent>
      </Card>
    );
  }

  const activePlayerIndex = gameState.players.findIndex((player) => player.id === activePlayer.id);
  const activeOrderIndex = gameState.playerOrder.indexOf(activePlayer.id);
  const orderedWaitingPlayers = activeOrderIndex >= 0
    ? [
      ...gameState.playerOrder.slice(activeOrderIndex + 1),
      ...gameState.playerOrder.slice(0, activeOrderIndex),
    ]
      .map((playerId) => gameState.players.find((player) => player.id === playerId))
      .filter(isPlayerState)
    : gameState.players.filter((player) => player.id !== activePlayer.id);
  const activePrimaryMetric = primaryMetricFor(activePlayer, (key) => scoring(key));
  const checkoutRoutes = activePlayer.modeState.mode === "x01"
    ? getCheckoutSuggestions(activePlayer.modeState.remainingScore).slice(0, 2)
    : [];
  const finishedRankByPlayerId = new Map<string, number>();

  for (const event of eventLog) {
    if (event.type === "match_won" && !finishedRankByPlayerId.has(event.playerId)) {
      finishedRankByPlayerId.set(event.playerId, finishedRankByPlayerId.size + 1);
    }
  }

  return (
    <section className={cn("space-y-1.5 sm:space-y-4", className)} aria-labelledby="score-display-title">
      <h2 id="score-display-title" className="sr-only">
        {scoring("scoreboardTitle")}
      </h2>

      <Card className="overflow-hidden border-primary/20 bg-card/95 py-0 shadow-2xl shadow-primary/10">
        <CardContent className="grid grid-cols-[0.88fr_1.12fr] gap-1.5 p-2 sm:gap-4 sm:p-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="min-w-0 rounded-2xl border border-border/70 bg-background/60 p-2 sm:p-4">
            <div className="mb-2 flex items-center justify-between gap-2 sm:mb-3">
              <Badge variant="outline" className="bg-card/80 text-[0.62rem] uppercase tracking-[0.14em] text-primary sm:text-xs">
                <Activity className="size-3" aria-hidden="true" />
                {scoring("upNext")}
              </Badge>
              <Badge variant="secondary" className="hidden text-[0.65rem] sm:inline-flex sm:text-xs">
                {scoring("legSetCounter", { leg: gameState.currentLeg, set: gameState.currentSet })}
              </Badge>
            </div>

            <div className="grid gap-1.5 sm:max-h-56 sm:gap-2 sm:overflow-y-auto sm:overscroll-y-contain sm:pr-0.5">
              {orderedWaitingPlayers.length > 0 ? orderedWaitingPlayers.map((player, index) => {
                const primaryMetric = primaryMetricFor(player, (key) => scoring(key));
                const playerIndex = gameState.players.findIndex((candidate) => candidate.id === player.id);
                const finishedRank = finishedRankByPlayerId.get(player.id);

                return (
                  <div key={player.id} className="grid grid-cols-[1.35rem_1fr_auto] items-center gap-1.5 rounded-xl border border-border/70 bg-card/80 px-2 py-1.5 sm:grid-cols-[2rem_1fr_auto] sm:gap-3 sm:px-3 sm:py-2">
                    <span className={cn(
                      "grid h-5 min-w-5 place-items-center rounded-full px-1 text-[0.65rem] font-black sm:h-7 sm:min-w-7 sm:text-xs",
                      finishedRank
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}>
                      {finishedRank ? ordinalLabel(finishedRank, locale) : index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold sm:text-sm">{player.name}</p>
                      <p className="hidden text-[0.68rem] text-muted-foreground sm:block">{primaryMetric.label}</p>
                    </div>
                    <p className="font-mono text-lg font-black leading-none sm:text-2xl" data-testid={`score-player-${playerIndex + 1}`}>
                      {primaryMetric.value}
                    </p>
                  </div>
                );
              }) : (
                <div className="rounded-xl border border-dashed border-primary/20 bg-card/70 px-3 py-4 text-center text-xs text-muted-foreground">
                  {scoring("soloPlayer")}
                </div>
              )}
            </div>
          </div>

          <div className="relative min-w-0 overflow-hidden rounded-2xl border border-primary/45 bg-primary/10 p-2 shadow-2xl shadow-primary/15 sm:p-4">
            <div className="pointer-events-none absolute -right-10 -top-10 size-28 rounded-full bg-primary/15 blur-3xl" aria-hidden="true" />
            <div className="relative flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Badge variant="default" className="text-[0.62rem] uppercase tracking-[0.14em] shadow-lg shadow-primary/20 sm:text-xs">
                  <Crown className="size-3" aria-hidden="true" />
                  {scoring("nowPlaying")}
                </Badge>
                <CardTitle className="mt-1 truncate text-xl font-black tracking-tight sm:text-3xl">
                  {activePlayer.name}
                </CardTitle>
                <CardDescription className="text-[0.65rem] sm:text-xs">
                  {activePlayer.isBot ? scoring("botPlayer") : scoring("humanPlayer")}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="shrink-0 bg-destructive text-[0.62rem] text-destructive-foreground shadow-lg shadow-destructive/20 sm:text-xs">
                {scoring("nextDart", { current: Math.min(3, activePlayer.currentTurn.length + 1), total: 3 })}
              </Badge>
            </div>

            <div className="relative mt-2 grid gap-1.5 sm:mt-3 sm:gap-2">
              <div>
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-muted-foreground sm:text-sm">{activePrimaryMetric.label}</p>
                <p
                  className="text-center font-mono text-6xl font-black leading-none tracking-tight text-foreground min-[380px]:text-7xl sm:text-7xl"
                  data-testid={`score-player-${activePlayerIndex + 1}`}
                >
                  {activePrimaryMetric.value}
                </p>
              </div>

              {checkoutRoutes.length > 0 ? (
                <div className="flex min-w-0 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-background/70 px-2 py-1.5">
                  <Sparkles className="size-3 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 truncate font-mono text-sm font-black tracking-tight sm:text-base">
                    {routeLabel(checkoutRoutes[0])}
                  </span>
                </div>
              ) : null}

            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
