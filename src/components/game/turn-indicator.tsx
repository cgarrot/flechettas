"use client";

import { Bot, CircleDot, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
    <Card className={cn("overflow-hidden border-primary/20 bg-card/95 py-0 shadow-2xl shadow-primary/10", className)} data-testid="turn-indicator">
      <CardContent className="space-y-2 p-2 sm:space-y-4 sm:p-5">
        <div className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-2xl border border-border/70 bg-background/70 px-3 py-2 sm:px-4 sm:py-3" aria-live="polite">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-primary sm:text-xs">{game("turnKicker")}</p>
            <p className="truncate text-lg font-black tracking-tight sm:text-2xl">{activePlayer.name}</p>
          </div>
          <div className="grid justify-items-end gap-1">
            <Badge variant={isBotTurn ? "secondary" : "default"} className="text-[0.65rem] sm:text-xs">
              {isBotTurn ? <Bot className="size-3" aria-hidden="true" /> : <UserRound className="size-3" aria-hidden="true" />}
              {isBotTurn ? game("botTurn") : game("humanTurn")}
            </Badge>
            <p className="font-mono text-2xl font-black leading-none tracking-tight sm:text-4xl" data-testid="dart-counter">
              {game("dartCounter", { current: dartNumber, total: 3 })}
            </p>
          </div>
          <div className="col-span-2 flex gap-1.5" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className={cn(
                  "h-1.5 flex-1 rounded-full border border-border/70 bg-muted text-xs font-black text-muted-foreground sm:h-2",
                  index < currentTurnLength && "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20",
                  index + 1 === dartNumber && currentTurnLength < 3 && "border-accent text-accent shadow-lg shadow-accent/15",
                )}
              >
                <span className="sr-only">{index + 1}</span>
              </span>
            ))}
          </div>
        </div>

        {isBotTurn ? (
          <div className="space-y-2 rounded-2xl border border-primary/20 bg-background/65 p-3 sm:space-y-3 sm:p-4" data-testid="bot-turn-state">
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
