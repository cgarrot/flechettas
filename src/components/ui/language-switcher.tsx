"use client";

import { Languages } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { Locale } from "@/i18n/routing";

type LanguageSwitcherProps = Readonly<{
  locale: Locale;
  className?: string;
}>;

const localeOptions = ["fr", "en"] as const satisfies readonly Locale[];

function homeRouteFor(locale: Locale): string {
  return `/${locale}`;
}

function setupRouteFor(locale: Locale): string {
  return locale === "fr" ? "/fr/nouvelle-partie" : "/en/new-game";
}

function gameRouteFor(locale: Locale): string {
  return locale === "fr" ? "/fr/partie" : "/en/game";
}

function historyRouteFor(locale: Locale): string {
  return locale === "fr" ? "/fr/historique" : "/en/history";
}

function equivalentRouteFor(pathname: string, targetLocale: Locale): string {
  const segments = pathname.split("/").filter(Boolean);
  const routeSegment = segments[1];
  const historyId = segments.slice(2).join("/");

  if (!routeSegment) {
    return homeRouteFor(targetLocale);
  }

  if (routeSegment === "nouvelle-partie" || routeSegment === "new-game") {
    return setupRouteFor(targetLocale);
  }

  if (routeSegment === "partie" || routeSegment === "game") {
    return gameRouteFor(targetLocale);
  }

  if (routeSegment === "historique" || routeSegment === "history") {
    const historyRoute = historyRouteFor(targetLocale);

    return historyId ? `${historyRoute}/${historyId}` : historyRoute;
  }

  return homeRouteFor(targetLocale);
}

export function LanguageSwitcher({ locale, className }: LanguageSwitcherProps) {
  const pathname = usePathname();
  const navigation = useTranslations("Navigation");
  const misc = useTranslations("Misc");

  return (
    <nav
      className={cn("flex items-center gap-1 rounded-2xl border border-primary/20 bg-card/75 p-1.5 shadow-sm shadow-primary/10", className)}
      aria-label={navigation("languageSwitcher")}
      data-testid="lang-switcher"
    >
      <Languages className="ml-1 size-4 text-muted-foreground" aria-hidden="true" />
      {localeOptions.map((targetLocale) => {
        const languageLabel = misc(targetLocale);

        return (
          <Button
            key={targetLocale}
            asChild
            variant={locale === targetLocale ? "default" : "ghost"}
            size="sm"
            className={cn("min-h-11 rounded-xl px-3", locale !== targetLocale && "text-muted-foreground")}
          >
            <Link
              href={equivalentRouteFor(pathname, targetLocale)}
              aria-label={navigation("switchLanguageTo", { language: languageLabel })}
              aria-current={locale === targetLocale ? "page" : undefined}
              data-testid={`lang-${targetLocale}`}
            >
              {languageLabel}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
