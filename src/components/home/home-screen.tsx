import { ArrowRight, History, Play, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { ActiveGameBanner } from "@/components/home/active-game-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import type { Locale } from "@/i18n/routing";

type HomeScreenProps = Readonly<{
  locale: Locale;
}>;

const featuredModes = [
  { labelKey: "x01", descriptionKey: "spotlightX01" },
  { labelKey: "cricket", descriptionKey: "spotlightCricket" },
  { labelKey: "checkout121", descriptionKey: "spotlightCheckout" },
] as const;

function newGameRouteFor(locale: Locale): string {
  return locale === "fr" ? "/fr/nouvelle-partie" : "/en/new-game";
}

function historyRouteFor(locale: Locale): string {
  return locale === "fr" ? "/fr/historique" : "/en/history";
}

function DartboardGraphic({ label }: Readonly<{ label: string }>) {
  return (
    <div
      role="img"
      aria-label={label}
      className="relative mx-auto grid size-60 place-items-center rounded-full border border-primary/25 bg-card/90 p-4 shadow-2xl shadow-primary/20 sm:size-72"
    >
      <span className="absolute inset-4 rounded-full border-8 border-chart-1 bg-background" aria-hidden="true" />
      <span className="absolute inset-9 rounded-full border-8 border-chart-2 bg-card" aria-hidden="true" />
      <span className="absolute inset-16 rounded-full border-4 border-accent bg-background" aria-hidden="true" />
      <span className="absolute inset-24 rounded-full border-4 border-primary bg-card" aria-hidden="true" />
      <span className="absolute h-px w-full bg-foreground/10" aria-hidden="true" />
      <span className="absolute h-full w-px bg-foreground/10" aria-hidden="true" />
      <span className="absolute h-full w-px rotate-45 bg-foreground/10" aria-hidden="true" />
      <span className="absolute h-full w-px -rotate-45 bg-foreground/10" aria-hidden="true" />
      <span className="relative grid size-10 place-items-center rounded-full bg-secondary shadow-lg shadow-secondary/30" aria-hidden="true">
        <span className="size-3 rounded-full bg-background" />
      </span>
    </div>
  );
}

export async function HomeScreen({ locale }: HomeScreenProps) {
  const home = await getTranslations("HomePage");
  const modes = await getTranslations("Modes");
  const newGameRoute = newGameRouteFor(locale);
  const historyRoute = historyRouteFor(locale);

  return (
    <main className="min-h-screen overflow-hidden bg-transparent px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <section className="relative mx-auto flex max-w-6xl flex-col gap-6">
        <div className="pointer-events-none absolute -top-28 right-0 -z-10 size-72 rounded-full bg-chart-2/25 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute top-96 -left-24 -z-10 size-80 rounded-full bg-chart-1/20 blur-3xl" aria-hidden="true" />

        <header className="grid gap-4 rounded-[2rem] border border-primary/20 bg-card/85 p-4 shadow-2xl shadow-primary/10 backdrop-blur sm:p-6">
          <div className="space-y-3">
            <Badge variant="outline" className="bg-background/70 uppercase tracking-[0.18em] text-primary">
              <Sparkles className="size-3" aria-hidden="true" />
              {home("kicker")}
            </Badge>
            <div className="space-y-2">
              <h1 className="text-5xl font-black tracking-tight sm:text-6xl" data-testid="home-title">
                {home("title")}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                {home("subtitle")}
              </p>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
          <Card className="overflow-hidden border-primary/20 bg-card/95 py-0 shadow-2xl shadow-primary/10">
            <CardHeader className="gap-5 p-6 sm:p-8">
              <div className="space-y-3">
                <Badge variant="secondary" className="uppercase tracking-[0.18em]">
                  <Target className="size-3" aria-hidden="true" />
                  {home("quickStartKicker")}
                </Badge>
                <div className="space-y-3">
                  <CardTitle className="text-3xl tracking-tight sm:text-4xl">
                    {home("quickStartTitle")}
                  </CardTitle>
                  <CardDescription className="max-w-2xl text-base leading-7">
                    {home("description")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-6 pt-0 sm:p-8 sm:pt-0">
              <div className="grid gap-3 sm:grid-cols-2">
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
              </div>

              <div className="grid gap-3 rounded-2xl border border-foreground/10 bg-background/60 p-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{home("newGameHint")}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{home("newGameDescription")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{home("viewHistoryHint")}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{home("viewHistoryDescription")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-primary/20 bg-card/85 py-0 shadow-2xl shadow-primary/10">
            <CardContent className="grid h-full gap-6 p-6 sm:p-8">
              <DartboardGraphic label={home("dartboardLabel")} />
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <div className="rounded-2xl border border-foreground/10 bg-background/60 p-4">
                  <p className="font-mono text-3xl font-black tracking-tight">{home("boardModesValue")}</p>
                  <p className="text-xs text-muted-foreground">{home("boardModes")}</p>
                </div>
                <div className="rounded-2xl border border-foreground/10 bg-background/60 p-4">
                  <p className="font-mono text-3xl font-black tracking-tight">{home("boardLanguagesValue")}</p>
                  <p className="text-xs text-muted-foreground">{home("boardLanguages")}</p>
                </div>
                <div className="rounded-2xl border border-foreground/10 bg-background/60 p-4">
                  <p className="font-mono text-3xl font-black tracking-tight">{home("boardLocalValue")}</p>
                  <p className="text-xs text-muted-foreground">{home("boardLocal")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <ActiveGameBanner locale={locale} />

        <section className="space-y-4" aria-labelledby="home-modes-title">
          <div className="space-y-2">
              <Badge variant="outline" className="bg-background/70 uppercase tracking-[0.18em] text-primary">
              {home("spotlightKicker")}
            </Badge>
              <h2 id="home-modes-title" className="text-2xl font-black tracking-tight sm:text-3xl">
              {home("spotlightTitle")}
            </h2>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {featuredModes.map((mode) => (
              <Card key={mode.labelKey} className="border-primary/15 bg-card/90 shadow-lg shadow-primary/5">
                <CardHeader>
                  <CardTitle>{modes(mode.labelKey)}</CardTitle>
                  <CardDescription className="leading-6">
                    {home(mode.descriptionKey)}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <Separator className="bg-foreground/10" />
      </section>
    </main>
  );
}
