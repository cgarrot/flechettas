"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { Locale } from "@/i18n/routing";

type LeaveGameButtonProps = Readonly<{
  locale: Locale;
  children?: React.ReactNode;
  ariaLabel?: string;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost";
}>;

function homeRouteFor(locale: Locale): string {
  return `/${locale}`;
}

export function LeaveGameButton({
  locale,
  children,
  ariaLabel,
  className,
  size = "lg",
  variant = "outline",
}: LeaveGameButtonProps) {
  const router = useRouter();
  const game = useTranslations("Game");
  const [isOpen, setIsOpen] = useState(false);

  function leaveGame() {
    setIsOpen(false);
    router.push(homeRouteFor(locale));
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        aria-label={ariaLabel ?? game("leaveGame")}
        onClick={() => setIsOpen(true)}
      >
        {children ?? (
          <>
            <ArrowLeft aria-hidden="true" />
            {game("backToHome")}
          </>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="border-primary/20 bg-card/95 sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle>{game("leaveTitle")}</DialogTitle>
            <DialogDescription>{game("leaveDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              {game("stayInGame")}
            </Button>
            <Button type="button" data-testid="confirm-leave-game" onClick={leaveGame}>
              <ArrowLeft aria-hidden="true" />
              {game("leaveGame")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
