"use client";

import { Activity, Crown } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
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

function secondaryMetricFor(player: PlayerState, label: (key: string) => string): PrimaryMetric {
  switch (player.modeState.mode) {
    case "x01":
      return { label: label("dartsInLeg"), value: String(player.modeState.dartsThrownInLeg) };
    case "cricket":
      return { label: label("closedTargets"), value: String(player.modeState.closedTargets.length) };
    case "around-the-clock":
      return { label: label("hits"), value: String(player.modeState.hits) };
    case "bobs-27":
      return { label: label("currentDouble"), value: String(player.modeState.currentDouble) };
    case "checkout-121":
      return { label: label("targetScore"), value: String(player.modeState.currentTargetScore) };
    case "shanghai":
      return { label: label("round"), value: String(player.modeState.round) };
    case "training":
      return { label: label("attempts"), value: String(player.modeState.attempts) };
    case "killer":
      return { label: label("kills"), value: String(player.modeState.kills) };
  }
}

function isPlayerState(player: PlayerState | undefined): player is PlayerState {
  return player !== undefined;
}

export function ScoreDisplay({ className }: ScoreDisplayProps) {
  const scoring = useTranslations("Scoring");
  const gameState = useGameStore((state) => state.gameState);

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
  const activeSecondaryMetric = secondaryMetricFor(activePlayer, (key) => scoring(key));

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

            <div className="grid max-h-36 gap-1.5 overflow-y-auto pr-0.5 sm:max-h-56 sm:gap-2">
              {orderedWaitingPlayers.length > 0 ? orderedWaitingPlayers.map((player, index) => {
                const primaryMetric = primaryMetricFor(player, (key) => scoring(key));
                const playerIndex = gameState.players.findIndex((candidate) => candidate.id === player.id);

                return (
                  <div key={player.id} className="grid grid-cols-[1.35rem_1fr_auto] items-center gap-1.5 rounded-xl border border-border/70 bg-card/80 px-2 py-1.5 sm:grid-cols-[2rem_1fr_auto] sm:gap-3 sm:px-3 sm:py-2">
                    <span className="grid size-5 place-items-center rounded-full bg-muted text-[0.65rem] font-black text-muted-foreground sm:size-7 sm:text-xs">
                      {index + 1}
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

          <div className="min-w-0 rounded-2xl border border-primary/50 bg-primary/15 p-2 shadow-2xl shadow-primary/15 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <Badge variant="default" className="text-[0.62rem] uppercase tracking-[0.14em] sm:text-xs">
                  <Crown className="size-3" aria-hidden="true" />
                  {scoring("nowPlaying")}
                </Badge>
                <CardTitle className="truncate text-xl font-black tracking-tight sm:text-4xl">
                  {activePlayer.name}
                </CardTitle>
                <CardDescription className="text-[0.68rem] sm:text-sm">
                  {activePlayer.isBot ? scoring("botPlayer") : scoring("humanPlayer")}
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-[0.62rem] sm:hidden">
                {scoring("nextDart", { current: Math.min(3, activePlayer.currentTurn.length + 1), total: 3 })}
              </Badge>
            </div>

            <div className="mt-2 grid gap-2 sm:mt-5 sm:gap-3">
              <div>
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-muted-foreground sm:text-sm">{activePrimaryMetric.label}</p>
                <p
                  className="font-mono text-6xl font-black leading-none tracking-tight text-foreground min-[380px]:text-7xl sm:text-8xl"
                  data-testid={`score-player-${activePlayerIndex + 1}`}
                >
                  {activePrimaryMetric.value}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-1.5 sm:gap-3">
                <div className="rounded-xl border border-border/70 bg-background/70 px-2 py-1.5 sm:rounded-2xl sm:px-3 sm:py-2">
                  <p className="truncate text-[0.62rem] text-muted-foreground sm:text-xs">{activeSecondaryMetric.label}</p>
                  <p className="font-mono text-base font-black sm:text-xl">{activeSecondaryMetric.value}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/70 px-2 py-1.5 sm:rounded-2xl sm:px-3 sm:py-2">
                  <p className="truncate text-[0.62rem] text-muted-foreground sm:text-xs">
                    {scoring("legSetCounter", { leg: gameState.currentLeg, set: gameState.currentSet })}
                  </p>
                  <p className="font-mono text-base font-black sm:text-xl">
                    {scoring("round")} {gameState.currentRound}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
