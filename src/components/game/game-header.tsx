"use client";

import { ArrowLeft, Target } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { modeMessageKeys } from "@/components/setup/mode-selector";

import type { GameConfig, GameMode, GameState, KillerAssignment, TrainingFocus } from "@/types";

type Locale = "fr" | "en";

type GameHeaderProps = Readonly<{
  locale: Locale;
  gameState: GameState | null;
}>;

const trainingFocusMessageKeys = {
  scoring: "focusScoring",
  singles: "focusSingles",
  doubles: "focusDoubles",
  checkout: "focusCheckout",
  cricket: "focusCricket",
  custom: "focusCustom",
} as const satisfies Record<TrainingFocus, string>;

const killerAssignmentMessageKeys = {
  manual: "assignmentManual",
  "first-hit": "assignmentFirstHit",
  random: "assignmentRandom",
  sequential: "assignmentSequential",
} as const satisfies Record<KillerAssignment, string>;

function homeRouteFor(locale: Locale): string {
  return `/${locale}`;
}

function formatMatchValue(config: GameConfig, label: (key: string) => string): string[] {
  const legsToWin = config.matchFormat?.legsToWin ?? 1;
  const setsToWin = config.matchFormat?.setsToWin ?? 1;

  return [
    `${label("legsToWin")}: ${legsToWin}`,
    `${label("setsToWin")}: ${setsToWin}`,
  ];
}

function modeConfigSummary(
  config: GameConfig,
  label: (key: string) => string,
  yesNo: (value: boolean | undefined) => string,
): string {
  const items = formatMatchValue(config, label);

  switch (config.mode) {
    case "x01":
      items.push(
        `${label("startScore")}: ${config.startingScore}`,
        `${label("doubleOut")}: ${yesNo(config.doubleOut)}`,
      );
      break;
    case "cricket":
      items.push(
        `${label("variant")}: ${label(config.variant === "standard" ? "standard" : config.variant === "cut-throat" ? "cutThroat" : "noScore")}`,
        `${label("scorePoints")}: ${yesNo(config.scorePoints)}`,
      );
      break;
    case "around-the-clock":
      items.push(
        `${label("startSegment")}: ${config.startSegment}`,
        `${label("endSegment")}: ${config.endSegment}`,
      );
      break;
    case "bobs-27":
      items.push(`${label("startScore")}: ${config.startingScore}`);
      break;
    case "checkout-121":
      items.push(
        `${label("dartsPerTarget")}: ${config.dartsPerTarget}`,
        `${label("successStep")}: ${config.successStep}`,
      );
      break;
    case "shanghai":
      items.push(`${label("instantShanghaiWin")}: ${yesNo(config.instantShanghaiWin)}`);
      break;
    case "training":
      items.push(`${label("trainingFocus")}: ${label(trainingFocusMessageKeys[config.focus])}`);
      break;
    case "killer":
      items.push(
        `${label("startingLives")}: ${config.startingLives}`,
        `${label("assignment")}: ${label(killerAssignmentMessageKeys[config.assignment])}`,
      );
      break;
  }

  return items.join(" · ");
}

function modeLabelKey(mode: GameMode): string {
  return modeMessageKeys[mode];
}

export function GameHeader({ locale, gameState }: GameHeaderProps) {
  const router = useRouter();
  const game = useTranslations("Game");
  const gameConfig = useTranslations("GameConfig");
  const misc = useTranslations("Misc");
  const modes = useTranslations("Modes");
  const modeLabel = gameState ? modes(modeLabelKey(gameState.mode)) : game("emptyMode");
  const configSummary = useMemo(() => {
    if (!gameState) {
      return game("emptySummary");
    }

    return modeConfigSummary(
      gameState.config,
      (key) => gameConfig(key),
      (value) => misc(value ? "yes" : "no"),
    );
  }, [gameConfig, gameState, game, misc]);

  function handleBackToHome() {
    router.push(homeRouteFor(locale));
  }

  return (
    <header className="grid gap-3 rounded-[1.5rem] border border-primary/20 bg-card/85 p-3 shadow-xl shadow-primary/10 backdrop-blur sm:p-5 lg:grid-cols-[auto_1fr] lg:items-center">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-10 justify-start rounded-xl border-primary/25 sm:min-h-12"
          data-testid="back-to-home"
          onClick={handleBackToHome}
        >
          <ArrowLeft aria-hidden="true" />
          {game("backToHome")}
        </Button>

        <Card className="border-primary/15 bg-background/60 py-3 shadow-inner shadow-primary/5 sm:py-4">
          <CardHeader className="gap-2 px-3 sm:gap-3 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-card/80 uppercase tracking-[0.18em] text-primary">
                <Target className="size-3" aria-hidden="true" />
                {game("headerKicker")}
              </Badge>
              <Badge variant="secondary">{modeLabel}</Badge>
            </div>
            <div className="space-y-1">
              <CardTitle className="text-xl tracking-tight sm:text-3xl">
                {gameState ? game("headerTitle", { mode: modeLabel }) : game("emptyTitle")}
              </CardTitle>
              <CardDescription className="line-clamp-2 leading-5 sm:leading-6">{configSummary}</CardDescription>
            </div>
          </CardHeader>
        </Card>
      </header>
  );
}
