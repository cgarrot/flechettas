import { ArrowRight, History, Play, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActiveGameBanner } from "@/components/home/active-game-banner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { Locale } from "@/i18n/routing";

type HomeScreenProps = Readonly<{
  locale: Locale;
}>;

function newGameRouteFor(locale: Locale): string {
  return locale === "fr" ? "/fr/nouvelle-partie" : "/en/new-game";
}

function historyRouteFor(locale: Locale): string {
  return locale === "fr" ? "/fr/historique" : "/en/history";
}

export async function HomeScreen({ locale }: HomeScreenProps) {
  const home = await getTranslations("HomePage");
  const newGameRoute = newGameRouteFor(locale);
  const historyRoute = historyRouteFor(locale);

  return (
    <main className="grid min-h-[calc(100dvh-11.25rem)] overflow-x-hidden bg-transparent px-4 py-3 text-foreground sm:px-6 sm:py-5 md:min-h-[calc(100dvh-5rem)] lg:px-8">
      <section className="relative mx-auto grid w-full max-w-5xl content-center gap-3 sm:gap-4">
        <div className="pointer-events-none absolute -top-24 right-0 -z-10 size-72 rounded-full bg-chart-2/25 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute bottom-0 -left-24 -z-10 size-72 rounded-full bg-chart-1/20 blur-3xl" aria-hidden="true" />

        <header className="grid gap-3 rounded-[1.75rem] border border-primary/20 bg-card/85 p-4 shadow-2xl shadow-primary/10 backdrop-blur sm:grid-cols-[1fr_auto] sm:items-end sm:p-6">
          <div className="min-w-0 space-y-2">
            <Badge variant="outline" className="bg-background/70 uppercase tracking-[0.18em] text-primary">
              <Sparkles className="size-3" aria-hidden="true" />
              {home("kicker")}
            </Badge>
            <div className="space-y-1.5">
              <h1 className="text-4xl font-black leading-none tracking-tight sm:text-7xl" data-testid="home-title">
                {home("title")}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                {home("subtitle")}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="w-fit uppercase tracking-[0.16em]">
            <Target className="size-3" aria-hidden="true" />
            {home("quickStartKicker")}
          </Badge>
        </header>

        <ActiveGameBanner locale={locale} />

        <Card className="overflow-hidden border-primary/20 bg-card/95 py-0 shadow-2xl shadow-primary/10">
          <CardHeader className="gap-3 p-4 sm:p-6">
            <CardTitle className="text-2xl tracking-tight sm:text-4xl">
              {home("quickStartTitle")}
            </CardTitle>
            <CardDescription className="max-w-3xl text-sm leading-6 sm:text-base">
              {home("description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 pt-0 sm:grid-cols-[1fr_1fr] sm:p-6 sm:pt-0">
            <Button asChild size="lg" className="min-h-14 rounded-xl text-base" data-testid="new-game">
              <Link href={newGameRoute}>
                <Play aria-hidden="true" />
                {home("newGame")}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="min-h-14 rounded-xl text-base" data-testid="view-history">
              <Link href={historyRoute}>
                <History aria-hidden="true" />
                {home("viewHistory")}
              </Link>
            </Button>

            <div className="rounded-2xl border border-foreground/10 bg-background/60 p-3 sm:p-4">
              <p className="text-sm font-medium">{home("newGameHint")}</p>
              <p className="text-xs leading-5 text-muted-foreground">{home("newGameDescription")}</p>
            </div>
            <div className="rounded-2xl border border-foreground/10 bg-background/60 p-3 sm:p-4">
              <p className="text-sm font-medium">{home("viewHistoryHint")}</p>
              <p className="text-xs leading-5 text-muted-foreground">{home("viewHistoryDescription")}</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
