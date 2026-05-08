"use client";

import { CalendarDays, Clock3, ExternalLink, Loader2, Trash2, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { Locale } from "@/i18n/routing";
import type { GameMode, HistoryEntry as HistoryEntryModel } from "@/types";

type HistoryEntryProps = Readonly<{
  entry: HistoryEntryModel;
  locale: Locale;
  onDelete: (id: string) => Promise<void>;
}>;

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

function historyDetailRouteFor(locale: Locale, id: string): string {
  const encodedId = encodeURIComponent(id);

  return locale === "fr" ? `/fr/historique/${encodedId}` : `/en/history/${encodedId}`;
}

function modeLabelFor(
  entry: HistoryEntryModel,
  modeLabel: (key: string) => string,
): string {
  const displayModePrefix = "Modes.";

  if (entry.displayMode.startsWith(displayModePrefix)) {
    return modeLabel(entry.displayMode.slice(displayModePrefix.length));
  }

  return modeLabel(modeMessageKeys[entry.mode]);
}

function formatDuration(duration: number | undefined, formatter: (minutes: number) => string): string {
  if (duration === undefined) {
    return formatter(0);
  }

  const minutes = Math.max(1, Math.round(duration / 60000));

  return formatter(minutes);
}

export function HistoryEntry({ entry, locale, onDelete }: HistoryEntryProps) {
  const history = useTranslations("History");
  const modes = useTranslations("Modes");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }),
    [locale],
  );
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    [locale],
  );
  const detailRoute = historyDetailRouteFor(locale, entry.id);
  const modeLabel = modeLabelFor(entry, (key) => modes(key));
  const completedAt = entry.completedAt ?? entry.startedAt;
  const completedDate = dateFormatter.format(new Date(completedAt));
  const duration = formatDuration(entry.duration, (minutes) => history("durationMinutes", { minutes }));
  const bestAverage = Math.max(0, ...entry.thumbnailStats.map((stats) => stats.average3Dart));
  const bestTurn = Math.max(0, ...entry.thumbnailStats.map((stats) => stats.highestTurn));

  async function handleConfirmDelete() {
    setIsDeleting(true);
    setActionError(null);

    try {
      await onDelete(entry.id);
      setIsConfirmOpen(false);
    } catch {
      setActionError(history("deleteFailed"));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Card className="overflow-hidden border-primary/15 bg-card/90 py-0 shadow-lg shadow-primary/5 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-xl hover:shadow-primary/10" data-testid="history-card">
      <div className="grid gap-0 lg:grid-cols-[1fr_auto]">
        <Link
          href={detailRoute}
          className="block focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
          data-testid={`history-entry-${entry.id}`}
        >
          <CardHeader className="gap-4 border-b border-border/70 bg-background/65 p-5 sm:p-6 lg:border-b-0">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{modeLabel}</Badge>
                  {entry.winnerName ? (
                    <Badge variant="outline" className="bg-card/80">
                      <Trophy className="size-3" aria-hidden="true" />
                      {history("winner", { player: entry.winnerName })}
                    </Badge>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-2xl tracking-tight sm:text-3xl">
                    {history("entryTitle", { mode: modeLabel })}
                  </CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-4" aria-hidden="true" />
                      {completedDate}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="size-4" aria-hidden="true" />
                      {duration}
                    </span>
                  </CardDescription>
                </div>
              </div>

              <ExternalLink className="size-5 text-muted-foreground" aria-hidden="true" />
            </div>
          </CardHeader>

          <CardContent className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
            <div className="rounded-2xl border border-border/70 bg-background/65 p-4">
              <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                <Users className="size-3" aria-hidden="true" />
                {history("players")}
              </p>
              <p className="text-sm font-medium leading-6">{entry.playerNames.join(" · ")}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/65 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {history("bestAverage")}
              </p>
              <p className="mt-2 font-mono text-3xl font-black tracking-tight">
                {numberFormatter.format(bestAverage)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/65 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {history("bestTurn")}
              </p>
              <p className="mt-2 font-mono text-3xl font-black tracking-tight">
                {numberFormatter.format(bestTurn)}
              </p>
            </div>
          </CardContent>
        </Link>

        <div className="flex items-center justify-end border-t border-border/70 bg-background/45 p-5 lg:border-l lg:border-t-0 lg:p-6">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 rounded-xl text-destructive hover:text-destructive"
            data-testid={`delete-history-${entry.id}`}
            onClick={() => setIsConfirmOpen(true)}
          >
            <Trash2 aria-hidden="true" />
            {history("delete")}
          </Button>
        </div>
      </div>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="border-primary/20 bg-card/95 shadow-2xl sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>{history("deleteDialogTitle")}</DialogTitle>
            <DialogDescription>
              {history("deleteDialogDescription", { mode: modeLabel })}
            </DialogDescription>
          </DialogHeader>
          {actionError ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive" role="alert">
              {actionError}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isDeleting} onClick={() => setIsConfirmOpen(false)}>
              {history("cancelDelete")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              data-testid={`confirm-delete-history-${entry.id}`}
              onClick={() => {
                void handleConfirmDelete();
              }}
            >
              {isDeleting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
              {isDeleting ? history("deleting") : history("confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
