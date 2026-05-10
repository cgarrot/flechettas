"use client";

import { BarChart3, Link2, Plus, Settings, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  isValidSharedSessionCode,
  MAX_SHARED_SESSION_CODE_LENGTH,
  MIN_SHARED_SESSION_CODE_LENGTH,
  normalizeSharedSessionCode,
} from "@/lib/shared-session-code";
import { clearDismissedSharedActiveGame } from "@/lib/shared-active-game-dismissal";
import { createSharedSession, createSharedSessionPlayer, deleteSharedSessionPlayer, ensureSharedSession, fetchSharedSession } from "@/lib/shared-session-api";
import {
  clearStoredSessionCode,
  clearStoredSessionPlayerId,
  normalizeStoredSessionCode,
  readOrCreateDeviceId,
  readStoredSessionCode,
  readStoredSessionPlayerId,
  writeStoredSessionCode,
  writeStoredSessionPlayerId,
} from "@/lib/shared-session-storage";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/store";

import type { PlayerId, SharedSessionPlayer, SharedSessionSummary } from "@/types";
import type { Locale } from "@/i18n/routing";

const SESSION_PLAYERS_POLL_MS = 15_000;
type ShareStatus = "idle" | "copied" | "failed";

function sharedSessionPlayersEqual(
  a: readonly SharedSessionPlayer[],
  b: readonly SharedSessionPlayer[],
): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((left, index) => {
    const right = b[index];

    return (
      left.id === right.id
      && left.name === right.name
      && left.sessionCode === right.sessionCode
      && left.isHost === right.isHost
      && left.createdAt === right.createdAt
      && left.updatedAt === right.updatedAt
    );
  });
}

type SessionGateProps = Readonly<{
  locale: Locale;
}>;

function importedSessionCodeFromUrl(): string | null {
  const url = new URL(window.location.href);
  const importedCode = url.searchParams.get("session");

  if (!importedCode) {
    return null;
  }

  const code = normalizeStoredSessionCode(importedCode);

  url.searchParams.delete("session");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);

  return code.length > 0 ? code : null;
}

function historyRouteFor(pathname: string): string {
  const locale = pathname.split("/").filter(Boolean)[0];

  return locale === "en" ? "/en/history" : "/fr/historique";
}

function sessionShareUrl(code: string): string {
  const url = new URL(window.location.href);

  url.searchParams.set("session", code);

  return url.toString();
}

export function SessionGate({ locale }: SessionGateProps) {
  const pathname = usePathname();
  const sessionCopy = useTranslations("Session");
  const setSharedSessionContext = useGameStore((state) => state.setSharedSessionContext);
  const notifySharedSessionBootstrapComplete = useGameStore((state) => state.notifySharedSessionBootstrapComplete);
  const hydrateSharedActiveGame = useGameStore((state) => state.hydrateSharedActiveGame);
  const storePlayerId = useGameStore((state) => state.sharedSessionPlayerId);
  const storeSessionCode = useGameStore((state) => state.sharedSessionCode);
  const storeSessionPlayers = useGameStore((state) => state.sharedSessionPlayers);
  const [session, setSession] = useState<SharedSessionSummary | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<PlayerId | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [sessionCodeInput, setSessionCodeInput] = useState("");
  const [playerNameInput, setPlayerNameInput] = useState("");
  const [isPlayersOpen, setIsPlayersOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const [sessionGateLayerTarget, setSessionGateLayerTarget] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    setSessionGateLayerTarget(document.body);
  }, []);

  const selectedPlayer = useMemo(
    () => session?.players.find((player) => player.id === selectedPlayerId) ?? null,
    [selectedPlayerId, session],
  );
  const needsPlayer = Boolean(session && !selectedPlayer);
  const normalizedSessionCodeInput = normalizeSharedSessionCode(sessionCodeInput);
  const historyRoute = historyRouteFor(pathname);

  useEffect(() => {
    const importedCode = importedSessionCodeFromUrl();
    const storedCode = importedCode ?? readStoredSessionCode();
    const nextDeviceId = readOrCreateDeviceId();

    setDeviceId(nextDeviceId);
    if (!storedCode) {
      setSharedSessionContext({ code: null, playerId: null, deviceId: nextDeviceId, players: [] });
      notifySharedSessionBootstrapComplete();
      return;
    }

    if (!isValidSharedSessionCode(storedCode)) {
      clearStoredSessionCode();
      setSessionCodeInput(storedCode);
      setError(sessionCopy("codeInvalid", { min: MIN_SHARED_SESSION_CODE_LENGTH }));
      setSharedSessionContext({ code: null, playerId: null, deviceId: nextDeviceId, players: [] });
      notifySharedSessionBootstrapComplete();
      return;
    }

    const codeToLoad = storedCode;

    setSessionCodeInput(codeToLoad);

    let isCancelled = false;

    async function loadSession() {
      setIsBusy(true);
      setError(null);

      try {
        const loadedSession = await ensureSharedSession(codeToLoad);
        const storedPlayerId = readStoredSessionPlayerId(loadedSession.code);
        const playerExists = loadedSession.players.some((player) => player.id === storedPlayerId);
        const nextPlayerId = playerExists ? storedPlayerId : null;

        if (!isCancelled) {
          setSession(loadedSession);
          setSelectedPlayerId(nextPlayerId);
          setSharedSessionContext({
            code: loadedSession.code,
            playerId: nextPlayerId,
            deviceId: nextDeviceId,
            players: loadedSession.players,
          });
        }
      } catch {
        if (!isCancelled) {
          setError(sessionCopy("loadFailed"));
        }
      } finally {
        if (!isCancelled) {
          setIsBusy(false);
          notifySharedSessionBootstrapComplete();
        }
      }
    }

    void loadSession();

    return () => {
      isCancelled = true;
    };
  }, [notifySharedSessionBootstrapComplete, sessionCopy, setSharedSessionContext]);

  useEffect(() => {
    setSession((current) => {
      if (!storeSessionCode || !current?.code || current.code !== storeSessionCode) {
        return current;
      }

      if (sharedSessionPlayersEqual(current.players, storeSessionPlayers)) {
        return current;
      }

      return {
        ...current,
        players: storeSessionPlayers,
      };
    });
  }, [storeSessionCode, storeSessionPlayers]);

  useEffect(() => {
    const sessionCode = session?.code ?? null;

    if (!sessionCode || !deviceId) {
      return;
    }

    let isCancelled = false;
    const codeToRefresh = sessionCode;

    async function refreshSessionPlayers() {
      try {
        const refreshedSession = await fetchSharedSession(codeToRefresh);
        const playerStillExists = refreshedSession.players.some((player) => player.id === selectedPlayerId);
        const nextPlayerId = playerStillExists ? selectedPlayerId : null;

        if (!isCancelled) {
          setSession(refreshedSession);
          setSelectedPlayerId(nextPlayerId);
          setSharedSessionContext({
            code: refreshedSession.code,
            playerId: nextPlayerId,
            deviceId,
            players: refreshedSession.players,
          });
        }
      } catch {
        if (!isCancelled) {
          setError(sessionCopy("loadFailed"));
        }
      }
    }

    const intervalId = window.setInterval(() => {
      if (!isCancelled && document.visibilityState === "visible") {
        void refreshSessionPlayers();
      }
    }, SESSION_PLAYERS_POLL_MS);

    function handleVisibilityChange() {
      if (!isCancelled && document.visibilityState === "visible") {
        void refreshSessionPlayers();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [deviceId, selectedPlayerId, session?.code, sessionCopy, setSharedSessionContext]);

  async function activateSession(code: string) {
    const normalizedCode = normalizeStoredSessionCode(code);

    if (!deviceId) {
      return;
    }

    if (normalizedCode.length === 0) {
      setError(sessionCopy("codeRequired"));
      return;
    }

    if (!isValidSharedSessionCode(normalizedCode)) {
      setSessionCodeInput(normalizedCode);
      setError(sessionCopy("codeInvalid", { min: MIN_SHARED_SESSION_CODE_LENGTH }));
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      const loadedSession = await ensureSharedSession(normalizedCode);
      const storedPlayerId = readStoredSessionPlayerId(loadedSession.code);
      const playerExists = loadedSession.players.some((player) => player.id === storedPlayerId);
      const nextPlayerId = playerExists ? storedPlayerId : null;

      if (session?.code !== loadedSession.code) {
        await hydrateSharedActiveGame(null);
      }

      setSession(loadedSession);
      setSelectedPlayerId(nextPlayerId);
      writeStoredSessionCode(loadedSession.code);
      setSharedSessionContext({
        code: loadedSession.code,
        playerId: nextPlayerId,
        deviceId,
        players: loadedSession.players,
      });
      setSessionCodeInput(loadedSession.code);
    } catch {
      setError(sessionCopy("loadFailed"));
    } finally {
      setIsBusy(false);
    }
  }

  async function createSession() {
    if (!deviceId) {
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      const createdSession = await createSharedSession();

      if (session?.code !== createdSession.code) {
        await hydrateSharedActiveGame(null);
      }

      writeStoredSessionCode(createdSession.code);
      setSession(createdSession);
      setSelectedPlayerId(null);
      setSessionCodeInput(createdSession.code);
      setSharedSessionContext({ code: createdSession.code, playerId: null, deviceId, players: createdSession.players });
    } catch {
      setError(sessionCopy("createFailed"));
    } finally {
      setIsBusy(false);
    }
  }

  function selectPlayer(playerId: PlayerId) {
    if (!session || !deviceId) {
      return;
    }

    writeStoredSessionPlayerId(session.code, playerId);
    setSelectedPlayerId(playerId);
    setSharedSessionContext({ code: session.code, playerId, deviceId, players: session.players });
  }

  async function addPlayer() {
    if (!session || !deviceId || playerNameInput.trim().length === 0) {
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      const response = await createSharedSessionPlayer(session.code, playerNameInput);

      writeStoredSessionPlayerId(response.session.code, response.player.id);
      setSession(response.session);
      setSelectedPlayerId(response.player.id);
      setPlayerNameInput("");
      setSharedSessionContext({
        code: response.session.code,
        playerId: response.player.id,
        deviceId,
        players: response.session.players,
      });
    } catch {
      setError(sessionCopy("playerCreateFailed"));
    } finally {
      setIsBusy(false);
    }
  }

  async function deletePlayer(player: SharedSessionPlayer) {
    if (!session || !deviceId) {
      return;
    }

    const confirmed = window.confirm(sessionCopy("deletePlayerConfirm", { player: player.name }));

    if (!confirmed) {
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      const refreshedSession = await deleteSharedSessionPlayer(session.code, player.id);
      const selectedPlayerStillExists = refreshedSession.players.some((candidate) => candidate.id === selectedPlayerId);
      const nextPlayerId = selectedPlayerStillExists ? selectedPlayerId : null;

      if (!selectedPlayerStillExists) {
        clearStoredSessionPlayerId(refreshedSession.code);
      }

      setSession(refreshedSession);
      setSelectedPlayerId(nextPlayerId);
      setSharedSessionContext({
        code: refreshedSession.code,
        playerId: nextPlayerId,
        deviceId,
        players: refreshedSession.players,
      });
    } catch {
      setError(sessionCopy("playerDeleteFailed"));
    } finally {
      setIsBusy(false);
    }
  }

  async function shareSession() {
    if (!session) {
      return;
    }

    const url = sessionShareUrl(session.code);

    setShareStatus("idle");

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: sessionCopy("shareTitle", { code: session.code }),
          text: sessionCopy("shareText", { code: session.code }),
          url,
        });
        setShareStatus("copied");
        return;
      }

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShareStatus("copied");
        return;
      }

      setShareStatus("failed");
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") {
        return;
      }

      setShareStatus("failed");
    }
  }

  async function leaveSession() {
    setIsBusy(true);
    setError(null);

    if (session) {
      clearStoredSessionPlayerId(session.code);
      clearDismissedSharedActiveGame(session.code);
    }

    clearStoredSessionCode();
    setSession(null);
    setSelectedPlayerId(null);
    setSessionCodeInput("");
    setSharedSessionContext({ code: null, playerId: null, deviceId, players: [] });

    try {
      await hydrateSharedActiveGame(null);
    } catch {
      setError(sessionCopy("loadFailed"));
    } finally {
      setIsBusy(false);
    }
  }

  if (session && selectedPlayer) {
    return (
      <Dialog
        open={isPlayersOpen}
        onOpenChange={(open) => {
          setIsPlayersOpen(open);

          if (!open) {
            setShareStatus("idle");
          }
        }}
      >
        <DialogTrigger asChild>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="min-h-11 min-w-11 rounded-xl border-secondary/30 px-3 shadow-primary/10"
            data-testid="session-settings-button"
            aria-label={sessionCopy("settingsButton")}
            title={sessionCopy("settingsButton")}
          >
            <Settings className="size-4" aria-hidden="true" />
            <span className="hidden max-w-28 truncate text-muted-foreground lg:inline">{selectedPlayer.name}</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="pr-14 text-left">
            <DialogTitle className="flex items-center gap-2 text-2xl tracking-tight">
              <Settings className="size-5 text-primary" aria-hidden="true" />
              {sessionCopy("playersTitle")}
            </DialogTitle>
            <DialogDescription>
              {sessionCopy("playersDescription", { code: session.code })}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
              <div className="grid gap-2 rounded-2xl border border-primary/20 bg-background/65 p-3 sm:grid-cols-[auto_1fr] sm:items-center">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{sessionCopy("languageTitle")}</p>
                <LanguageSwitcher locale={locale} className="justify-self-start" />
              </div>

              <div className="grid gap-3 rounded-2xl border border-secondary/25 bg-card/80 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-bold">{sessionCopy("shareTitle", { code: session.code })}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{sessionCopy("shareDescription")}</p>
                  {shareStatus !== "idle" ? (
                    <p
                      className={cn(
                        "text-xs font-medium",
                        shareStatus === "copied" ? "text-primary" : "text-destructive",
                      )}
                      role="status"
                    >
                      {shareStatus === "copied" ? sessionCopy("shareCopied") : sessionCopy("shareFailed")}
                    </p>
                  ) : null}
                </div>
                <Button type="button" size="sm" variant="secondary" className="justify-center rounded-xl" onClick={() => { void shareSession(); }}>
                  <Link2 className="size-4" aria-hidden="true" />
                  {sessionCopy("shareSession")}
                </Button>
              </div>

              <div className="grid gap-2 rounded-2xl border border-primary/20 bg-background/65 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{sessionCopy("sessionPlayers")}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {session.players.map((player) => {
                    const isSelected = player.id === selectedPlayerId;

                    return (
                      <div key={player.id} className="grid grid-cols-[1fr_auto] gap-2">
                        <Button
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          className="min-h-12 justify-start rounded-xl"
                          data-testid={`session-player-${player.id}`}
                          onClick={() => selectPlayer(player.id)}
                        >
                          <UserRound className="size-4" aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate text-left">{player.name}</span>
                          {isSelected ? <span className="text-xs opacity-80">{sessionCopy("youBadge")}</span> : null}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="min-h-12 min-w-12 rounded-xl text-muted-foreground hover:text-destructive"
                          aria-label={sessionCopy("deletePlayerA11y", { player: player.name })}
                          disabled={isBusy}
                          onClick={() => {
                            void deletePlayer(player);
                          }}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-2 rounded-2xl border border-border/70 bg-background/65 p-3 sm:grid-cols-[1fr_auto]">
                <Input
                  value={playerNameInput}
                  className="min-h-11"
                  placeholder={sessionCopy("playerNamePlaceholder")}
                  aria-label={sessionCopy("playerNameLabel")}
                  onChange={(event) => setPlayerNameInput(event.target.value)}
                />
                <Button type="button" size="sm" variant="secondary" disabled={isBusy || playerNameInput.trim().length === 0} onClick={() => { void addPlayer(); }}>
                  <Plus aria-hidden="true" />
                  {sessionCopy("addPlayer")}
                </Button>
              </div>

              <p className="rounded-2xl border border-border/70 bg-card/80 px-4 py-3 text-xs leading-5 text-muted-foreground">
                {sessionCopy("playerStatsHint")}
              </p>

              {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
          </div>

          <DialogFooter className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
            <Button asChild type="button" variant="outline" size="sm" className="justify-center rounded-xl">
              <Link href={historyRoute} onClick={() => setIsPlayersOpen(false)}>
                <BarChart3 className="size-4" aria-hidden="true" />
                {sessionCopy("stats")}
              </Link>
            </Button>
            <Button type="button" size="sm" variant="outline" className="rounded-xl" disabled={isBusy} onClick={() => { void leaveSession(); }}>
              {sessionCopy("change")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const sessionBlockingLayer = (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-background/95 p-4 backdrop-blur-xl">
      <Card className={cn("w-full max-w-3xl gap-0 border-primary/25 bg-card/95 py-0 shadow-2xl shadow-primary/15", session && "border-secondary/30")}>
        <CardContent className="grid gap-5 p-5 text-sm sm:p-6">
          <div className="min-w-0 space-y-2 text-center sm:text-left">
            <p className="flex items-center gap-2 font-semibold">
              <Link2 className="size-4 text-primary" aria-hidden="true" />
              {session ? sessionCopy("active", { code: session.code }) : sessionCopy("promptTitle")}
            </p>
            <p className="text-xs text-muted-foreground">
              {session
                ? selectedPlayer
                  ? sessionCopy("selectedPlayer", { player: selectedPlayer.name })
                  : sessionCopy("selectPlayerHint")
                : sessionCopy("promptDescription")}
            </p>
            {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
          </div>

          {!session ? (
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <Input
                value={sessionCodeInput}
                className="min-h-11 uppercase"
                placeholder={sessionCopy("codePlaceholder")}
                aria-label={sessionCopy("codeLabel")}
                maxLength={MAX_SHARED_SESSION_CODE_LENGTH}
                onChange={(event) => setSessionCodeInput(normalizeSharedSessionCode(event.target.value))}
              />
              <Button type="button" size="sm" disabled={isBusy || normalizedSessionCodeInput.length === 0} onClick={() => { void activateSession(sessionCodeInput); }}>
                {sessionCopy("join")}
              </Button>
              <Button type="button" size="sm" variant="secondary" disabled={isBusy} onClick={() => { void createSession(); }}>
                <Plus aria-hidden="true" />
                {sessionCopy("create")}
              </Button>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              {session.players.length > 0 ? (
                <Select value={storePlayerId ?? selectedPlayerId ?? ""} onValueChange={(value) => selectPlayer(value)}>
                  <SelectTrigger className="min-h-11 w-full">
                    <SelectValue placeholder={sessionCopy("playerPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent className="z-[95]">
                    {session.players.map((player) => (
                      <SelectItem key={player.id} value={player.id}>
                        <UserRound className="size-4" aria-hidden="true" />
                        {player.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={playerNameInput}
                  className="min-h-11"
                  placeholder={sessionCopy("playerNamePlaceholder")}
                  aria-label={sessionCopy("playerNameLabel")}
                  onChange={(event) => setPlayerNameInput(event.target.value)}
                />
              )}
              {needsPlayer && session.players.length > 0 ? (
                <Input
                  value={playerNameInput}
                  className="min-h-11"
                  placeholder={sessionCopy("playerNamePlaceholder")}
                  aria-label={sessionCopy("playerNameLabel")}
                  onChange={(event) => setPlayerNameInput(event.target.value)}
                />
              ) : null}
              <Button type="button" size="sm" variant="secondary" disabled={isBusy || playerNameInput.trim().length === 0} onClick={() => { void addPlayer(); }}>
                <Plus aria-hidden="true" />
                {sessionCopy("addPlayer")}
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={isBusy} onClick={() => { void leaveSession(); }}>
                {sessionCopy("change")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  if (sessionGateLayerTarget) {
    return createPortal(sessionBlockingLayer, sessionGateLayerTarget);
  }

  return sessionBlockingLayer;
}
