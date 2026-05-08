"use client";

import { AlertTriangle, History, Loader2, PlusCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { HistoryEntry } from "@/components/history/history-entry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { deleteHistoryEntry, loadHistory } from "@/services/history-service";

import type { Locale } from "@/i18n/routing";
import type { HistoryEntry as HistoryEntryModel } from "@/types";

type HistoryListScreenProps = Readonly<{
  locale: Locale;
}>;

function newGameRouteFor(locale: Locale): string {
  return locale === "fr" ? "/fr/nouvelle-partie" : "/en/new-game";
}

function LoadingState() {
  const history = useTranslations("History");

  return (
    <Card className="border-primary/20 bg-card/85 shadow-xl shadow-primary/10">
      <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 py-10 text-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" aria-hidden="true" />
        <p className="text-sm font-medium">{history("loading")}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ locale }: Readonly<{ locale: Locale }>) {
  const history = useTranslations("History");

  return (
    <Card className="border-dashed border-primary/25 bg-card/85 shadow-xl shadow-primary/10" data-testid="history-empty-state">
      <CardHeader className="gap-3 text-center">
        <Badge variant="outline" className="mx-auto bg-background/70 uppercase tracking-[0.18em] text-primary">
          <Sparkles className="size-3" aria-hidden="true" />
          {history("emptyKicker")}
        </Badge>
        <div className="space-y-2">
          <CardTitle className="text-3xl tracking-tight sm:text-4xl">{history("emptyTitle")}</CardTitle>
          <CardDescription className="mx-auto max-w-xl text-base leading-7">
            {history("emptyDescription")}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex justify-center pb-8">
        <Button asChild size="lg" className="min-h-14 rounded-xl text-base" data-testid="history-new-game">
          <Link href={newGameRouteFor(locale)}>
            <PlusCircle aria-hidden="true" />
            {history("newGame")}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function HistoryListScreen({ locale }: HistoryListScreenProps) {
  const history = useTranslations("History");
  const [entries, setEntries] = useState<readonly HistoryEntryModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadEntries() {
      setIsLoading(true);
      setActionError(null);

      try {
        const loadedEntries = await loadHistory(100);

        if (!isCancelled) {
          setEntries(loadedEntries);
        }
      } catch {
        if (!isCancelled) {
          setActionError(history("loadFailed"));
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadEntries();

    return () => {
      isCancelled = true;
    };
  }, [history]);

  async function handleDelete(id: string) {
    await deleteHistoryEntry(id);
    setEntries((currentEntries) => currentEntries.filter((entry) => entry.id !== id));
  }

  return (
    <main className="min-h-screen overflow-hidden bg-transparent px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <section className="relative mx-auto flex max-w-6xl flex-col gap-6">
        <div className="pointer-events-none absolute -top-28 right-4 -z-10 size-72 rounded-full bg-chart-2/25 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute top-96 -left-24 -z-10 size-80 rounded-full bg-chart-1/20 blur-3xl" aria-hidden="true" />

        <header className="grid gap-4 rounded-[2rem] border border-primary/20 bg-card/85 p-5 shadow-2xl shadow-primary/10 backdrop-blur sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="space-y-3">
            <Badge variant="outline" className="w-fit bg-background/70 uppercase tracking-[0.18em] text-primary">
              <History className="size-3" aria-hidden="true" />
              {history("pageKicker")}
            </Badge>
            <div className="space-y-2">
              <h1 className="text-4xl font-black tracking-tight sm:text-6xl" data-testid="history-title">
                {history("pageTitle")}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                {history("pageSubtitle")}
              </p>
            </div>
          </div>
          <Button asChild size="lg" className="min-h-12 rounded-xl">
            <Link href={newGameRouteFor(locale)}>
              <PlusCircle aria-hidden="true" />
              {history("newGame")}
            </Link>
          </Button>
        </header>

        {actionError ? (
          <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive" role="alert">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {actionError}
          </p>
        ) : null}

        {isLoading ? <LoadingState /> : entries.length === 0 ? <EmptyState locale={locale} /> : null}

        {entries.length > 0 ? (
          <div className="grid gap-4" data-testid="history-list">
            {entries.map((entry) => (
              <HistoryEntry key={entry.id} entry={entry} locale={locale} onDelete={handleDelete} />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
