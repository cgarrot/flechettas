"use client";

import { Activity, BarChart3, Gauge, Percent, Target } from "lucide-react";
import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { Locale } from "@/i18n/routing";
import type { PlayerMatchStats, PlayerModeStats, ScoreBucketKey } from "@/types";

type StatsBreakdownProps = Readonly<{
  locale: Locale;
  playerStats: readonly PlayerMatchStats[];
}>;

type StatTileProps = Readonly<{
  label: string;
  value: string;
  icon: React.ReactNode;
}>;

const SCORE_BUCKETS = [
  "40+",
  "60+",
  "80+",
  "100+",
  "120+",
  "140+",
  "160+",
  "180",
] as const satisfies readonly ScoreBucketKey[];

function checkoutRateFor(modeStats: PlayerModeStats): number | null {
  switch (modeStats.mode) {
    case "x01":
    case "checkout-121":
      return modeStats.checkoutRate;
    case "cricket":
    case "around-the-clock":
    case "bobs-27":
    case "shanghai":
    case "training":
    case "killer":
      return null;
  }
}

function highestCheckoutFor(modeStats: PlayerModeStats): number | null {
  if (modeStats.mode !== "x01" || modeStats.highestCheckout === undefined) {
    return null;
  }

  return modeStats.highestCheckout;
}

function StatTile({ label, value, icon }: StatTileProps) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/65 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="font-mono text-3xl font-black tracking-tight">{value}</p>
    </div>
  );
}

export function StatsBreakdown({ locale, playerStats }: StatsBreakdownProps) {
  const history = useTranslations("History");
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    [locale],
  );

  return (
    <section className="space-y-4" aria-labelledby="history-stats-title">
      <div className="space-y-2">
        <Badge variant="outline" className="bg-background/70 uppercase tracking-[0.18em] text-primary">
          <BarChart3 className="size-3" aria-hidden="true" />
          {history("statsKicker")}
        </Badge>
        <h2 id="history-stats-title" className="text-2xl font-black tracking-tight sm:text-3xl">
          {history("statsTitle")}
        </h2>
      </div>

      <div className="grid gap-4">
        {playerStats.map((stats, index) => {
          const checkoutRate = checkoutRateFor(stats.modeStats);
          const highestCheckout = highestCheckoutFor(stats.modeStats);
          const maxBucketCount = Math.max(
            1,
            ...SCORE_BUCKETS.map((bucket) => stats.scoreBuckets[bucket]),
          );

          return (
            <Card
              key={stats.playerId}
              className="overflow-hidden border-primary/20 bg-card/95 py-0 shadow-xl shadow-primary/5"
              data-testid={`stats-player-${index + 1}`}
            >
              <CardHeader className="border-b border-border/70 bg-background/65 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl tracking-tight">{stats.playerName}</CardTitle>
                    <CardDescription>{history("playerStatsDescription")}</CardDescription>
                  </div>
                  <Badge variant="secondary">{history("playerRank", { number: index + 1 })}</Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-5 p-5 sm:p-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <StatTile
                    label={history("statAverage")}
                    value={numberFormatter.format(stats.average3Dart)}
                    icon={<Gauge className="size-3" aria-hidden="true" />}
                  />
                  <StatTile
                    label={history("statCheckout")}
                    value={checkoutRate === null ? history("notAvailable") : `${numberFormatter.format(checkoutRate)}%`}
                    icon={<Percent className="size-3" aria-hidden="true" />}
                  />
                  <StatTile
                    label={history("stat180s")}
                    value={numberFormatter.format(stats.scoreBuckets["180"])}
                    icon={<Target className="size-3" aria-hidden="true" />}
                  />
                  <StatTile
                    label={history("statHighestCheckout")}
                    value={highestCheckout === null ? history("notAvailable") : numberFormatter.format(highestCheckout)}
                    icon={<Target className="size-3" aria-hidden="true" />}
                  />
                  <StatTile
                    label={history("statHighestTurn")}
                    value={numberFormatter.format(stats.highestTurn)}
                    icon={<Activity className="size-3" aria-hidden="true" />}
                  />
                  <StatTile
                    label={history("statDartsThrown")}
                    value={numberFormatter.format(stats.dartsThrown)}
                    icon={<Target className="size-3" aria-hidden="true" />}
                  />
                </div>

                <div className="rounded-2xl border border-border/70 bg-background/65 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {history("scoreDistribution")}
                    </h3>
                    <Badge variant="outline" className="bg-card/80">
                      {history("turnBuckets")}
                    </Badge>
                  </div>
                  <div className="space-y-3">
                    {SCORE_BUCKETS.map((bucket) => {
                      const bucketCount = stats.scoreBuckets[bucket];
                      const width = `${Math.round((bucketCount / maxBucketCount) * 100)}%`;

                      return (
                        <div key={bucket} className="grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-3 text-sm">
                          <span className="font-medium">{bucket}</span>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-chart-2" style={{ width }} />
                          </div>
                          <span className="text-right tabular-nums text-muted-foreground">
                            {numberFormatter.format(bucketCount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
