"use client";

import { WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { isPwaOfflineBannerSuppressedRoute } from "@/lib/pwa-prompt-routes";

export function OfflineIndicator() {
  const pathname = usePathname();
  const pwa = useTranslations("Pwa");
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    function updateOnlineState() {
      setIsOnline(navigator.onLine);
    }

    updateOnlineState();
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);

    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  if (isOnline || isPwaOfflineBannerSuppressedRoute(pathname)) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
      className="fixed inset-x-3 top-[max(5.5rem,env(safe-area-inset-top))] z-[45] mx-auto max-w-xl rounded-2xl border border-secondary/30 bg-card/95 px-3 py-2 shadow-lg shadow-secondary/10 backdrop-blur md:inset-x-auto md:right-6 md:top-6 md:w-96 md:rounded-[1.75rem] md:p-4 md:shadow-2xl md:shadow-secondary/15"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-secondary text-secondary-foreground shadow-lg shadow-secondary/25" aria-hidden="true">
          <WifiOff className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {pwa("offlineKicker")}
          </p>
          <h2 className="text-base font-semibold tracking-tight">{pwa("offlineTitle")}</h2>
          <p className="text-sm leading-6 text-muted-foreground">{pwa("offlineDescription")}</p>
        </div>
      </div>
    </div>
  );
}
