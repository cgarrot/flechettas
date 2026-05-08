"use client";

import { Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/store";

type UndoButtonProps = Readonly<{
  className?: string;
}>;

export function UndoButton({ className }: UndoButtonProps) {
  const scoring = useTranslations("Scoring");
  const undo = useGameStore((state) => state.undo);
  const hasDartEvents = useGameStore((state) => (
    state.eventLog.some((event) => event.type === "dart_thrown")
  ));

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className={cn("min-h-12 w-full rounded-xl border-secondary/30 sm:w-auto", className)}
      data-testid="undo-dart"
      aria-label={scoring("undo")}
      disabled={!hasDartEvents}
      onClick={() => {
        void undo();
      }}
    >
      <Undo2 aria-hidden="true" />
      <span className="hidden sm:inline">{scoring("undo")}</span>
    </Button>
  );
}
