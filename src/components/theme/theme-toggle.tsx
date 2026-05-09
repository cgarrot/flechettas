"use client";

import { Moon, Palette, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const THEME_NAMES = ["dark", "light", "brass", "club", "chalk"] as const;

type ThemeName = (typeof THEME_NAMES)[number];

const THEME_LABEL_KEYS = {
  dark: "themeDark",
  light: "themeLight",
  brass: "themeBrass",
  club: "themeClub",
  chalk: "themeChalk",
} as const satisfies Record<ThemeName, string>;

function isThemeName(theme: string | undefined): theme is ThemeName {
  return THEME_NAMES.some((themeName) => themeName === theme);
}

function nextThemeFor(theme: ThemeName): ThemeName {
  const currentIndex = THEME_NAMES.indexOf(theme);

  return THEME_NAMES[(currentIndex + 1) % THEME_NAMES.length];
}

function iconForTheme(theme: ThemeName) {
  if (theme === "light" || theme === "chalk") {
    return Sun;
  }

  if (theme === "dark") {
    return Moon;
  }

  return Palette;
}

export function ThemeToggle() {
  const navigation = useTranslations("Navigation");
  const { theme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const currentTheme = isMounted && isThemeName(theme) ? theme : "dark";
  const nextTheme = nextThemeFor(currentTheme);
  const currentLabel = isMounted ? navigation(THEME_LABEL_KEYS[currentTheme]) : navigation("themeSwitcher");
  const nextLabel = navigation(THEME_LABEL_KEYS[nextTheme]);
  const actionLabel = isMounted ? navigation("switchToTheme", { theme: nextLabel }) : navigation("themeSwitcher");
  const Icon = isMounted ? iconForTheme(currentTheme) : Palette;

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="min-h-11 min-w-11 rounded-xl border-primary/25 px-3 shadow-primary/10"
      data-testid="theme-toggle"
      aria-label={actionLabel}
      title={actionLabel}
      disabled={!isMounted}
      onClick={() => {
        if (!isMounted) {
          return;
        }

        setTheme(nextTheme);
      }}
    >
      <Icon aria-hidden="true" />
      <span className="hidden lg:inline">{currentLabel}</span>
    </Button>
  );
}
