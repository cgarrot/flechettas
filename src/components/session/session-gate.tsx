"use client";

import { Link2, Plus, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSharedSession, createSharedSessionPlayer, ensureSharedSession, fetchSharedSession } from "@/lib/shared-session-api";
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

import type { PlayerId, SharedSessionSummary } from "@/types";

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

export function SessionGate() {
  const sessionCopy = useTranslations("Session");
  const setSharedSessionContext = useGameStore((state) => state.setSharedSessionContext);
  const hydrateSharedActiveGame = useGameStore((state) => state.hydrateSharedActiveGame);
  const storePlayerId = useGameStore((state) => state.sharedSessionPlayerId);
  const [session, setSession] = useState<SharedSessionSummary | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<PlayerId | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [sessionCodeInput, setSessionCodeInput] = useState("");
  const [playerNameInput, setPlayerNameInput] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedPlayer = useMemo(
    () => session?.players.find((player) => player.id === selectedPlayerId) ?? null,
    [selectedPlayerId, session],
  );
  const needsPlayer = Boolean(session && !selectedPlayer);

  useEffect(() => {
    const importedCode = importedSessionCodeFromUrl();
    const storedCode = importedCode ? writeStoredSessionCode(importedCode) : readStoredSessionCode();
    const nextDeviceId = readOrCreateDeviceId();

    setDeviceId(nextDeviceId);
    if (!storedCode) {
      setSharedSessionContext({ code: null, playerId: null, deviceId: nextDeviceId, players: [] });
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
        }
      }
    }

    void loadSession();

    return () => {
      isCancelled = true;
    };
  }, [sessionCopy, setSharedSessionContext]);

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
      void refreshSessionPlayers();
    }, 4000);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [deviceId, selectedPlayerId, session?.code, sessionCopy, setSharedSessionContext]);

  async function activateSession(code: string) {
    const normalizedCode = normalizeStoredSessionCode(code);

    if (normalizedCode.length === 0 || !deviceId) {
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      const loadedSession = await ensureSharedSession(writeStoredSessionCode(normalizedCode));
      const storedPlayerId = readStoredSessionPlayerId(loadedSession.code);
      const playerExists = loadedSession.players.some((player) => player.id === storedPlayerId);
      const nextPlayerId = playerExists ? storedPlayerId : null;

      setSession(loadedSession);
      setSelectedPlayerId(nextPlayerId);
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

  function leaveSession() {
    if (session) {
      clearStoredSessionPlayerId(session.code);
    }

    clearStoredSessionCode();
    setSession(null);
    setSelectedPlayerId(null);
    setSessionCodeInput("");
    setSharedSessionContext({ code: null, playerId: null, deviceId, players: [] });
    void hydrateSharedActiveGame(null);
  }

  if (session && selectedPlayer) {
    return (
      <div className="pointer-events-none fixed right-4 top-3 z-40 hidden max-w-xs md:block">
        <Card className="pointer-events-auto gap-0 border-secondary/30 bg-card/90 py-0 shadow-xl shadow-primary/10 backdrop-blur">
          <CardContent className="flex items-center gap-3 p-2 text-xs">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{sessionCopy("active", { code: session.code })}</p>
              <p className="truncate text-muted-foreground">{sessionCopy("selectedPlayer", { player: selectedPlayer.name })}</p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={leaveSession}>
              {sessionCopy("change")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/95 p-4 backdrop-blur-xl">
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
                className="min-h-10 uppercase"
                placeholder={sessionCopy("codePlaceholder")}
                aria-label={sessionCopy("codeLabel")}
                onChange={(event) => setSessionCodeInput(event.target.value)}
              />
              <Button type="button" size="sm" disabled={isBusy} onClick={() => { void activateSession(sessionCodeInput); }}>
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
                  <SelectTrigger className="min-h-10 w-full">
                    <SelectValue placeholder={sessionCopy("playerPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
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
                  className="min-h-10"
                  placeholder={sessionCopy("playerNamePlaceholder")}
                  aria-label={sessionCopy("playerNameLabel")}
                  onChange={(event) => setPlayerNameInput(event.target.value)}
                />
              )}
              {needsPlayer && session.players.length > 0 ? (
                <Input
                  value={playerNameInput}
                  className="min-h-10"
                  placeholder={sessionCopy("playerNamePlaceholder")}
                  aria-label={sessionCopy("playerNameLabel")}
                  onChange={(event) => setPlayerNameInput(event.target.value)}
                />
              ) : null}
              <Button type="button" size="sm" variant="secondary" disabled={isBusy || playerNameInput.trim().length === 0} onClick={() => { void addPlayer(); }}>
                <Plus aria-hidden="true" />
                {sessionCopy("addPlayer")}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={leaveSession}>
                {sessionCopy("change")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
