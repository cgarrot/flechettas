"use client";

import { Crosshair, Hash, Keyboard, Target } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { dartScore, formatDart } from "@/engine";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/store";

import type { Dart, Multiplier, NumberSegment } from "@/types";

const NUMBER_SEGMENTS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
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
const TURN_TOTAL_PATTERN = /^(?:0|[1-9]\d*)$/;

type SelectedSegment = NumberSegment | "bull" | null;

type ScoringInputProps = Readonly<{
  className?: string;
}>;

function createTargetDart(segment: SelectedSegment, multiplier: Multiplier): Dart | null {
  if (segment === null) {
    return null;
  }

  if (segment === "bull") {
    if (multiplier === 1) {
      return { segment: 25, multiplier: 1 };
    }

    if (multiplier === 2) {
      return { segment: 50, multiplier: 1 };
    }

    return null;
  }

  return { segment, multiplier };
}

function parseTurnTotal(value: string): number | null {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    return null;
  }

  if (!TURN_TOTAL_PATTERN.test(normalizedValue)) {
    return null;
  }

  const parsed = Number(normalizedValue);

  return Number.isInteger(parsed) ? parsed : null;
}

export function ScoringInput({ className }: ScoringInputProps) {
  const scoring = useTranslations("Scoring");
  const gameState = useGameStore((state) => state.gameState);
  const inputMode = useGameStore((state) => state.inputMode);
  const switchInputMode = useGameStore((state) => state.switchInputMode);
  const throwDart = useGameStore((state) => state.throwDart);
  const submitTurnTotal = useGameStore((state) => state.submitTurnTotal);
  const [selectedSegment, setSelectedSegment] = useState<SelectedSegment>(20);
  const [selectedMultiplier, setSelectedMultiplier] = useState<Multiplier>(1);
  const [isMissSelected, setIsMissSelected] = useState(false);
  const [turnTotal, setTurnTotal] = useState("");
  const activePlayer = gameState?.players.find((player) => player.id === gameState.activePlayerId);
  const currentTurn = activePlayer?.currentTurn ?? gameState?.currentTurn ?? [];
  const hasPlayableTurn = gameState?.phase === "playing" && Boolean(gameState.activePlayerId);
  const selectedDart = isMissSelected
    ? ({ miss: true } satisfies Dart)
    : createTargetDart(selectedSegment, selectedMultiplier);
  const turnTotalValue = parseTurnTotal(turnTotal);
  const isTurnTotalInRange = turnTotalValue !== null && turnTotalValue >= 0 && turnTotalValue <= 180;
  const canSubmitTurnTotal =
    hasPlayableTurn &&
    gameState?.mode === "x01" &&
    currentTurn.length === 0 &&
    isTurnTotalInRange;

  function selectSegment(segment: SelectedSegment) {
    setIsMissSelected(false);
    setSelectedSegment(segment);

    if (segment === "bull" && selectedMultiplier === 3) {
      setSelectedMultiplier(1);
    }
  }

  function selectMultiplier(multiplier: Multiplier) {
    if (selectedSegment === "bull" && multiplier === 3) {
      return;
    }

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

  async function submitTotal() {
    if (!canSubmitTurnTotal || turnTotalValue === null) {
      return;
    }

    await submitTurnTotal(turnTotalValue);
    setTurnTotal("");
  }

  return (
    <Card className={cn("overflow-hidden border-primary/20 bg-card/95 shadow-2xl shadow-primary/10", className)}>
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Badge variant="outline" className="bg-background/70 uppercase tracking-[0.18em] text-primary">
              <Target className="size-3" aria-hidden="true" />
              {scoring("inputKicker")}
            </Badge>
            <div className="space-y-1">
              <CardTitle className="text-2xl tracking-tight sm:text-3xl">{scoring("inputTitle")}</CardTitle>
              <CardDescription>{scoring("inputDescription")}</CardDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="min-h-12 border-secondary/40"
            data-testid="toggle-input-mode"
            onClick={switchInputMode}
          >
            <Keyboard aria-hidden="true" />
            {inputMode === "dart-by-dart" ? scoring("turnTotalMode") : scoring("dartByDartMode")}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {inputMode === "dart-by-dart" ? (
          <div className="space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{scoring("multiplier")}</p>
                {selectedSegment === "bull" ? (
                  <Badge variant="secondary">{scoring("tripleBullBlocked")}</Badge>
                ) : null}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {MULTIPLIER_OPTIONS.map((option) => {
                  const isDisabled = selectedSegment === "bull" && option.value === 3;
                  const isSelected = !isMissSelected && selectedMultiplier === option.value;

                  return (
                    <Button
                      key={option.id}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="lg"
                      className={cn(
                        "min-h-14 flex-col gap-1 rounded-xl",
                        isSelected && option.id === "d" && "border-secondary/60 bg-secondary text-secondary-foreground shadow-secondary/25 hover:bg-secondary/90",
                        isSelected && option.id === "t" && "border-accent/60 bg-accent text-accent-foreground shadow-accent/25 hover:bg-accent/90",
                      )}
                      data-testid={`mult-${option.id}`}
                      disabled={isDisabled}
                      aria-pressed={isSelected}
                      onClick={() => selectMultiplier(option.value)}
                    >
                      <span className="text-lg font-semibold">{scoring(option.shortKey)}</span>
                      <span className="text-xs opacity-75">{scoring(option.labelKey)}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">{scoring("segment")}</p>
              <div className="grid grid-cols-3 gap-2">
                {NUMBER_SEGMENTS.map((segment) => {
                  const isSelected = !isMissSelected && selectedSegment === segment;

                  return (
                    <Button
                      key={segment}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      className="min-h-12 rounded-xl px-0 font-mono text-lg font-black"
                      data-testid={`seg-${segment}`}
                      aria-pressed={isSelected}
                      onClick={() => selectSegment(segment)}
                    >
                      {segment}
                    </Button>
                  );
                })}
                <Button
                  type="button"
                  variant={!isMissSelected && selectedSegment === "bull" ? "default" : "outline"}
                  className="min-h-12 rounded-xl sm:col-span-2 lg:col-span-2"
                  data-testid="seg-bull"
                  aria-pressed={!isMissSelected && selectedSegment === "bull"}
                  onClick={() => selectSegment("bull")}
                >
                  <Crosshair aria-hidden="true" />
                  {scoring("bull")}
                </Button>
                <Button
                  type="button"
                  variant={isMissSelected ? "default" : "secondary"}
                  className="min-h-12 rounded-xl sm:col-span-2 lg:col-span-2"
                  data-testid="dart-miss"
                  aria-pressed={isMissSelected}
                  onClick={() => {
                    setIsMissSelected(true);
                    setSelectedSegment(null);
                  }}
                >
                  {scoring("miss")}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-primary/20 bg-background/65 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{scoring("currentDart")}</p>
                <p className="font-mono text-4xl font-black tracking-tight">
                  {selectedDart ? formatDart(selectedDart) : scoring("selectDart")}
                </p>
                {selectedDart ? (
                  <p className="text-sm text-muted-foreground">
                    {scoring("dartValue", { value: dartScore(selectedDart) })}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                size="lg"
                className="min-h-14 rounded-xl text-base"
                data-testid="confirm-dart"
                disabled={!selectedDart || !hasPlayableTurn}
                onClick={() => {
                  void confirmDart();
                }}
              >
                {scoring("confirm")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl border border-primary/20 bg-background/65 p-4">
            <div className="space-y-1">
              <Badge variant="outline" className="bg-card/80">
                <Hash className="size-3" aria-hidden="true" />
                {scoring("turnTotal")}
              </Badge>
              <p className="text-sm text-muted-foreground">{scoring("turnTotalHint")}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={180}
                value={turnTotal}
                className="min-h-14 bg-card/80 font-mono text-2xl font-black"
                aria-label={scoring("turnTotalInput")}
                onChange={(event) => setTurnTotal(event.target.value)}
              />
              <Button
                type="button"
                size="lg"
                className="min-h-14 rounded-xl text-base"
                data-testid="submit-total"
                disabled={!canSubmitTurnTotal}
                onClick={() => {
                  void submitTotal();
                }}
              >
                {scoring("submitTotal")}
              </Button>
            </div>
            {gameState?.mode !== "x01" ? (
              <p className="text-sm text-muted-foreground">{scoring("turnTotalX01Only")}</p>
            ) : null}
            {currentTurn.length > 0 ? (
              <p className="text-sm text-muted-foreground">{scoring("turnTotalNeedsEmptyTurn")}</p>
            ) : null}
            {turnTotalValue !== null && !isTurnTotalInRange ? (
              <p className="text-sm font-medium text-destructive" role="alert">
                {scoring("turnTotalRange")}
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
