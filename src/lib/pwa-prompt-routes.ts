/**
 * Routes where floating PWA prompts should not obstruct focused flows
 * (setup, scoring). Keeps install/update/toast UX aligned.
 */
export function isPwaFloatingPromptSuppressedRoute(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  const routeSegment = segments[1];

  return (
    routeSegment === "partie" ||
    routeSegment === "game" ||
    routeSegment === "nouvelle-partie" ||
    routeSegment === "new-game"
  );
}

/** Setup wizards only — offline may still matter during an active game. */
export function isPwaOfflineBannerSuppressedRoute(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  const routeSegment = segments[1];

  return routeSegment === "nouvelle-partie" || routeSegment === "new-game";
}
