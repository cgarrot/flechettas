"use client";

import { AlertCircle, Bot, Loader2, Play } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { generateBotTurn } from "@/bot/simulator";
import { CheckoutSuggestions } from "@/components/game/checkout-suggestions";
import { GameHeader } from "@/components/game/game-header";
import { MatchEnd } from "@/components/game/match-end";
import { ScoreDisplay } from "@/components/game/score-display";
import { ScoringInput } from "@/components/game/scoring-input";
import { TurnIndicator, type BotPlaybackState } from "@/components/game/turn-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBotProfile } from "@/data/dartbot-profiles";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/store";

import type { BotLevel, PlayerState } from "@/types";

type Locale = "fr" | "en";

type GameScreenProps = Readonly<{
  locale: Locale;
}>;

const BOT_THINKING_DELAY_MS = 800;
const BOT_DART_DELAY_MS = 400;
const SHARED_GAME_POLL_MS = 2000;
const DEFAULT_BOT_LEVEL = 1 satisfies BotLevel;

function newGameRouteFor(locale: Locale): string {
  return locale === "fr" ? "/fr/nouvelle-partie" : "/en/new-game";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function remainingForBot(player: PlayerState): number {
  switch (player.modeState.mode) {
    case "x01":
      return player.modeState.remainingScore;
    case "cricket":
      return player.modeState.points;
    case "around-the-clock":
      return player.modeState.currentTarget;
    case "bobs-27":
      return player.modeState.currentDouble;
    case "checkout-121":
      return player.modeState.remainingTargetScore;
    case "shanghai":
      return player.modeState.round;
    case "training":
      return player.modeState.score;
    case "killer":
      return player.modeState.assignedNumber ?? player.modeState.lives;
  }
}

function isStillActiveBotTurn(playerId: string): boolean {
  const latestState = useGameStore.getState().gameState;

  return latestState?.phase === "playing" && latestState.activePlayerId === playerId;
}

function EmptyGameState({ locale }: Readonly<{ locale: Locale }>) {
  const game = useTranslations("Game");

  return (
    <Card className="border-dashed border-primary/25 bg-card/85 shadow-xl shadow-primary/10" data-testid="game-empty-state">
      <CardHeader className="gap-3 text-center">
        <Badge variant="outline" className="mx-auto bg-background/70 uppercase tracking-[0.18em] text-primary">
          <AlertCircle className="size-3" aria-hidden="true" />
          {game("emptyKicker")}
        </Badge>
        <div className="space-y-2">
          <CardTitle className="text-3xl tracking-tight sm:text-4xl">{game("emptyStateTitle")}</CardTitle>
          <CardDescription className="mx-auto max-w-xl text-base leading-7">
            {game("emptyStateDescription")}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex justify-center pb-8">
        <Button asChild size="lg" className="min-h-14 rounded-xl text-base" data-testid="new-game-cta">
          <Link href={newGameRouteFor(locale)}>
            <Play aria-hidden="true" />
            {game("startNewGame")}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function LoadingGameState() {
  const game = useTranslations("Game");

  return (
    <Card className="border-primary/20 bg-card/85 shadow-xl shadow-primary/10">
      <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 py-10 text-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" aria-hidden="true" />
        <p className="text-sm font-medium">{game("loadingActiveGame")}</p>
      </CardContent>
    </Card>
  );
}

export function GameScreen({ locale }: GameScreenProps) {
  const game = useTranslations("Game");
  const gameState = useGameStore((state) => state.gameState);
  const resumeActiveGame = useGameStore((state) => state.resumeActiveGame);
  const refreshSharedActiveGame = useGameStore((state) => state.refreshSharedActiveGame);
  const throwDart = useGameStore((state) => state.throwDart);
  const sharedSessionCode = useGameStore((state) => state.sharedSessionCode);
  const sharedSessionPlayerId = useGameStore((state) => state.sharedSessionPlayerId);
  const [hasCheckedResume, setHasCheckedResume] = useState(false);
  const [botPlayback, setBotPlayback] = useState<BotPlaybackState | null>(null);
  const activeBotTurnKey = useRef<string | null>(null);
  const activePlayer = useMemo(
    () => gameState?.players.find((player) => player.id === gameState.activePlayerId),
    [gameState],
  );
  const activePlayerTurnsPlayed = activePlayer?.turnsPlayed ?? 0;
  const activePlayerId = gameState?.activePlayerId;
  const gameId = gameState?.id;
  const gamePhase = gameState?.phase;
  const currentSet = gameState?.currentSet ?? 0;
  const currentLeg = gameState?.currentLeg ?? 0;
  const currentRound = gameState?.currentRound ?? 0;

  useEffect(() => {
    if (hasCheckedResume) {
      return;
    }

    let isCancelled = false;

    async function resumeIfNeeded() {
      if (!useGameStore.getState().gameState) {
        await resumeActiveGame();
      }

      if (!isCancelled) {
        setHasCheckedResume(true);
      }
    }

    void resumeIfNeeded();

    return () => {
      isCancelled = true;
    };
  }, [hasCheckedResume, resumeActiveGame]);

  useEffect(() => {
    if (!sharedSessionCode || !hasCheckedResume) {
      return;
    }

    let isCancelled = false;

    void refreshSharedActiveGame();

    const intervalId = window.setInterval(() => {
      if (!isCancelled) {
        void refreshSharedActiveGame();
      }
    }, SHARED_GAME_POLL_MS);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [hasCheckedResume, refreshSharedActiveGame, sharedSessionCode]);

  useEffect(() => {
    const currentState = useGameStore.getState().gameState;
    const currentActivePlayer = currentState?.players.find((player) => player.id === currentState.activePlayerId);

    if (
      !currentState ||
      currentState.phase !== "playing" ||
      !currentActivePlayer ||
      !currentActivePlayer.isBot ||
      currentState.currentTurn.length > 0
    ) {
      return;
    }

    if (sharedSessionCode && sharedSessionPlayerId) {
      // Shared-session V1 disables bot autoplay once a device has selected a
      // session player. That keeps bot turns single-writer and avoids two open
      // scorers generating duplicate bot darts.
      return;
    }

    const botState = currentState;
    const botPlayer = currentActivePlayer;

    const turnKey = [
      botState.id,
      botPlayer.id,
      botState.currentSet,
      botState.currentLeg,
      botState.currentRound,
      botPlayer.turnsPlayed,
    ].join(":");

    if (activeBotTurnKey.current === turnKey) {
      return;
    }

    activeBotTurnKey.current = turnKey;
    let isCancelled = false;
    const profile = getBotProfile(botPlayer.botLevel ?? DEFAULT_BOT_LEVEL);
    const generatedTurn = generateBotTurn(
      profile,
      remainingForBot(botPlayer),
      botState.mode,
      {
        gameState: botState,
        playerId: botPlayer.id,
        playerState: botPlayer,
        seed: `${turnKey}:${botState.events.length}`,
      },
    );

    async function playBotTurn() {
      setBotPlayback({ playerId: botPlayer.id, turnKey, darts: [], status: "thinking" });
      await sleep(BOT_THINKING_DELAY_MS);

      if (isCancelled || !isStillActiveBotTurn(botPlayer.id)) {
        return;
      }

      setBotPlayback({ playerId: botPlayer.id, turnKey, darts: [], status: "throwing" });

      for (const dart of generatedTurn.slice(0, 3)) {
        await sleep(BOT_DART_DELAY_MS);

        if (isCancelled || !isStillActiveBotTurn(botPlayer.id)) {
          break;
        }

        setBotPlayback((current) => {
          if (!current || current.turnKey !== turnKey) {
            return current;
          }

          return { ...current, darts: [...current.darts, dart] };
        });
        await throwDart(dart);
      }

      if (!isCancelled) {
        setBotPlayback((current) => (current?.turnKey === turnKey ? null : current));
      }
    }

    void playBotTurn();

    return () => {
      isCancelled = true;
    };
  }, [
    activePlayerId,
    activePlayerTurnsPlayed,
    currentLeg,
    currentRound,
    currentSet,
    gameId,
    gamePhase,
    throwDart,
    sharedSessionCode,
    sharedSessionPlayerId,
  ]);

  const isBotTurn = Boolean(activePlayer?.isBot && gameState?.phase === "playing");

  return (
    <main className="min-h-screen -mb-[calc(7rem+env(safe-area-inset-bottom))] overflow-hidden bg-transparent px-2 py-2 pb-[calc(1rem+env(safe-area-inset-bottom))] text-foreground sm:px-6 sm:py-6 md:mb-0 md:pb-0 lg:px-8">
      <section className="relative mx-auto flex max-w-7xl flex-col gap-2 sm:gap-6">
        <div className="pointer-events-none absolute -top-28 right-4 -z-10 size-72 rounded-full bg-chart-2/25 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute top-96 -left-24 -z-10 size-80 rounded-full bg-chart-1/20 blur-3xl" aria-hidden="true" />

        <div className="hidden sm:block">
          <GameHeader locale={locale} gameState={gameState} />
        </div>

        {!hasCheckedResume ? <LoadingGameState /> : null}

        {hasCheckedResume && !gameState ? <EmptyGameState locale={locale} /> : null}

        {hasCheckedResume && gameState ? (
          <>
            <ScoreDisplay />

            <section className="grid gap-2 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:gap-3" aria-label={game("gameBoardLabel")}>
              <div className="space-y-2 sm:space-y-4">
                <TurnIndicator botPlayback={botPlayback} />
                <CheckoutSuggestions className="hidden sm:block" />
              </div>

              <div className="space-y-2 sm:space-y-4">
                <div className="relative">
                  <ScoringInput className={cn(isBotTurn && "pointer-events-none opacity-60")} />
                  {isBotTurn ? (
                    <div className="absolute inset-0 grid place-items-center rounded-2xl bg-background/65 p-4 backdrop-blur-sm" aria-live="polite">
                      <Card className="border-primary/20 bg-card/95 py-5 shadow-xl shadow-primary/15">
                        <CardContent className="flex items-center gap-3 px-5 text-sm font-medium text-muted-foreground">
                          <Bot className="size-5 text-primary" aria-hidden="true" />
                          {game("botControlsLocked")}
                        </CardContent>
                      </Card>
                    </div>
                  ) : null}
                </div>

              </div>
            </section>

            <MatchEnd locale={locale} />
          </>
        ) : null}
      </section>
    </main>
  );
}
