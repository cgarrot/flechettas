"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const navigation = useTranslations("Navigation");
  const { resolvedTheme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isDark = !isMounted || resolvedTheme !== "light";
  const nextTheme = isDark ? "light" : "dark";
  const currentLabel = isDark ? navigation("darkMode") : navigation("lightMode");
  const actionLabel = isDark ? navigation("switchToLight") : navigation("switchToDark");
  const Icon = isDark ? Moon : Sun;

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="min-h-11 min-w-11 rounded-xl border-primary/25 px-3 shadow-primary/10"
      data-testid="theme-toggle"
      aria-label={actionLabel}
      title={actionLabel}
      onClick={() => setTheme(nextTheme)}
    >
      <Icon aria-hidden="true" />
      <span className="hidden lg:inline">{currentLabel}</span>
    </Button>
  );
}
