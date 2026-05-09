"use client";

import { ArrowLeft, Target } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

import type { Locale } from "@/i18n/routing";

type AppHeaderProps = Readonly<{
  locale: Locale;
}>;

function homeRouteFor(locale: Locale): string {
  return `/${locale}`;
}

function historyRouteFor(locale: Locale): string {
  return locale === "fr" ? "/fr/historique" : "/en/history";
}

function isLocaleHomePath(pathname: string, locale: Locale): boolean {
  return pathname === homeRouteFor(locale) || pathname === `${homeRouteFor(locale)}/`;
}

function parentRouteFor(pathname: string, locale: Locale): string {
  const segments = pathname.split("/").filter(Boolean);
  const routeSegment = segments[1];

  if (routeSegment === "historique" || routeSegment === "history") {
    return segments.length > 2 ? historyRouteFor(locale) : homeRouteFor(locale);
  }

  if (routeSegment === "nouvelle-partie" || routeSegment === "new-game") {
    return homeRouteFor(locale);
  }

  if (routeSegment === "partie" || routeSegment === "game") {
    return homeRouteFor(locale);
  }

  return homeRouteFor(locale);
}

function isScoringRoute(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  const routeSegment = segments[1];

  return routeSegment === "partie" || routeSegment === "game";
}

export function AppHeader({ locale }: AppHeaderProps) {
  const pathname = usePathname();
  const navigation = useTranslations("Navigation");
  const showBackButton = !isLocaleHomePath(pathname, locale);
  const isScoring = isScoringRoute(pathname);

  return (
    <header className={cn("sticky top-0 z-30 border-b border-primary/20 bg-background/85 pt-[env(safe-area-inset-top)] shadow-lg shadow-primary/5 backdrop-blur", isScoring && "border-b-0 bg-background/70 shadow-none")}>
      <div className={cn("mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6 lg:px-8", isScoring && "px-2 py-1 sm:px-6 sm:py-3")}>
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {showBackButton ? (
            <Button asChild variant="outline" size="lg" className="min-h-11 min-w-11 rounded-xl px-3 sm:px-4">
              <Link href={parentRouteFor(pathname, locale)} aria-label={navigation("back")}>
                <ArrowLeft aria-hidden="true" />
                <span className="hidden sm:inline">{navigation("back")}</span>
              </Link>
            </Button>
          ) : null}

            <Link
            href={homeRouteFor(locale)}
              className={cn("flex min-h-11 min-w-11 items-center gap-3 rounded-2xl border border-primary/25 bg-card/90 px-3 py-2 shadow-lg shadow-primary/10 transition-[border-color,background-color,box-shadow] hover:border-primary/45 hover:bg-card", isScoring && "hidden sm:flex")}
            data-testid="app-header-brand"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25" aria-hidden="true">
              <Target className="size-4" />
            </span>
            <span className="truncate text-sm font-black tracking-tight sm:text-base">Fléchettas</span>
          </Link>
        </div>

        <div className={cn("flex shrink-0 items-center gap-2", isScoring && "hidden sm:flex")}>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
