"use client";

import { Activity, Crown, Target } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDart } from "@/engine";
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

function formattedTurn(player: PlayerState, emptyLabel: string): string {
  if (player.currentTurn.length === 0) {
    return emptyLabel;
  }

  return player.currentTurn.map(formatDart).join(" · ");
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

  return (
    <section className={cn("space-y-4", className)} aria-labelledby="score-display-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Badge variant="outline" className="bg-background/70 uppercase tracking-[0.18em] text-primary">
            <Activity className="size-3" aria-hidden="true" />
            {scoring("scoreboardKicker")}
          </Badge>
          <h2 id="score-display-title" className="text-2xl font-black tracking-tight sm:text-3xl">
            {scoring("scoreboardTitle")}
          </h2>
        </div>
        <Badge variant="secondary">
          {scoring("legSetCounter", { leg: gameState.currentLeg, set: gameState.currentSet })}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        {gameState.players.map((player, index) => {
          const isActive = player.id === gameState.activePlayerId;
          const primaryMetric = primaryMetricFor(player, (key) => scoring(key));
          const secondaryMetric = secondaryMetricFor(player, (key) => scoring(key));

          return (
            <Card
              key={player.id}
              className={cn(
                "overflow-hidden border-border/70 bg-card/90 py-0 shadow-lg shadow-primary/5 transition-[border-color,background-color,box-shadow,transform] duration-200",
                isActive && "border-primary/60 bg-primary/10 shadow-2xl shadow-primary/20",
              )}
            >
              <CardHeader className="border-b border-border/70 bg-background/55 p-3 sm:p-5">
                <div className="flex flex-col gap-2 sm:gap-3">
                  <div className="space-y-1">
                    <CardTitle className="flex min-w-0 items-center gap-1.5 text-base sm:text-xl">
                      {isActive ? <Crown className="size-4 shrink-0 text-primary sm:size-5" aria-hidden="true" /> : null}
                      <span className="truncate">{player.name}</span>
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      {isActive ? scoring("currentPlayer") : scoring("waitingPlayer")}
                    </CardDescription>
                  </div>
                  <Badge variant={isActive ? "default" : "outline"} className="max-w-full text-[0.65rem] sm:text-xs">
                    {player.isBot ? scoring("botPlayer") : scoring("humanPlayer")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-3 sm:space-y-4 sm:p-5">
                <div className="grid gap-2 sm:gap-3">
                  <div className="min-w-0">
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-muted-foreground sm:text-sm sm:tracking-[0.14em]">{primaryMetric.label}</p>
                    <p
                      className="font-mono text-5xl font-black leading-none tracking-tight text-foreground min-[360px]:text-6xl sm:text-7xl"
                      data-testid={`score-player-${index + 1}`}
                    >
                      {primaryMetric.value}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/65 px-2 py-1.5 sm:rounded-2xl sm:px-3 sm:py-2">
                    <p className="text-xs text-muted-foreground">{secondaryMetric.label}</p>
                    <p className="text-base font-semibold sm:text-lg">{secondaryMetric.value}</p>
                  </div>
                </div>

                <div className="grid gap-2 rounded-xl border border-border/70 bg-background/65 p-2.5 sm:rounded-2xl sm:p-4">
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:gap-2 sm:text-sm">
                      <Target className="size-3.5 sm:size-4" aria-hidden="true" />
                      {scoring("currentDarts")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {scoring("totalDarts", { count: player.dartsThrown })}
                    </span>
                  </div>
                  <p className="font-mono text-xl font-black tracking-tight" data-testid={`darts-player-${index + 1}`}>
                    {formattedTurn(player, scoring("noDarts"))}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
