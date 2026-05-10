"use client";

import { BarChart3, Home, Play, RotateCcw, Trophy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { computeMatchSummary, latestMatchWonPlayerId } from "@/stats";
import { useGameStore, canContinueAfterWinner } from "@/store";

import type { GameConfig, GameState, PlayerDef } from "@/types";

type Locale = "fr" | "en";

type MatchEndProps = Readonly<{
  locale: Locale;
}>;

function homeRouteFor(locale: Locale): string {
  return `/${locale}`;
}

function gameRouteFor(locale: Locale): string {
  return locale === "fr" ? "/fr/partie" : "/en/game";
}

function historyRouteFor(locale: Locale): string {
  return locale === "fr" ? "/fr/historique" : "/en/history";
}

function playerDefsFromGameState(gameState: GameState): readonly PlayerDef[] {
  if (gameState.config.players.length > 0) {
    return gameState.config.players;
  }

  return gameState.players.map((player) => ({
    id: player.id,
    name: player.name,
    isBot: player.isBot,
    botLevel: player.botLevel,
  }));
}

function configWithPlayers(config: GameConfig, players: readonly PlayerDef[]): GameConfig {
  switch (config.mode) {
    case "x01":
      return { ...config, players };
    case "cricket":
      return { ...config, players };
    case "around-the-clock":
      return { ...config, players };
    case "bobs-27":
      return { ...config, players };
    case "checkout-121":
      return { ...config, players };
    case "shanghai":
      return { ...config, players };
    case "training":
      return { ...config, players };
    case "killer":
      return { ...config, players };
  }
}

export function MatchEnd({ locale }: MatchEndProps) {
  const game = useTranslations("Game");
  const router = useRouter();
  const gameState = useGameStore((state) => state.gameState);
  const eventLog = useGameStore((state) => state.eventLog);
  const finishGame = useGameStore((state) => state.finishGame);
  const continueAfterWinner = useGameStore((state) => state.continueAfterWinner);
  const newGame = useGameStore((state) => state.newGame);
  const autoContinueInFlight = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoContinueBlocked, setIsAutoContinueBlocked] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const summary = useMemo(() => {
    if (!gameState) {
      return null;
    }

    return computeMatchSummary(eventLog, gameState.playerOrder, gameState.mode);
  }, [eventLog, gameState]);
  const canContinue = useMemo(
    () => canContinueAfterWinner(gameState, eventLog),
    [eventLog, gameState],
  );
  const matchWonCount = useMemo(
    () => eventLog.filter((event) => event.type === "match_won").length,
    [eventLog],
  );
  const hasContinuedMatch = useMemo(
    () => eventLog.some((event) => event.type === "match_continued"),
    [eventLog],
  );
  const isMatchComplete = gameState?.phase === "match-complete";
  const shouldAutoContinue = Boolean(isMatchComplete && canContinue && hasContinuedMatch && !isAutoContinueBlocked);
  const isOpen = Boolean(isMatchComplete && !shouldAutoContinue);
  const headlineWinnerId = summary?.winnerId ?? latestMatchWonPlayerId(eventLog);
  const winnerName =
    summary?.playerStats.find((stats) => stats.playerId === headlineWinnerId)?.playerName ??
    game("winnerFallback");
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    [locale],
  );

  useEffect(() => {
    if (gameState?.phase === "playing") {
      setIsAutoContinueBlocked(false);
    }
  }, [gameState?.phase]);

  useEffect(() => {
    if (!shouldAutoContinue || autoContinueInFlight.current) {
      return;
    }

    autoContinueInFlight.current = true;

    async function continueAutomatically() {
      try {
        const progressed = await continueAfterWinner();

        if (!progressed) {
          setActionError(game("matchContinueUnavailable"));
          setIsAutoContinueBlocked(true);
        }
      } catch {
        setActionError(game("matchSaveFailed"));
        setIsAutoContinueBlocked(true);
      } finally {
        autoContinueInFlight.current = false;
      }
    }

    void continueAutomatically();
  }, [continueAfterWinner, game, shouldAutoContinue]);

  async function saveCompletedGame(): Promise<GameState | null> {
    const completedState = useGameStore.getState().gameState;

    if (!completedState) {
      return null;
    }

    await finishGame();

    return completedState;
  }

  async function handleRematch() {
    setIsSaving(true);
    setActionError(null);

    try {
      const completedState = await saveCompletedGame();

      if (!completedState) {
        return;
      }

      const players = playerDefsFromGameState(completedState);
      await newGame(configWithPlayers(completedState.config, players), players);
      router.push(gameRouteFor(locale));
    } catch {
      setActionError(game("matchSaveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleHome() {
    setIsSaving(true);
    setActionError(null);

    try {
      await saveCompletedGame();
      router.push(homeRouteFor(locale));
    } catch {
      setActionError(game("matchSaveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStats() {
    setIsSaving(true);
    setActionError(null);

    try {
      await saveCompletedGame();
      router.push(historyRouteFor(locale));
    } catch {
      setActionError(game("matchSaveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleContinue() {
    setIsSaving(true);
    setActionError(null);

    try {
      const progressed = await continueAfterWinner();

      if (!progressed) {
        setActionError(game("matchContinueUnavailable"));
        return;
      }
    } catch {
      setActionError(game("matchSaveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={isOpen}>
      <DialogContent
        className="flex max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-[calc(100vw-1.5rem)] flex-col gap-4 overflow-hidden border-primary/25 bg-card/95 pt-[max(1.5rem,env(safe-area-inset-top))] pr-[max(1.5rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))] shadow-2xl shadow-primary/15 sm:max-h-[min(100dvh,48rem)] sm:max-w-2xl sm:rounded-2xl"
        showCloseButton={false}
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain">
          <DialogHeader className="gap-3 text-left">
            <Badge variant="secondary" className="w-fit uppercase tracking-[0.18em]">
              <Trophy className="size-3" aria-hidden="true" />
              {game("matchCompleteKicker")}
            </Badge>
            <DialogTitle className="text-3xl tracking-tight sm:text-4xl">
              {game("matchWinner", { player: winnerName })}
            </DialogTitle>
            <DialogDescription className="text-base leading-7">
              {matchWonCount > 1 && !canContinue
                ? game("matchFinalStandingsDescription")
                : game("matchCompleteDescription")}
            </DialogDescription>
            {!canContinue ? (
              <p className="text-sm font-medium text-muted-foreground">{game("matchContinueUnavailableHint")}</p>
            ) : null}
          </DialogHeader>

          {summary ? (
            <section className="space-y-3 rounded-2xl border border-primary/20 bg-background/65 p-4" data-testid="match-end-summary">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{game("statsSummaryTitle")}</h3>
                <Badge variant="outline" className="bg-card/80">
                  {game("playerCount", { count: summary.playerStats.length })}
                </Badge>
              </div>
              <div className="grid gap-3">
                {summary.playerStats.map((stats) => (
                  <div key={stats.playerId} className="grid gap-3 rounded-xl border border-border/70 bg-card/80 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <p className="font-medium">{stats.playerName}</p>
                      <p className="text-sm text-muted-foreground">
                        {game("statAverage", { value: numberFormatter.format(stats.average3Dart) })}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-right text-sm">
                      <span className="rounded-lg bg-background/70 px-3 py-2">
                        <span className="block text-xs text-muted-foreground">{game("statHighest")}</span>
                        <span className="font-semibold">{stats.highestTurn}</span>
                      </span>
                      <span className="rounded-lg bg-background/70 px-3 py-2">
                        <span className="block text-xs text-muted-foreground">{game("statDarts")}</span>
                        <span className="font-semibold">{stats.dartsThrown}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {actionError ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive" role="alert">
              {actionError}
            </p>
          ) : null}
        </div>

        <Separator className="shrink-0" />

        <DialogFooter
          className={cn(
            "sticky bottom-0 z-10 shrink-0 gap-2 border-t border-border/40 bg-card/95 pt-3 pb-[max(0.25rem,env(safe-area-inset-bottom))] sm:grid sm:grid-cols-2",
            canContinue ? "lg:grid-cols-4" : "lg:grid-cols-3",
          )}
        >
          {canContinue ? (
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="min-h-12 min-w-0 whitespace-normal rounded-xl px-3 text-center text-xs leading-tight sm:text-sm"
              data-testid="match-end-continue"
              disabled={isSaving}
              onClick={() => {
                void handleContinue();
              }}
            >
              <Play aria-hidden="true" />
              <span className="min-w-0">{game("matchContinue")}</span>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-12 min-w-0 whitespace-normal rounded-xl px-3 text-center text-xs leading-tight sm:text-sm"
            data-testid="match-end-stats"
            disabled={isSaving}
            onClick={() => {
              void handleStats();
            }}
          >
            <BarChart3 aria-hidden="true" />
            <span className="min-w-0">{game("matchStats")}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-12 min-w-0 whitespace-normal rounded-xl px-3 text-center text-xs leading-tight sm:text-sm"
            data-testid="match-end-home"
            disabled={isSaving}
            onClick={() => {
              void handleHome();
            }}
          >
            <Home aria-hidden="true" />
            <span className="min-w-0">{game("matchHome")}</span>
          </Button>
          <Button
            type="button"
            size="lg"
            className="min-h-12 min-w-0 whitespace-normal rounded-xl px-3 text-center text-xs leading-tight sm:text-sm"
            data-testid="match-end-rematch"
            disabled={isSaving}
            onClick={() => {
              void handleRematch();
            }}
          >
            <RotateCcw aria-hidden="true" />
            <span className="min-w-0">{isSaving ? game("matchSaving") : game("matchRematch")}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
