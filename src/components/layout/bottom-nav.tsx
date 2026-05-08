"use client";

import { History, Home, PlusCircle } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import type { Locale } from "@/i18n/routing";

type BottomNavProps = Readonly<{
  locale: Locale;
}>;

type ActiveTab = "home" | "newGame" | "history" | null;

function homeRouteFor(locale: Locale): string {
  return `/${locale}`;
}

function setupRouteFor(locale: Locale): string {
  return locale === "fr" ? "/fr/nouvelle-partie" : "/en/new-game";
}

function historyRouteFor(locale: Locale): string {
  return locale === "fr" ? "/fr/historique" : "/en/history";
}

function activeTabFor(pathname: string, locale: Locale): ActiveTab {
  const segments = pathname.split("/").filter(Boolean);
  const routeSegment = segments[1];

  if (pathname === homeRouteFor(locale) || pathname === `${homeRouteFor(locale)}/`) {
    return "home";
  }

  if (routeSegment === "nouvelle-partie" || routeSegment === "new-game") {
    return "newGame";
  }

  if (routeSegment === "historique" || routeSegment === "history") {
    return "history";
  }

  return null;
}

export function BottomNav({ locale }: BottomNavProps) {
  const pathname = usePathname();
  const navigation = useTranslations("Navigation");
  const activeTab = activeTabFor(pathname, locale);
  const items = [
    {
      key: "home",
      href: homeRouteFor(locale),
      label: navigation("home"),
      testId: "nav-home",
      icon: Home,
    },
    {
      key: "newGame",
      href: setupRouteFor(locale),
      label: navigation("newGame"),
      testId: "nav-new-game",
      icon: PlusCircle,
    },
    {
      key: "history",
      href: historyRouteFor(locale),
      label: navigation("history"),
      testId: "nav-history",
      icon: History,
    },
  ] as const;

  return (
    <nav
      aria-label={navigation("ariaLabel")}
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 grid grid-cols-3 gap-2 rounded-[1.75rem] border border-primary/25 bg-card/95 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl shadow-primary/15 backdrop-blur md:inset-x-auto md:top-1/2 md:bottom-auto md:left-4 md:w-20 md:-translate-y-1/2 md:grid-cols-1 md:rounded-[2rem] md:pb-2"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.key;

        return (
          <Link
            key={item.key}
            href={item.href}
            data-testid={item.testId}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-2 text-center text-xs font-bold transition-[background-color,color,box-shadow,transform] hover:bg-primary/10 hover:text-foreground active:translate-y-px md:min-h-16",
              isActive
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 hover:text-primary-foreground"
                : "text-muted-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
            <span className="leading-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
