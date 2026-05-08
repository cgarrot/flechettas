"use client";

import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

const SKIP_WAITING_MESSAGE = { type: "SKIP_WAITING" } as const;

export function UpdatePrompt() {
  const pwa = useTranslations("Pwa");
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const hasReloadedRef = useRef(false);
  const shouldReloadOnControllerChangeRef = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return undefined;
    }

    let isMounted = true;
    const cleanupCallbacks: Array<() => void> = [];

    function showWaitingWorker(registration: ServiceWorkerRegistration) {
      if (!isMounted || !registration.waiting) {
        return;
      }

      setWaitingWorker(registration.waiting);
    }

    function trackInstallingWorker(registration: ServiceWorkerRegistration) {
      const installingWorker = registration.installing;

      if (!installingWorker) {
        return;
      }

      const trackedWorker = installingWorker;

      function handleStateChange() {
        if (
          trackedWorker.state === "installed" &&
          navigator.serviceWorker.controller &&
          isMounted
        ) {
          setWaitingWorker(registration.waiting ?? trackedWorker);
        }
      }

      trackedWorker.addEventListener("statechange", handleStateChange);
      cleanupCallbacks.push(() => {
        trackedWorker.removeEventListener("statechange", handleStateChange);
      });
    }

    function trackRegistration(registration: ServiceWorkerRegistration) {
      showWaitingWorker(registration);
      trackInstallingWorker(registration);

      function handleUpdateFound() {
        trackInstallingWorker(registration);
      }

      registration.addEventListener("updatefound", handleUpdateFound);
      cleanupCallbacks.push(() => {
        registration.removeEventListener("updatefound", handleUpdateFound);
      });
    }

    function reloadWhenControlled() {
      if (!shouldReloadOnControllerChangeRef.current || hasReloadedRef.current) {
        return;
      }

      hasReloadedRef.current = true;
      window.location.reload();
    }

    navigator.serviceWorker.addEventListener("controllerchange", reloadWhenControlled);
    cleanupCallbacks.push(() => {
      navigator.serviceWorker.removeEventListener("controllerchange", reloadWhenControlled);
    });

    void navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration && isMounted) {
        trackRegistration(registration);
      }
    });

    return () => {
      isMounted = false;
      cleanupCallbacks.forEach((cleanup) => cleanup());
    };
  }, []);

  function handleUpdate() {
    if (!waitingWorker) {
      return;
    }

    setIsUpdating(true);
    shouldReloadOnControllerChangeRef.current = true;
    waitingWorker.postMessage(SKIP_WAITING_MESSAGE);

    window.setTimeout(() => {
      if (!hasReloadedRef.current) {
        hasReloadedRef.current = true;
        window.location.reload();
      }
    }, 1500);
  }

  if (!waitingWorker) {
    return null;
  }

  return (
    <aside className="fixed inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md md:inset-x-auto md:right-6 md:bottom-32 md:w-96">
      <div className="overflow-hidden rounded-[1.75rem] border border-primary/25 bg-card/95 shadow-2xl shadow-primary/15 backdrop-blur">
        <div className="grid gap-4 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25" aria-hidden="true">
              <RefreshCw className="size-5" />
            </span>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {pwa("updateKicker")}
              </p>
              <h2 className="text-base font-semibold tracking-tight">{pwa("updateTitle")}</h2>
              <p className="text-sm leading-6 text-muted-foreground">{pwa("updateDescription")}</p>
            </div>
          </div>

          <Button
            type="button"
            size="lg"
            className="min-h-12 rounded-xl"
            data-testid="update-app"
            disabled={isUpdating}
            onClick={handleUpdate}
          >
            <RefreshCw className={isUpdating ? "animate-spin" : undefined} aria-hidden="true" />
            {isUpdating ? pwa("updatingAction") : pwa("updateAction")}
          </Button>
        </div>
      </div>
    </aside>
  );
}
