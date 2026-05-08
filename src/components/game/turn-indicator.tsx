"use client";

import { Bot, CircleDot, Dices, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDart } from "@/engine";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/store";

import type { Dart, PlayerId } from "@/types";

export type BotPlaybackState = Readonly<{
  playerId: PlayerId;
  turnKey: string;
  darts: readonly Dart[];
  status: "thinking" | "throwing";
}>;

type TurnIndicatorProps = Readonly<{
  botPlayback?: BotPlaybackState | null;
  className?: string;
}>;

function nextDartNumber(currentTurnLength: number): number {
  return Math.min(3, currentTurnLength + 1);
}

export function TurnIndicator({ botPlayback, className }: TurnIndicatorProps) {
  const game = useTranslations("Game");
  const gameState = useGameStore((state) => state.gameState);
  const activePlayer = gameState?.players.find((player) => player.id === gameState.activePlayerId);
  const currentTurnLength = activePlayer?.currentTurn.length ?? gameState?.currentTurn.length ?? 0;
  const dartNumber = nextDartNumber(currentTurnLength);
  const isBotTurn = Boolean(activePlayer?.isBot);
  const isCurrentBotPlayback = isBotTurn && botPlayback?.playerId === activePlayer?.id;
  const currentBotPlayback = isCurrentBotPlayback && botPlayback ? botPlayback : null;

  if (!gameState || !activePlayer) {
    return (
      <Card className={cn("border-dashed border-primary/20 bg-card/75", className)}>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {game("noTurnLoaded")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden border-primary/20 bg-card/95 shadow-2xl shadow-primary/10", className)} data-testid="turn-indicator">
      <CardHeader className="border-b border-border/70 bg-background/55">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant="outline" className="bg-card/80 uppercase tracking-[0.18em] text-primary">
            <Dices className="size-3" aria-hidden="true" />
            {game("turnKicker")}
          </Badge>
          <Badge variant={isBotTurn ? "secondary" : "default"}>
            {isBotTurn ? <Bot className="size-3" aria-hidden="true" /> : <UserRound className="size-3" aria-hidden="true" />}
            {isBotTurn ? game("botTurn") : game("humanTurn")}
          </Badge>
        </div>
        <CardTitle className="text-2xl tracking-tight sm:text-3xl">{activePlayer.name}</CardTitle>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{game("dartCounterLabel")}</p>
            <p className="font-mono text-6xl font-black leading-none tracking-tight" data-testid="dart-counter">
              {game("dartCounter", { current: dartNumber, total: 3 })}
            </p>
          </div>
          <div className="flex gap-2" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className={cn(
                  "grid size-10 place-items-center rounded-full border border-border/70 bg-background/65 text-xs font-black text-muted-foreground",
                  index < currentTurnLength && "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20",
                  index + 1 === dartNumber && currentTurnLength < 3 && "border-accent text-accent shadow-lg shadow-accent/15",
                )}
              >
                {index + 1}
              </span>
            ))}
          </div>
        </div>

        {isBotTurn ? (
          <div className="space-y-3 rounded-2xl border border-primary/20 bg-background/65 p-4" data-testid="bot-turn-state">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CircleDot className="size-4 animate-pulse text-primary" aria-hidden="true" />
                {currentBotPlayback?.status === "throwing" ? game("botThrowing") : game("botThinking")}
              </p>
              <Badge variant="outline" className="bg-card/80">
                {game("botAutoPlay")}
              </Badge>
            </div>

            {currentBotPlayback && currentBotPlayback.darts.length > 0 ? (
              <ol className="grid gap-2 sm:grid-cols-3">
                {currentBotPlayback.darts.map((dart, index) => (
                  <li key={`${currentBotPlayback.turnKey}-${index}`} className="rounded-xl border border-border/70 bg-card/80 px-3 py-2 text-center">
                    <span className="block text-xs text-muted-foreground">{game("botDartNumber", { number: index + 1 })}</span>
                    <span className="text-lg font-semibold">{formatDart(dart)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">{game("botPauseHint")}</p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
