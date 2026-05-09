"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Play,
  Trash2,
  Users,
} from "lucide-react";
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
import { clearActiveGame, loadActiveGames, type LoadedActiveGame } from "@/db";
import { useGameStore } from "@/store";

import type { Locale } from "@/i18n/routing";
import type { GameMode, GameState, PlayerState } from "@/types";

type ActiveGameBannerProps = Readonly<{
  locale: Locale;
}>;

type ActiveGameListItem = Readonly<{
  id: string;
  gameState: GameState;
  updatedAt: string;
  source: "local" | "shared";
}>;

type ScoreSummary = Readonly<{
  label: string;
  value: string;
  detail: string;
}>;

type ScoreLabelValues = Readonly<{ count: number }>;
type ScoreLabel = (key: string, values?: ScoreLabelValues) => string;

type ActionErrorKey = "activeLoadFailed" | "activeActionFailed" | "activeGameNotFound";

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

function listItemFromLocalRecord(record: LoadedActiveGame): ActiveGameListItem {
  return {
    id: record.id,
    gameState: record.gameState,
    updatedAt: record.updatedAt,
    source: "local",
  };
}

export function ActiveGameBanner({ locale }: ActiveGameBannerProps) {
  const router = useRouter();
  const home = useTranslations("HomePage");
  const modes = useTranslations("Modes");
  const scoring = useTranslations("Scoring");
  const gameState = useGameStore((state) => state.gameState);
  const sharedSessionCode = useGameStore((state) => state.sharedSessionCode);
  const refreshSharedActiveGame = useGameStore((state) => state.refreshSharedActiveGame);
  const resumeActiveGame = useGameStore((state) => state.resumeActiveGame);
  const [hasCheckedActiveGames, setHasCheckedActiveGames] = useState(false);
  const [localActiveGames, setLocalActiveGames] = useState<LoadedActiveGame[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [resumingGameId, setResumingGameId] = useState<string | null>(null);
  const [abandoningGameId, setAbandoningGameId] = useState<string | null>(null);
  const [confirmGame, setConfirmGame] = useState<ActiveGameListItem | null>(null);
  const [actionErrorKey, setActionErrorKey] = useState<ActionErrorKey | null>(null);

  useEffect(() => {
    let isCancelled = false;
    setHasCheckedActiveGames(false);

    async function loadBannerGames() {
      try {
        const activeGames = await loadActiveGames();

        if (!isCancelled) {
          setLocalActiveGames(activeGames);
        }

        if (sharedSessionCode) {
          await refreshSharedActiveGame();
        }
      } catch {
        if (!isCancelled) {
          setActionErrorKey("activeLoadFailed");
        }
      } finally {
        if (!isCancelled) {
          setHasCheckedActiveGames(true);
        }
      }
    }

    void loadBannerGames();

    return () => {
      isCancelled = true;
    };
  }, [refreshSharedActiveGame, sharedSessionCode]);

  async function reloadLocalActiveGames() {
    setLocalActiveGames(await loadActiveGames());
  }

  async function handleResume(item: ActiveGameListItem) {
    setResumingGameId(item.id);
    setActionErrorKey(null);

    try {
      const resumedState = item.source === "shared"
        ? await resumeActiveGame()
        : await resumeActiveGame(item.id);

      if (resumedState) {
        router.push(gameRouteFor(locale));
      } else {
        setActionErrorKey("activeGameNotFound");
        await reloadLocalActiveGames();
      }
    } catch {
      setActionErrorKey("activeActionFailed");
    } finally {
      setResumingGameId(null);
    }
  }

  async function handleAbandon() {
    if (confirmGame === null || confirmGame.source !== "local") {
      return;
    }

    setAbandoningGameId(confirmGame.id);
    setActionErrorKey(null);

    try {
      await clearActiveGame(confirmGame.id);

      if (gameState?.id === confirmGame.id) {
        await resumeActiveGame();
      }

      await reloadLocalActiveGames();
      setConfirmGame(null);
    } catch {
      setActionErrorKey("activeActionFailed");
    } finally {
      setAbandoningGameId(null);
    }
  }

  const sharedActiveGame: ActiveGameListItem | null = sharedSessionCode && gameState
    ? {
        id: gameState.id,
        gameState,
        updatedAt: gameState.updatedAt,
        source: "shared",
      }
    : null;
  const localGames = localActiveGames
    .filter((record) => record.id !== sharedActiveGame?.id)
    .map(listItemFromLocalRecord);
  const visibleLocalGames = !isExpanded && localGames.length > 1 ? localGames.slice(0, 1) : localGames;
  const hiddenLocalGameCount = localGames.length - visibleLocalGames.length;
  const visibleGames = sharedActiveGame ? [sharedActiveGame, ...visibleLocalGames] : visibleLocalGames;
  const totalGameCount = localGames.length + (sharedActiveGame ? 1 : 0);

  if (!hasCheckedActiveGames && totalGameCount === 0) {
    return null;
  }

  if (totalGameCount === 0) {
    return null;
  }

  const isBusy = resumingGameId !== null || abandoningGameId !== null;
  const confirmModeLabel = confirmGame ? modes(modeMessageKeys[confirmGame.gameState.mode]) : "";

  return (
    <Card className="overflow-hidden border-primary/25 bg-card/95 py-0 shadow-2xl shadow-primary/10 backdrop-blur" data-testid="active-game-banner">
      <CardHeader className="border-b border-border/70 bg-background/60 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-card/80 uppercase tracking-[0.18em] text-primary">
                <Activity className="size-3" aria-hidden="true" />
                {home("activeGameKicker")}
              </Badge>
              <Badge variant="secondary">{home("activeGamesCount", { count: totalGameCount })}</Badge>
            </div>
            <div className="space-y-1">
              <CardTitle className="text-xl tracking-tight sm:text-2xl">
                {home("activeLocalGamesTitle", { count: totalGameCount })}
              </CardTitle>
              <CardDescription className="text-sm leading-6">
                {home("activeLocalGamesDescription")}
              </CardDescription>
            </div>
          </div>

          {localGames.length > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              aria-expanded={isExpanded}
              onClick={() => setIsExpanded((current) => !current)}
            >
              {isExpanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
              {isExpanded
                ? home("showFewerActiveGames")
                : home("showAllActiveGames", { count: hiddenLocalGameCount })}
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="space-y-3" aria-label={home("activeLocalGamesListLabel")}>
          {visibleGames.map((item) => {
            const gameModeLabel = modes(modeMessageKeys[item.gameState.mode]);
            const activePlayer = item.gameState.players.find((player) => player.id === item.gameState.activePlayerId);
            const playerCountLabel = home("activePlayers", { count: item.gameState.players.length });
            const scoreLabels = item.gameState.players.slice(0, 3).map((player) => {
              const summary = scoreSummaryFor(player, (key, values) => (values ? scoring(key, values) : scoring(key)));

              return `${player.name}: ${summary.value}`;
            });

            return (
              <div
                key={`${item.source}-${item.id}`}
                className="grid gap-3 rounded-2xl border border-border/70 bg-background/65 p-3 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={item.source === "shared" ? "default" : "secondary"}>
                      {item.source === "shared" ? home("activeSharedGameKicker") : gameModeLabel}
                    </Badge>
                    {item.source === "shared" ? <Badge variant="secondary">{gameModeLabel}</Badge> : null}
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="size-3.5" aria-hidden="true" />
                      {playerCountLabel}
                    </span>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold sm:text-base">
                      {item.source === "shared"
                        ? home("activeSharedGameTitle")
                        : home("activeGameRowMeta", { mode: gameModeLabel, players: playerCountLabel })}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {activePlayer ? `${scoring("currentPlayer")}: ${activePlayer.name}` : gameModeLabel}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {scoreLabels.join(" · ")}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-xl"
                    data-testid={`resume-game-${item.id}`}
                    aria-label={home("resumeGameA11y", { mode: gameModeLabel })}
                    disabled={isBusy}
                    onClick={() => {
                      void handleResume(item);
                    }}
                  >
                    {resumingGameId === item.id ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play aria-hidden="true" />}
                    {resumingGameId === item.id ? home("resumeLoading") : home("resumeGame")}
                    <ArrowRight aria-hidden="true" />
                  </Button>

                  {item.source === "local" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                      data-testid={`abandon-game-${item.id}`}
                      aria-label={home("abandonGameA11y", { mode: gameModeLabel })}
                      disabled={isBusy}
                      onClick={() => setConfirmGame(item)}
                    >
                      <Trash2 aria-hidden="true" />
                      {home("abandonGame")}
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {hiddenLocalGameCount > 0 ? (
          <p className="text-center text-xs text-muted-foreground">
            {home("activeLocalGamesCollapsedSummary", { count: hiddenLocalGameCount })}
          </p>
        ) : null}

        {actionErrorKey ? (
          <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive" role="alert">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {home(actionErrorKey)}
          </p>
        ) : null}
      </CardContent>

      <Dialog open={confirmGame !== null} onOpenChange={(isOpen) => setConfirmGame(isOpen ? confirmGame : null)}>
        <DialogContent className="border-primary/20 bg-card/95 sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {confirmGame
                ? home("abandonDialogTitleForGame", { mode: confirmModeLabel })
                : home("abandonDialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {confirmGame
                ? home("abandonDialogDescriptionForGame", { mode: confirmModeLabel })
                : home("abandonDialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={abandoningGameId !== null}
              onClick={() => setConfirmGame(null)}
            >
              {home("cancelAbandon")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              data-testid="confirm-abandon-game"
              disabled={abandoningGameId !== null}
              onClick={() => {
                void handleAbandon();
              }}
            >
              {abandoningGameId !== null ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
              {abandoningGameId !== null ? home("abandoningGame") : home("confirmAbandon")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
