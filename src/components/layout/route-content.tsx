"use client";

import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type RouteContentProps = Readonly<{
  children: React.ReactNode;
}>;

function isScoringRoute(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  const routeSegment = segments[1];

  return routeSegment === "partie" || routeSegment === "game";
}

export function RouteContent({ children }: RouteContentProps) {
  const pathname = usePathname();

  return (
    <div className={cn(!isScoringRoute(pathname) && "overflow-x-hidden pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-0")}>
      {children}
    </div>
  );
}
