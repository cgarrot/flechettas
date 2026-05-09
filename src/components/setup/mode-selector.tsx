"use client";

import { CheckCircle2, CircleDot, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { GameMode } from "@/types";

export const SETUP_MODES = [
  "x01",
  "cricket",
  "around-the-clock",
  "bobs-27",
  "checkout-121",
  "shanghai",
  "training",
  "killer",
] as const satisfies readonly GameMode[];

export const modeMessageKeys = {
  x01: "x01",
  cricket: "cricket",
  "around-the-clock": "aroundTheClock",
  "bobs-27": "bobs27",
  "checkout-121": "checkout121",
  shanghai: "shanghai",
  training: "training",
  killer: "killer",
} as const satisfies Record<GameMode, string>;

type ModeSelectorProps = Readonly<{
  selectedMode: GameMode;
  onSelectMode: (mode: GameMode) => void;
}>;

export function ModeSelector({
  selectedMode,
  onSelectMode,
}: ModeSelectorProps) {
  const setup = useTranslations("Setup");
  const modes = useTranslations("Modes");

  return (
    <section className="space-y-4" aria-labelledby="mode-selector-title">
      <div className="space-y-2">
        <Badge variant="outline" className="bg-background/70 uppercase tracking-[0.18em] text-primary">
          <Sparkles className="size-3" aria-hidden="true" />
          {setup("modeSelectionKicker")}
        </Badge>
        <div className="space-y-2">
          <h2 id="mode-selector-title" className="text-2xl font-black tracking-tight sm:text-3xl">
            {setup("modeSelectionTitle")}
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            {setup("modeSelectionDescription")}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {SETUP_MODES.map((mode) => {
          const isSelected = mode === selectedMode;
          const modeLabel = modes(modeMessageKeys[mode]);

          return (
            <Card
              key={mode}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={setup("selectModeA11y", { mode: modeLabel })}
              data-testid={`mode-card-${mode}`}
              onClick={() => onSelectMode(mode)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectMode(mode);
                }
              }}
              className={cn(
                "group min-h-32 cursor-pointer overflow-hidden border-border/70 bg-card/85 py-0 shadow-lg shadow-primary/5 transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-xl focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none sm:min-h-36",
                isSelected && "border-primary/70 bg-primary text-primary-foreground shadow-2xl shadow-primary/20 hover:border-primary",
              )}
            >
              <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className="text-lg font-black tracking-tight">{modeLabel}</p>
                    <p
                      className={cn(
                        "text-xs leading-5 text-muted-foreground sm:text-sm",
                        isSelected && "text-primary-foreground/75",
                      )}
                    >
                      {setup(`modeDescriptions.${mode}`)}
                    </p>
                  </div>
                  {isSelected ? (
                    <CheckCircle2 className="size-6 shrink-0" aria-hidden="true" />
                  ) : (
                    <CircleDot className="size-6 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden="true" />
                  )}
                </div>

                <Badge
                  variant={isSelected ? "secondary" : "outline"}
                  className={cn(
                    "self-start",
                    isSelected && "border-primary-foreground/20 bg-primary-foreground text-primary",
                  )}
                >
                  {isSelected ? setup("selectedMode") : setup("tapToSelect")}
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
