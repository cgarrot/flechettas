"use client";

import { Activity, AlertTriangle, ArrowRight, Loader2, Play, Trash2, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { clearActiveGame } from "@/db";
import { useGameStore } from "@/store";

import type { Locale } from "@/i18n/routing";
import type { GameMode, PlayerState } from "@/types";

type ActiveGameBannerProps = Readonly<{
  locale: Locale;
}>;

type ScoreSummary = Readonly<{
  label: string;
  value: string;
  detail: string;
}>;

type ScoreLabelValues = Readonly<{ count: number }>;
type ScoreLabel = (key: string, values?: ScoreLabelValues) => string;

type ActionErrorKey = "activeLoadFailed" | "activeActionFailed";

const modeMessageKeys = {
  x01: "x01",
  cricket: "cricket",
  "around-the-clock": "aroundTheClock",
  "bobs-27": "bobs27",
  "checkout-121": "checkout121",
  shanghai: "shanghai",
  training: "training",
  killer: "killer",
} as const satisfies Record<GameMode, string>;

function gameRouteFor(locale: Locale): string {
  return locale === "fr" ? "/fr/partie" : "/en/game";
}

function scoreSummaryFor(
  player: PlayerState,
  label: ScoreLabel,
): ScoreSummary {
  switch (player.modeState.mode) {
    case "x01":
      return {
        label: label("remaining"),
        value: String(player.modeState.remainingScore),
        detail: label("totalDarts", { count: player.dartsThrown }),
      };
    case "cricket":
      return {
        label: label("points"),
        value: String(player.modeState.points),
        detail: `${label("closedTargets")}: ${player.modeState.closedTargets.length}`,
      };
    case "around-the-clock":
      return {
        label: label("currentTarget"),
        value: String(player.modeState.currentTarget),
        detail: `${label("hits")}: ${player.modeState.hits}`,
      };
    case "bobs-27":
      return {
        label: label("score"),
        value: String(player.modeState.score),
        detail: `${label("currentDouble")}: ${player.modeState.currentDouble}`,
      };
    case "checkout-121":
      return {
        label: label("remaining"),
        value: String(player.modeState.remainingTargetScore),
        detail: `${label("targetScore")}: ${player.modeState.currentTargetScore}`,
      };
    case "shanghai":
      return {
        label: label("score"),
        value: String(player.modeState.score),
        detail: `${label("round")}: ${player.modeState.round}`,
      };
    case "training":
      return {
        label: label("hits"),
        value: String(player.modeState.hits),
        detail: `${label("attempts")}: ${player.modeState.attempts}`,
      };
    case "killer":
      return {
        label: label("lives"),
        value: String(player.modeState.lives),
        detail: `${label("kills")}: ${player.modeState.kills}`,
      };
  }
}

export function ActiveGameBanner({ locale }: ActiveGameBannerProps) {
  const router = useRouter();
  const home = useTranslations("HomePage");
  const modes = useTranslations("Modes");
  const scoring = useTranslations("Scoring");
  const gameState = useGameStore((state) => state.gameState);
  const sharedSessionCode = useGameStore((state) => state.sharedSessionCode);
  const resumeActiveGame = useGameStore((state) => state.resumeActiveGame);
  const [hasCheckedActiveGame, setHasCheckedActiveGame] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [isAbandoning, setIsAbandoning] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [actionErrorKey, setActionErrorKey] = useState<ActionErrorKey | null>(null);

  useEffect(() => {
    let isCancelled = false;
    setHasCheckedActiveGame(false);

    async function loadActiveGame() {
      try {
        await resumeActiveGame();
      } catch {
        if (!isCancelled) {
          setActionErrorKey("activeLoadFailed");
        }
      } finally {
        if (!isCancelled) {
          setHasCheckedActiveGame(true);
        }
      }
    }

    void loadActiveGame();

    return () => {
      isCancelled = true;
    };
  }, [resumeActiveGame, sharedSessionCode]);

  async function handleResume() {
    setIsResuming(true);
    setActionErrorKey(null);

    try {
      const resumedState = await resumeActiveGame();

      if (resumedState) {
        router.push(gameRouteFor(locale));
      }
    } catch {
      setActionErrorKey("activeActionFailed");
    } finally {
      setIsResuming(false);
    }
  }

  async function handleAbandon() {
    setIsAbandoning(true);
    setActionErrorKey(null);

    try {
      await clearActiveGame();
      await resumeActiveGame();
      setIsConfirmOpen(false);
    } catch {
      setActionErrorKey("activeActionFailed");
    } finally {
      setIsAbandoning(false);
    }
  }

  if (!hasCheckedActiveGame && !gameState) {
    return null;
  }

  if (!gameState) {
    return null;
  }

  const modeLabel = modes(modeMessageKeys[gameState.mode]);
  const isSharedActiveGame = Boolean(sharedSessionCode);

  return (
    <Card className="overflow-hidden border-primary/25 bg-card/95 py-0 shadow-2xl shadow-primary/10 backdrop-blur" data-testid="active-game-banner">
      <CardHeader className="border-b border-border/70 bg-background/60 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-card/80 uppercase tracking-[0.18em] text-primary">
                <Activity className="size-3" aria-hidden="true" />
                {home("activeGameKicker")}
              </Badge>
              <Badge variant="secondary">{modeLabel}</Badge>
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl tracking-tight sm:text-3xl">
                {home("activeGameTitle")}
              </CardTitle>
              <CardDescription className="text-sm leading-6 sm:text-base">
                {home(isSharedActiveGame ? "activeSharedGameDescription" : "activeGameDescription", { mode: modeLabel })}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-card/80 px-3 py-2 text-sm text-muted-foreground">
            <Users className="size-4" aria-hidden="true" />
            {home("activePlayers", { count: gameState.players.length })}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="grid gap-3" aria-label={home("activeScores")}>
          {gameState.players.map((player, index) => {
            const summary = scoreSummaryFor(player, (key, values) => (values ? scoring(key, values) : scoring(key)));
            const isActive = player.id === gameState.activePlayerId;

            return (
              <div
                key={player.id}
                 className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-border/70 bg-background/65 px-4 py-3"
              >
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-medium">{player.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {isActive ? scoring("currentPlayer") : scoring("waitingPlayer")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{summary.label}</p>
                  <p className="font-mono text-3xl font-black leading-none tracking-tight" data-testid={`active-score-${index + 1}`}>
                    {summary.value}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{summary.detail}</p>
                </div>
              </div>
            );
          })}
        </div>

        {actionErrorKey ? (
          <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive" role="alert">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {home(actionErrorKey)}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <Button
            type="button"
            size="lg"
            className="min-h-14 rounded-xl text-base"
            data-testid="resume-game"
            disabled={isResuming || isAbandoning}
            onClick={() => {
              void handleResume();
            }}
          >
            {isResuming ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
            {isResuming ? home("resumeLoading") : home("resumeGame")}
            <ArrowRight aria-hidden="true" />
          </Button>

          {!isSharedActiveGame ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-14 rounded-xl text-base text-destructive hover:bg-destructive/10 hover:text-destructive"
              data-testid="abandon-game"
              disabled={isResuming || isAbandoning}
              onClick={() => setIsConfirmOpen(true)}
            >
              <Trash2 aria-hidden="true" />
              {home("abandonGame")}
            </Button>
          ) : null}
        </div>
      </CardContent>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="border-primary/20 bg-card/95 sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>{home("abandonDialogTitle")}</DialogTitle>
            <DialogDescription>{home("abandonDialogDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isAbandoning}
              onClick={() => setIsConfirmOpen(false)}
            >
              {home("cancelAbandon")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              data-testid="confirm-abandon-game"
              disabled={isAbandoning}
              onClick={() => {
                void handleAbandon();
              }}
            >
              {isAbandoning ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
              {isAbandoning ? home("abandoningGame") : home("confirmAbandon")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
