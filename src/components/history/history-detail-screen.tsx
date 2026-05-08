"use client";

import { AlertTriangle, ArrowLeft, CalendarDays, Clock3, FileText, Loader2, Play, RotateCcw, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { StatsBreakdown } from "@/components/history/stats-breakdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loadGameDetail } from "@/services/history-service";
import { useGameStore } from "@/store";

import type { Locale } from "@/i18n/routing";
import type { GameConfig, GameEvent, GameMode, HistoryDetail, PlayerDef, PlayerId } from "@/types";

type HistoryDetailScreenProps = Readonly<{
  gameId: string;
  locale: Locale;
}>;

type SummaryItem = Readonly<{
  label: string;
  value: string;
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

function historyRouteFor(locale: Locale): string {
  return locale === "fr" ? "/fr/historique" : "/en/history";
}

function gameRouteFor(locale: Locale): string {
  return locale === "fr" ? "/fr/partie" : "/en/game";
}

function modeLabelFor(
  detail: HistoryDetail,
  modeLabel: (key: string) => string,
): string {
  const displayModePrefix = "Modes.";

  if (detail.displayMode.startsWith(displayModePrefix)) {
    return modeLabel(detail.displayMode.slice(displayModePrefix.length));
  }

  return modeLabel(modeMessageKeys[detail.mode]);
}

function playerDefsFromDetail(detail: HistoryDetail): readonly PlayerDef[] {
  if (detail.config.players.length > 0) {
    return detail.config.players;
  }

  if (detail.result && detail.result.finalPlayers.length > 0) {
    return detail.result.finalPlayers.map((player) => ({
      id: player.id,
      name: player.name,
      isBot: player.isBot,
      botLevel: player.botLevel,
    }));
  }

  return detail.stats.playerStats.map((stats) => ({
    id: stats.playerId,
    name: stats.playerName,
    isBot: false,
  }));
}

function configWithPlayers(config: GameConfig, players: readonly PlayerDef[]): GameConfig {
  switch (config.mode) {
    case "x01":
      return { ...config, players };
    case "cricket":
      return { ...config, players };
    case "around-the-clock":
      return { ...config, players };
    case "bobs-27":
      return { ...config, players };
    case "checkout-121":
      return { ...config, players };
    case "shanghai":
      return { ...config, players };
    case "training":
      return { ...config, players };
    case "killer":
      return { ...config, players };
  }
}

function cricketVariantKey(variant: GameConfig & { mode: "cricket" }): string {
  switch (variant.variant) {
    case "standard":
      return "standard";
    case "cut-throat":
      return "cutThroat";
    case "no-score":
      return "noScore";
  }
}

function configSummaryItems(
  config: GameConfig,
  label: (key: string) => string,
  yesNo: (value: boolean | undefined) => string,
): readonly SummaryItem[] {
  const legsToWin = config.matchFormat?.legsToWin ?? 1;
  const setsToWin = config.matchFormat?.setsToWin ?? 1;
  const base = [
    { label: label("legsToWin"), value: String(legsToWin) },
    { label: label("setsToWin"), value: String(setsToWin) },
  ];

  switch (config.mode) {
    case "x01":
      return [
        ...base,
        { label: label("startScore"), value: String(config.startingScore) },
        { label: label("doubleIn"), value: yesNo(config.doubleIn) },
        { label: label("doubleOut"), value: yesNo(config.doubleOut) },
      ];
    case "cricket":
      return [
        ...base,
        { label: label("variant"), value: label(cricketVariantKey(config)) },
        { label: label("scorePoints"), value: yesNo(config.scorePoints) },
      ];
    case "around-the-clock":
      return [
        ...base,
        { label: label("startSegment"), value: String(config.startSegment) },
        { label: label("endSegment"), value: String(config.endSegment) },
        { label: label("requiredMultiplier"), value: config.requiredMultiplier === "open" || !config.requiredMultiplier ? label("open") : String(config.requiredMultiplier) },
      ];
    case "bobs-27":
      return [
        ...base,
        { label: label("startScore"), value: String(config.startingScore) },
        { label: label("allowNegativeScore"), value: yesNo(config.allowNegativeScore) },
      ];
    case "checkout-121":
      return [
        ...base,
        { label: label("dartsPerTarget"), value: String(config.dartsPerTarget) },
        { label: label("successStep"), value: String(config.successStep) },
        { label: label("failureStep"), value: String(config.failureStep) },
      ];
    case "shanghai":
      return [
        ...base,
        { label: label("instantShanghaiWin"), value: yesNo(config.instantShanghaiWin) },
      ];
    case "training":
      return [
        ...base,
        { label: label("trainingFocus"), value: label(`focus${config.focus.charAt(0).toUpperCase()}${config.focus.slice(1)}`) },
        { label: label("rounds"), value: String(config.rounds ?? 1) },
      ];
    case "killer":
      return [
        ...base,
        { label: label("startingLives"), value: String(config.startingLives) },
        { label: label("assignment"), value: label(config.assignment === "first-hit" ? "assignmentFirstHit" : `assignment${config.assignment.charAt(0).toUpperCase()}${config.assignment.slice(1)}`) },
        { label: label("requiredHitsToBecomeKiller"), value: String(config.requiredHitsToBecomeKiller) },
      ];
  }
}

function eventNameKey(type: GameEvent["type"]): string {
  switch (type) {
    case "game_started":
      return "eventNames.gameStarted";
    case "dart_thrown":
      return "eventNames.dartThrown";
    case "turn_total_submitted":
      return "eventNames.turnTotalSubmitted";
    case "turn_complete":
      return "eventNames.turnComplete";
    case "player_bust":
      return "eventNames.playerBust";
    case "leg_won":
      return "eventNames.legWon";
    case "set_won":
      return "eventNames.setWon";
    case "round_advanced":
      return "eventNames.roundAdvanced";
    case "match_won":
      return "eventNames.matchWon";
    case "undo":
      return "eventNames.undo";
  }
}

function durationMinutes(duration: number | undefined): number {
  if (duration === undefined) {
    return 0;
  }

  return Math.max(1, Math.round(duration / 60000));
}

function LoadingState() {
  const history = useTranslations("History");

  return (
    <Card className="border-primary/20 bg-card/85 shadow-xl shadow-primary/10">
      <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 py-10 text-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" aria-hidden="true" />
        <p className="text-sm font-medium">{history("loadingDetail")}</p>
      </CardContent>
    </Card>
  );
}

function MissingState({ locale }: Readonly<{ locale: Locale }>) {
  const history = useTranslations("History");

  return (
    <Card className="border-dashed border-primary/25 bg-card/85 shadow-xl shadow-primary/10" data-testid="history-detail-missing">
      <CardHeader className="gap-3 text-center">
        <Badge variant="outline" className="mx-auto bg-background/70 uppercase tracking-[0.18em] text-primary">
          <AlertTriangle className="size-3" aria-hidden="true" />
          {history("missingKicker")}
        </Badge>
        <div className="space-y-2">
          <CardTitle className="text-3xl tracking-tight">{history("missingTitle")}</CardTitle>
          <CardDescription className="mx-auto max-w-xl text-base leading-7">
            {history("missingDescription")}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex justify-center pb-8">
        <Button asChild size="lg" className="min-h-14 rounded-xl text-base">
          <Link href={historyRouteFor(locale)}>
            <ArrowLeft aria-hidden="true" />
            {history("backToHistory")}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function HistoryDetailScreen({ gameId, locale }: HistoryDetailScreenProps) {
  const history = useTranslations("History");
  const modes = useTranslations("Modes");
  const gameConfig = useTranslations("GameConfig");
  const misc = useTranslations("Misc");
  const router = useRouter();
  const newGame = useGameStore((state) => state.newGame);
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReplaying, setIsReplaying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }),
    [locale],
  );
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale),
    [locale],
  );

  useEffect(() => {
    let isCancelled = false;

    async function loadDetail() {
      setIsLoading(true);
      setActionError(null);

      try {
        const loadedDetail = await loadGameDetail(gameId);

        if (!isCancelled) {
          setDetail(loadedDetail);
        }
      } catch {
        if (!isCancelled) {
          setActionError(history("loadDetailFailed"));
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadDetail();

    return () => {
      isCancelled = true;
    };
  }, [gameId, history]);

  const playerNameById = useMemo(() => {
    const names = new Map<PlayerId, string>();

    if (!detail) {
      return names;
    }

    for (const player of detail.config.players) {
      names.set(player.id, player.name);
    }

    for (const player of detail.result?.finalPlayers ?? []) {
      names.set(player.id, player.name);
    }

    for (const stats of detail.stats.playerStats) {
      names.set(stats.playerId, stats.playerName);
    }

    return names;
  }, [detail]);

  async function handleReplay() {
    if (!detail) {
      return;
    }

    setIsReplaying(true);
    setActionError(null);

    try {
      const players = playerDefsFromDetail(detail);

      await newGame(configWithPlayers(detail.config, players), players);
      router.push(gameRouteFor(locale));
    } catch {
      setActionError(history("replayFailed"));
    } finally {
      setIsReplaying(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen overflow-hidden bg-transparent px-4 py-6 text-foreground sm:px-6 lg:px-8">
        <section className="relative mx-auto flex max-w-6xl flex-col gap-6">
          <LoadingState />
        </section>
      </main>
    );
  }

  if (!detail) {
    return (
      <main className="min-h-screen overflow-hidden bg-transparent px-4 py-6 text-foreground sm:px-6 lg:px-8">
        <section className="relative mx-auto flex max-w-6xl flex-col gap-6">
          <MissingState locale={locale} />
        </section>
      </main>
    );
  }

  const modeLabel = modeLabelFor(detail, (key) => modes(key));
  const completedAt = detail.completedAt ?? detail.startedAt;
  const configItems = configSummaryItems(
    detail.config,
    (key) => gameConfig(key),
    (value) => misc(value ? "yes" : "no"),
  );
  const recentEvents = detail.events.slice(-6).reverse();
  const eventCounts = detail.events.reduce<Record<GameEvent["type"], number>>(
    (counts, event) => ({ ...counts, [event.type]: counts[event.type] + 1 }),
    {
      game_started: 0,
      dart_thrown: 0,
      turn_total_submitted: 0,
      turn_complete: 0,
      player_bust: 0,
      leg_won: 0,
      set_won: 0,
      round_advanced: 0,
      match_won: 0,
      undo: 0,
    },
  );
  const visibleEventCounts = Object.entries(eventCounts).filter(([, count]) => count > 0);

  return (
    <main className="min-h-screen overflow-hidden bg-transparent px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <section className="relative mx-auto flex max-w-6xl flex-col gap-6">
        <div className="pointer-events-none absolute -top-28 right-4 -z-10 size-72 rounded-full bg-chart-2/25 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute top-96 -left-24 -z-10 size-80 rounded-full bg-chart-1/20 blur-3xl" aria-hidden="true" />

        <header className="grid gap-4 rounded-[2rem] border border-primary/20 bg-card/85 p-5 shadow-2xl shadow-primary/10 backdrop-blur sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="space-y-3">
            <Button asChild variant="ghost" size="sm" className="min-h-11 w-fit rounded-xl text-muted-foreground">
              <Link href={historyRouteFor(locale)}>
                <ArrowLeft aria-hidden="true" />
                {history("backToHistory")}
              </Link>
            </Button>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{modeLabel}</Badge>
                {detail.winnerName ? (
                    <Badge variant="outline" className="bg-background/70">
                    {history("winner", { player: detail.winnerName })}
                  </Badge>
                ) : null}
              </div>
              <h1 className="text-4xl font-black tracking-tight sm:text-6xl" data-testid="history-detail-title">
                {history("detailTitle", { mode: modeLabel })}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                {history("detailSubtitle")}
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="lg"
            className="min-h-12 rounded-xl"
            data-testid="replay-config"
            disabled={isReplaying}
            onClick={() => {
              void handleReplay();
            }}
          >
            {isReplaying ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
            {isReplaying ? history("replaying") : history("replayConfig")}
          </Button>
        </header>

        {actionError ? (
          <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive" role="alert">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {actionError}
          </p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-primary/20 bg-card/95 shadow-xl shadow-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-5 text-primary" aria-hidden="true" />
                {history("configSummary")}
              </CardTitle>
              <CardDescription>{history("configSummaryDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 rounded-2xl border border-border/70 bg-background/65 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="size-4" aria-hidden="true" />
                  {history("players")}
                </div>
                <p className="font-medium leading-6">{detail.playerNames.join(" · ")}</p>
              </div>
              {configItems.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/65 px-4 py-3 text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-card/95 shadow-xl shadow-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="size-5 text-primary" aria-hidden="true" />
                {history("matchSummary")}
              </CardTitle>
              <CardDescription>{history("matchSummaryDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-background/65 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {history("startedAt")}
                </p>
                <p className="mt-2 font-medium">{dateFormatter.format(new Date(detail.startedAt))}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/65 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {history("completedAt")}
                </p>
                <p className="mt-2 font-medium">{dateFormatter.format(new Date(completedAt))}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/65 p-4">
                <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  <Clock3 className="size-3" aria-hidden="true" />
                  {history("duration")}
                </p>
                <p className="mt-2 font-mono text-3xl font-black tracking-tight">
                  {history("durationMinutes", { minutes: durationMinutes(detail.duration) })}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/65 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {history("eventsRecorded")}
                </p>
                <p className="mt-2 font-mono text-3xl font-black tracking-tight">
                  {numberFormatter.format(detail.events.length)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <StatsBreakdown locale={locale} playerStats={detail.stats.playerStats} />

        <Card className="border-primary/20 bg-card/95 shadow-xl shadow-primary/5">
          <CardHeader>
            <CardTitle>{history("eventSummary")}</CardTitle>
            <CardDescription>{history("eventSummaryDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
            <div className="grid gap-2">
              {visibleEventCounts.map(([type, count]) => (
                 <div key={type} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/65 px-4 py-3 text-sm">
                  <span className="text-muted-foreground">{history(eventNameKey(type as GameEvent["type"]))}</span>
                  <span className="font-semibold tabular-nums">{numberFormatter.format(count)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {history("recentEvents")}
              </h3>
              {recentEvents.length === 0 ? (
                 <p className="rounded-xl border border-border/70 bg-background/65 px-4 py-3 text-sm text-muted-foreground">
                  {history("noEvents")}
                </p>
              ) : (
                <div className="grid gap-2">
                  {recentEvents.map((event) => {
                    const eventName = history(eventNameKey(event.type));
                    const playerName = event.playerId ? playerNameById.get(event.playerId) : undefined;

                    return (
                      <div key={event.id} className="rounded-xl border border-border/70 bg-background/65 px-4 py-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">
                            {playerName ? history("eventWithPlayer", { event: eventName, player: playerName }) : eventName}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {dateFormatter.format(new Date(event.occurredAt))}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Button asChild size="lg" variant="outline" className="min-h-12 self-start rounded-xl">
          <Link href={historyRouteFor(locale)}>
            <Play aria-hidden="true" />
            {history("backToHistory")}
          </Link>
        </Button>
      </section>
    </main>
  );
}
