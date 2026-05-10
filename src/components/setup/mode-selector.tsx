"use client";

import { CheckCircle2, CircleDot, Sparkles, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { GAME_PRESETS, isGamePresetId, modeMessageKeys } from "./game-presets";

import type { GamePreset, GamePresetId } from "./game-presets";

const FAVORITE_PRESETS_STORAGE_KEY = "flechettas.favoriteGamePresets.v1";

type ModeSelectorProps = Readonly<{
  selectedPresetId: GamePresetId;
  onSelectPreset: (preset: GamePreset) => void;
}>;

function readFavoritePresetIds(): GamePresetId[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedValue = window.localStorage.getItem(FAVORITE_PRESETS_STORAGE_KEY);
    const parsed: unknown = storedValue ? JSON.parse(storedValue) : [];

    return Array.isArray(parsed) ? parsed.filter(isGamePresetId) : [];
  } catch {
    return [];
  }
}

function writeFavoritePresetIds(presetIds: readonly GamePresetId[]): void {
  try {
    window.localStorage.setItem(FAVORITE_PRESETS_STORAGE_KEY, JSON.stringify(presetIds));
  } catch {
    // Favorites are convenience-only; setup should keep working without storage.
  }
}

export function ModeSelector({
  selectedPresetId,
  onSelectPreset,
}: ModeSelectorProps) {
  const setup = useTranslations("Setup");
  const modes = useTranslations("Modes");
  const [favoritePresetIds, setFavoritePresetIds] = useState<readonly GamePresetId[]>([]);
  const favoritePresetSet = useMemo(() => new Set(favoritePresetIds), [favoritePresetIds]);
  const orderedPresets = useMemo(
    () => [...GAME_PRESETS].sort((left, right) => {
      const leftIsFavorite = favoritePresetSet.has(left.id);
      const rightIsFavorite = favoritePresetSet.has(right.id);

      if (leftIsFavorite !== rightIsFavorite) {
        return leftIsFavorite ? -1 : 1;
      }

      return GAME_PRESETS.indexOf(left) - GAME_PRESETS.indexOf(right);
    }),
    [favoritePresetSet],
  );

  useEffect(() => {
    setFavoritePresetIds(readFavoritePresetIds());
  }, []);

  function toggleFavoritePreset(presetId: GamePresetId) {
    setFavoritePresetIds((currentPresetIds) => {
      const nextPresetIds = currentPresetIds.includes(presetId)
        ? currentPresetIds.filter((currentPresetId) => currentPresetId !== presetId)
        : [...currentPresetIds, presetId];

      writeFavoritePresetIds(nextPresetIds);

      return nextPresetIds;
    });
  }

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

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {orderedPresets.map((preset) => {
          const isSelected = preset.id === selectedPresetId;
          const isFavorite = favoritePresetSet.has(preset.id);
          const modeLabel = modes(modeMessageKeys[preset.mode]);
          const presetTitle = setup(`gamePresets.${preset.id}.title`);

          return (
            <Card
              key={preset.id}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={setup("selectModeA11y", { mode: presetTitle })}
              data-testid={`mode-card-${preset.id}`}
              onClick={() => onSelectPreset(preset)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectPreset(preset);
                }
              }}
              className={cn(
                "group relative min-h-36 cursor-pointer overflow-hidden border-border/70 bg-card/85 py-0 shadow-lg shadow-primary/5 transition-[border-color,background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-xl focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
                isSelected && "border-primary/70 bg-primary text-primary-foreground shadow-2xl shadow-primary/20 hover:border-primary",
              )}
            >
              <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Badge
                        variant={isSelected ? "secondary" : "outline"}
                        className={cn("text-[0.62rem] uppercase tracking-[0.14em]", isSelected && "border-primary-foreground/20 bg-primary-foreground/15 text-primary-foreground")}
                      >
                        {modeLabel}
                      </Badge>
                      <p className="text-lg font-black leading-tight tracking-tight">{presetTitle}</p>
                    </div>
                    <p
                      className={cn(
                        "text-xs leading-5 text-muted-foreground sm:text-sm",
                        isSelected && "text-primary-foreground/75",
                      )}
                    >
                      {setup(`gamePresets.${preset.id}.description`)}
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
                <Button
                  type="button"
                  variant={isSelected ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "absolute right-2 bottom-2 size-9 rounded-full p-0",
                    isSelected && "bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25",
                  )}
                  aria-label={setup(isFavorite ? "removeFavoriteGameA11y" : "addFavoriteGameA11y", { game: presetTitle })}
                  aria-pressed={isFavorite}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleFavoritePreset(preset.id);
                  }}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <Star className={cn("size-4", isFavorite && "fill-current text-amber-400")} aria-hidden="true" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
