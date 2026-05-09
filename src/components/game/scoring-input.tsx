"use client";

import { Crosshair, Target, Undo2 } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { dartScore, formatDart } from "@/engine";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/store";

import type { BullSegment, Dart, Multiplier, NumberSegment } from "@/types";

const NUMBER_SEGMENTS = [
  1, 2, 3, 4, 5,
  6, 7, 8, 9, 10,
  11, 12, 13, 14, 15,
  16, 17, 18, 19, 20,
] as const satisfies readonly NumberSegment[];

const MULTIPLIER_OPTIONS = [
  { id: "s", value: 1, labelKey: "single", shortKey: "singleShort" },
  { id: "d", value: 2, labelKey: "double", shortKey: "doubleShort" },
  { id: "t", value: 3, labelKey: "triple", shortKey: "tripleShort" },
] as const satisfies readonly {
  id: "s" | "d" | "t";
  value: Multiplier;
  labelKey: "single" | "double" | "triple";
  shortKey: "singleShort" | "doubleShort" | "tripleShort";
}[];

type SelectedTarget = NumberSegment | BullSegment | null;

type ScoringInputProps = Readonly<{
  className?: string;
}>;

function createTargetDart(target: SelectedTarget, multiplier: Multiplier): Dart | null {
  if (target === null) {
    return null;
  }

  if (target === 25) {
    return { segment: 25, multiplier: 1 };
  }

  if (target === 50) {
    return { segment: 50, multiplier: 1 };
  }

  return { segment: target, multiplier };
}

export function ScoringInput({ className }: ScoringInputProps) {
  const scoring = useTranslations("Scoring");
  const gameState = useGameStore((state) => state.gameState);
  const throwDart = useGameStore((state) => state.throwDart);
  const undo = useGameStore((state) => state.undo);
  const hasDartEvents = useGameStore((state) => state.eventLog.some((event) => event.type === "dart_thrown"));
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget>(20);
  const [selectedMultiplier, setSelectedMultiplier] = useState<Multiplier>(1);
  const [isMissSelected, setIsMissSelected] = useState(false);
  const activePlayer = gameState?.players.find((player) => player.id === gameState.activePlayerId);
  const currentTurn = activePlayer?.currentTurn ?? gameState?.currentTurn ?? [];
  const hasPlayableTurn = gameState?.phase === "playing" && Boolean(gameState.activePlayerId);
  const selectedDart = isMissSelected
    ? ({ miss: true } satisfies Dart)
    : createTargetDart(selectedTarget, selectedMultiplier);
  const selectedValue = selectedDart ? dartScore(selectedDart) : 0;
  const canConfirmDart = Boolean(selectedDart && hasPlayableTurn);
  const currentTurnLabel = currentTurn.length > 0
    ? currentTurn.map(formatDart).join(" · ")
    : scoring("noDarts");

  function selectTarget(target: SelectedTarget) {
    setIsMissSelected(false);
    setSelectedTarget(target);
  }

  function selectMultiplier(multiplier: Multiplier) {
    setIsMissSelected(false);
    setSelectedMultiplier(multiplier);
  }

  async function confirmDart() {
    if (!selectedDart || !hasPlayableTurn) {
      return;
    }

    await throwDart(selectedDart);
    setIsMissSelected(false);
  }

  return (
    <Card className={cn("overflow-hidden border-primary/20 bg-card/95 py-0 shadow-2xl shadow-primary/10", className)}>
      <CardContent className="space-y-2 p-2 sm:space-y-4 sm:p-5">
        <div className="grid grid-cols-[2.75rem_1fr_auto] items-stretch gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-auto min-h-12 rounded-2xl border-secondary/30"
            data-testid="undo-dart"
            aria-label={scoring("undo")}
            disabled={!hasDartEvents}
            onClick={() => {
              void undo();
            }}
          >
            <Undo2 aria-hidden="true" />
          </Button>

          <div className="grid min-h-12 grid-cols-[auto_1fr] items-center gap-3 rounded-2xl border border-border/70 bg-background/80 px-3">
            <span className="font-mono text-3xl font-black leading-none text-foreground">{selectedValue}</span>
            <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {selectedDart ? formatDart(selectedDart) : scoring("selectDart")}
            </span>
          </div>

          <Button
            type="button"
            size="lg"
            className="min-h-12 rounded-2xl px-5 text-sm font-black sm:px-8 sm:text-base"
            data-testid="confirm-dart"
            disabled={!canConfirmDart}
            onClick={() => {
              void confirmDart();
            }}
          >
            {scoring("confirm")}
          </Button>
        </div>

        <p className="rounded-xl border border-border/70 bg-background/60 px-3 py-1.5 text-xs text-muted-foreground" aria-live="polite">
          <span className="font-semibold text-foreground">{scoring("currentDarts")}:</span> {currentTurnLabel}
        </p>

        <div className="grid grid-cols-3 gap-1.5" aria-label={scoring("multiplier")}>
          {MULTIPLIER_OPTIONS.map((option) => {
            const isSelected = !isMissSelected && selectedMultiplier === option.value;

            return (
              <Button
                key={option.id}
                type="button"
                variant={isSelected ? "default" : "outline"}
                className={cn(
                  "min-h-11 rounded-xl px-2 text-base font-black",
                  isSelected && option.id === "d" && "border-secondary/60 bg-secondary text-secondary-foreground shadow-secondary/25 hover:bg-secondary/90",
                  isSelected && option.id === "t" && "border-accent/60 bg-accent text-accent-foreground shadow-accent/25 hover:bg-accent/90",
                )}
                data-testid={`mult-${option.id}`}
                aria-label={scoring(option.labelKey)}
                aria-pressed={isSelected}
                onClick={() => selectMultiplier(option.value)}
              >
                {scoring(option.shortKey)}
              </Button>
            );
          })}
        </div>

        <div className="grid grid-cols-5 overflow-hidden rounded-2xl border border-border/70 bg-border/70" aria-label={scoring("segment")}>
          {NUMBER_SEGMENTS.map((segment) => {
            const isSelected = !isMissSelected && selectedTarget === segment;
            const value = segment * selectedMultiplier;

            return (
              <Button
                key={segment}
                type="button"
                variant="ghost"
                className={cn(
                  "min-h-12 rounded-none border-0 bg-card/95 px-0 font-mono text-2xl font-black text-foreground hover:bg-primary/10 sm:min-h-14",
                  isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
                data-testid={`seg-${segment}`}
                aria-label={`${segment}, ${value}`}
                aria-pressed={isSelected}
                onClick={() => selectTarget(segment)}
              >
                {segment}
              </Button>
            );
          })}
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <Button
            type="button"
            variant={!isMissSelected && selectedTarget === 25 ? "default" : "outline"}
            className="min-h-12 rounded-xl font-bold"
            data-testid="seg-outer"
            aria-pressed={!isMissSelected && selectedTarget === 25}
            onClick={() => selectTarget(25)}
          >
            <Crosshair className="size-4" aria-hidden="true" />
            {scoring("outerBull")}
          </Button>
          <Button
            type="button"
            variant={!isMissSelected && selectedTarget === 50 ? "default" : "outline"}
            className="min-h-12 rounded-xl font-bold"
            data-testid="seg-bull"
            aria-pressed={!isMissSelected && selectedTarget === 50}
            onClick={() => selectTarget(50)}
          >
            <Target className="size-4" aria-hidden="true" />
            {scoring("bull")}
          </Button>
          <Button
            type="button"
            variant={isMissSelected ? "default" : "secondary"}
            className="min-h-12 rounded-xl font-black"
            data-testid="dart-miss"
            aria-pressed={isMissSelected}
            onClick={() => {
              setIsMissSelected(true);
              setSelectedTarget(null);
            }}
          >
            {scoring("miss")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
