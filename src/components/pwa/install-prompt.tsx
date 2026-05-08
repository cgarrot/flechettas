"use client";

import { Download, Smartphone, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type BeforeInstallPromptChoice = Readonly<{
  outcome: "accepted" | "dismissed";
  platform: string;
}>;

type BeforeInstallPromptEvent = Event & {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<BeforeInstallPromptChoice>;
  prompt: () => Promise<void>;
};

type NavigatorWithStandalone = Navigator & {
  readonly standalone?: boolean;
};

function hasStandaloneFlag(navigatorValue: Navigator): navigatorValue is NavigatorWithStandalone {
  return "standalone" in navigatorValue;
}

function isStandaloneDisplayMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (hasStandaloneFlag(navigator) && navigator.standalone === true)
  );
}

function isBeforeInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  const promptEvent = event as Partial<BeforeInstallPromptEvent>;

  return (
    typeof promptEvent.prompt === "function" &&
    typeof promptEvent.userChoice?.then === "function"
  );
}

export function InstallPrompt() {
  const pwa = useTranslations("Pwa");
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const displayModeQuery = window.matchMedia("(display-mode: standalone)");

    function updateStandaloneState() {
      setIsStandalone(isStandaloneDisplayMode());
    }

    function handleBeforeInstallPrompt(event: Event) {
      if (!isBeforeInstallPromptEvent(event) || isStandaloneDisplayMode()) {
        return;
      }

      event.preventDefault();
      setInstallPrompt(event);
      setIsDismissed(false);
    }

    function handleAppInstalled() {
      setInstallPrompt(null);
      setIsDismissed(true);
      updateStandaloneState();
    }

    updateStandaloneState();
    displayModeQuery.addEventListener("change", updateStandaloneState);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      displayModeQuery.removeEventListener("change", updateStandaloneState);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!installPrompt) {
      return;
    }

    setIsInstalling(true);

    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      setIsDismissed(true);
    } finally {
      setIsInstalling(false);
    }
  }

  if (!installPrompt || isDismissed || isStandalone) {
    return null;
  }

  return (
    <>
      <div className="h-[calc(30rem+env(safe-area-inset-bottom))] md:hidden" aria-hidden="true" />
      <aside className="fixed inset-x-3 bottom-[calc(11rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md md:inset-x-auto md:right-6 md:bottom-6 md:w-96">
        <div className="overflow-hidden rounded-[1.75rem] border border-primary/25 bg-card/95 shadow-2xl shadow-primary/15 backdrop-blur">
          <div className="grid gap-4 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25" aria-hidden="true">
                <Smartphone className="size-5" />
              </span>
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {pwa("installKicker")}
                </p>
                <h2 className="text-base font-semibold tracking-tight">{pwa("installTitle")}</h2>
                <p className="text-sm leading-6 text-muted-foreground">{pwa("installDescription")}</p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Button
                type="button"
                size="lg"
                className="min-h-12 rounded-xl"
                data-testid="install-app"
                disabled={isInstalling}
                onClick={() => {
                  void handleInstall();
                }}
              >
                <Download aria-hidden="true" />
                {isInstalling ? pwa("installingAction") : pwa("installAction")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="min-h-12 rounded-xl"
                data-testid="dismiss-install"
                onClick={() => setIsDismissed(true)}
              >
                <X aria-hidden="true" />
                {pwa("dismissInstall")}
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
