"use client";

import { ArrowLeft, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { createSharedSessionPlayer } from "@/lib/shared-session-api";
import { readSetupPreferences, writeSetupPreferences } from "@/lib/setup-preferences-storage";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/store";

import {
  buildConfigWithPlayers,
  createDefaultGameConfigs,
  GameConfigForm,
} from "./game-config";
import { ModeSelector, modeMessageKeys } from "./mode-selector";
import { PlayerConfig } from "./player-config";

import type { BotLevel, GameConfig, GameMode, PlayerDef, PlayerId, SharedSessionPlayer } from "@/types";

const MAX_HUMAN_PLAYERS = 20;
const MAX_TOTAL_PLAYERS = 20;
const DEFAULT_BOT_LEVEL = 1 satisfies BotLevel;
type StepId = "mode" | "setup";
type Locale = "fr" | "en";

type SetupFlowProps = Readonly<{
  locale: Locale;
}>;

type ValidationResult =
  | { valid: true; players: PlayerDef[] }
  | { valid: false; message: string };

function gameRouteFor(locale: Locale): string {
  return locale === "fr" ? "/fr/partie" : "/en/game";
}

function normalizeName(name: string): string {
  return name.trim();
}

function playerDefFromSessionPlayer(player: SharedSessionPlayer): PlayerDef {
  return {
    id: player.id,
    name: player.name,
    isBot: false,
  };
}

function isSharedSessionPlayer(player: SharedSessionPlayer | undefined): player is SharedSessionPlayer {
  return player !== undefined;
}

export function SetupFlow({ locale }: SetupFlowProps) {
  const router = useRouter();
  const setup = useTranslations("Setup");
  const sessionCopy = useTranslations("Session");
  const modes = useTranslations("Modes");
  const newGame = useGameStore((state) => state.newGame);
  const sharedSessionCode = useGameStore((state) => state.sharedSessionCode);
  const sharedSessionDeviceId = useGameStore((state) => state.sharedSessionDeviceId);
  const sharedSessionPlayerId = useGameStore((state) => state.sharedSessionPlayerId);
  const sharedSessionPlayers = useGameStore((state) => state.sharedSessionPlayers);
  const setSharedSessionContext = useGameStore((state) => state.setSharedSessionContext);
  const nextBotId = useRef(1);
  const [selectedMode, setSelectedMode] = useState<GameMode>("x01");
  const [configs, setConfigs] = useState<Record<GameMode, GameConfig>>(() => createDefaultGameConfigs());
  const [hasLoadedSetupPreferences, setHasLoadedSetupPreferences] = useState(false);
  const [step, setStep] = useState<StepId>("mode");
  const [selectedSessionPlayerIds, setSelectedSessionPlayerIds] = useState<PlayerId[]>([]);
  const [newHumanName, setNewHumanName] = useState("");
  const [botPlayers, setBotPlayers] = useState<PlayerDef[]>([]);
  const [playerValidationMessage, setPlayerValidationMessage] = useState<string | null>(null);
  const [startValidationMessage, setStartValidationMessage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const selectedConfig = configs[selectedMode];
  const modeLabel = modes(modeMessageKeys[selectedMode]);
  const gameRoute = useMemo(() => gameRouteFor(locale), [locale]);
  const selectedSessionPlayers = useMemo(
    () => selectedSessionPlayerIds
      .map((playerId) => sharedSessionPlayers.find((player) => player.id === playerId))
      .filter(isSharedSessionPlayer),
    [selectedSessionPlayerIds, sharedSessionPlayers],
  );
  const players = useMemo(
    () => [
      ...selectedSessionPlayers.map(playerDefFromSessionPlayer),
      ...botPlayers,
    ],
    [botPlayers, selectedSessionPlayers],
  );

  useEffect(() => {
    const storedPreferences = readSetupPreferences(createDefaultGameConfigs());

    if (storedPreferences) {
      setSelectedMode(storedPreferences.selectedMode);
      setConfigs(storedPreferences.configs);
    }

    setHasLoadedSetupPreferences(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedSetupPreferences) {
      return;
    }

    writeSetupPreferences({ selectedMode, configs });
  }, [configs, hasLoadedSetupPreferences, selectedMode]);

  useEffect(() => {
    setSelectedSessionPlayerIds((currentPlayerIds) => currentPlayerIds.filter((playerId) => (
      sharedSessionPlayers.some((player) => player.id === playerId)
    )));
  }, [sharedSessionPlayers]);

  useEffect(() => {
    if (!sharedSessionPlayerId || !sharedSessionPlayers.some((player) => player.id === sharedSessionPlayerId)) {
      return;
    }

    setSelectedSessionPlayerIds((currentPlayerIds) => (
      currentPlayerIds.length > 0 ? currentPlayerIds : [sharedSessionPlayerId]
    ));
  }, [sharedSessionPlayerId, sharedSessionPlayers]);

  function validatePlayers(): ValidationResult {
    if (players.length === 0) {
      return { valid: false, message: setup("errors.atLeastOne") };
    }

    const normalizedPlayers = players.map((player) => ({
      ...player,
      name: normalizeName(player.name),
    }));
    const humanCount = normalizedPlayers.filter((player) => !player.isBot).length;

    if (normalizedPlayers.length > MAX_TOTAL_PLAYERS) {
      return { valid: false, message: setup("errors.totalLimit", { count: MAX_TOTAL_PLAYERS }) };
    }

    if (humanCount > MAX_HUMAN_PLAYERS) {
      return { valid: false, message: setup("errors.humanLimit", { count: MAX_HUMAN_PLAYERS }) };
    }

    if (normalizedPlayers.some((player) => player.name.length === 0)) {
      return { valid: false, message: setup("errors.namesRequired") };
    }

    const seenNames = new Set<string>();

    for (const player of normalizedPlayers) {
      const comparableName = player.name.toLocaleLowerCase(locale);

      if (seenNames.has(comparableName)) {
        return { valid: false, message: setup("errors.uniqueNames") };
      }

      seenNames.add(comparableName);
    }

    return { valid: true, players: normalizedPlayers };
  }

  function selectModeAndConfigure(mode: GameMode) {
    setSelectedMode(mode);
    setStep("setup");
  }

  function returnToModeSelection() {
    setStep("mode");
  }

  function updateConfig(config: GameConfig) {
    setConfigs((currentConfigs) => ({
      ...currentConfigs,
      [config.mode]: config,
    }));
  }

  async function addHumanPlayer() {
    const humanCount = players.filter((player) => !player.isBot).length;
    const requestedName = normalizeName(newHumanName);

    if (players.length >= MAX_TOTAL_PLAYERS) {
      setPlayerValidationMessage(setup("errors.totalLimit", { count: MAX_TOTAL_PLAYERS }));
      return;
    }

    if (humanCount >= MAX_HUMAN_PLAYERS) {
      setPlayerValidationMessage(setup("errors.humanLimit", { count: MAX_HUMAN_PLAYERS }));
      return;
    }

    if (requestedName.length === 0) {
      setPlayerValidationMessage(setup("errors.namesRequired"));
      return;
    }

    if (!sharedSessionCode || !sharedSessionDeviceId) {
      setPlayerValidationMessage(sessionCopy("loadFailed"));
      return;
    }

    try {
      const response = await createSharedSessionPlayer(
        sharedSessionCode,
        requestedName,
      );

      setPlayerValidationMessage(null);
      setNewHumanName("");
      setSelectedSessionPlayerIds((currentPlayerIds) => (
        currentPlayerIds.includes(response.player.id) ? currentPlayerIds : [...currentPlayerIds, response.player.id]
      ));
      setSharedSessionContext({
        code: response.session.code,
        playerId: sharedSessionPlayerId,
        deviceId: sharedSessionDeviceId,
        players: response.session.players,
      });
    } catch {
      setPlayerValidationMessage(sessionCopy("playerCreateFailed"));
    }
  }

  function toggleSessionPlayer(playerId: string) {
    setPlayerValidationMessage(null);

    if (selectedSessionPlayerIds.includes(playerId)) {
      setSelectedSessionPlayerIds((currentPlayerIds) => currentPlayerIds.filter((currentPlayerId) => currentPlayerId !== playerId));
      return;
    }

    if (players.length >= MAX_TOTAL_PLAYERS) {
      setPlayerValidationMessage(setup("errors.totalLimit", { count: MAX_TOTAL_PLAYERS }));
      return;
    }

    if (players.filter((player) => !player.isBot).length >= MAX_HUMAN_PLAYERS) {
      setPlayerValidationMessage(setup("errors.humanLimit", { count: MAX_HUMAN_PLAYERS }));
      return;
    }

    setSelectedSessionPlayerIds((currentPlayerIds) => [...currentPlayerIds, playerId]);
  }

  function addBotPlayer() {
    if (players.length >= MAX_TOTAL_PLAYERS) {
      setPlayerValidationMessage(setup("errors.totalLimit", { count: MAX_TOTAL_PLAYERS }));
      return;
    }

    const nextId = nextBotId.current;
    nextBotId.current += 1;
    setPlayerValidationMessage(null);
    setBotPlayers((currentPlayers) => [
      ...currentPlayers,
      {
        id: `bot-${nextId}`,
        name: setup("defaultBotName", { number: nextId }),
        isBot: true,
        botLevel: DEFAULT_BOT_LEVEL,
      },
    ]);
  }

  function removePlayer(playerId: string) {
    setBotPlayers((currentPlayers) => currentPlayers.filter((player) => player.id !== playerId));
  }

  async function startGame() {
    const validation = validatePlayers();

    if (!validation.valid) {
      setStartValidationMessage(validation.message);
      setPlayerValidationMessage(validation.message);
      setStep("setup");
      return;
    }

    const configWithPlayers = buildConfigWithPlayers(selectedConfig, validation.players);

    setStartValidationMessage(null);
    setIsStarting(true);

    try {
      await newGame(configWithPlayers, validation.players);
      router.push(gameRoute);
    } catch {
      setStartValidationMessage(setup("errors.startFailed"));
      setStep("setup");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <main
      className={cn(
        "grid min-h-[calc(100dvh-11.25rem)] overflow-x-hidden bg-transparent px-2 py-2 text-foreground sm:px-6 sm:py-5 md:min-h-[calc(100dvh-5rem)] lg:px-8",
        step === "mode" ? "md:items-center" : "md:items-start",
      )}
    >
      <section className="relative mx-auto flex w-full max-w-6xl flex-col gap-3 sm:gap-4">
        <div className="pointer-events-none absolute -top-24 right-4 -z-10 size-72 rounded-full bg-chart-2/25 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute top-48 -left-20 -z-10 size-80 rounded-full bg-chart-1/20 blur-3xl" aria-hidden="true" />

        {step === "mode" ? (
          <Card className="border-primary/20 bg-card/90 p-0 shadow-2xl shadow-primary/10 backdrop-blur">
            <CardContent className="p-3 sm:p-5">
              <ModeSelector selectedMode={selectedMode} onSelectMode={selectModeAndConfigure} />
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-primary/20 bg-card/85 p-2 shadow-xl shadow-primary/10 backdrop-blur sm:p-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 rounded-xl"
                disabled={isStarting}
                onClick={returnToModeSelection}
              >
                <ArrowLeft aria-hidden="true" />
                {setup("back")}
              </Button>
              <div className="min-w-0 text-right">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-primary">{setup("pageKicker")}</p>
                <p className="truncate text-sm font-black sm:text-base">{modeLabel}</p>
              </div>
            </div>

            <Card className="border-primary/20 bg-card/90 p-0 shadow-2xl shadow-primary/10 backdrop-blur">
              <CardContent className="grid gap-4 p-3 sm:p-5 xl:grid-cols-[0.95fr_1.05fr] xl:items-start">
                <PlayerConfig
                  players={players}
                  maxHumanPlayers={MAX_HUMAN_PLAYERS}
                  maxTotalPlayers={MAX_TOTAL_PLAYERS}
                  validationMessage={playerValidationMessage}
                  onAddHuman={addHumanPlayer}
                  onAddBot={addBotPlayer}
                  onRemovePlayer={removePlayer}
                  onRenamePlayer={(playerId, name) => {
                    setPlayerValidationMessage(null);
                    setBotPlayers((currentPlayers) => currentPlayers.map((player) => (
                      player.id === playerId ? { ...player, name } : player
                    )));
                  }}
                  onBotLevelChange={(playerId, botLevel) => {
                    setBotPlayers((currentPlayers) => currentPlayers.map((player) => (
                      player.id === playerId ? { ...player, botLevel } : player
                    )));
                  }}
                  sessionBackedHumans
                  availableSessionPlayers={sharedSessionPlayers}
                  selectedSessionPlayerIds={selectedSessionPlayerIds}
                  newHumanName={newHumanName}
                  onNewHumanNameChange={(name) => {
                    setPlayerValidationMessage(null);
                    setNewHumanName(name);
                  }}
                  onToggleSessionPlayer={toggleSessionPlayer}
                />

                <div className="space-y-4">
                  <GameConfigForm config={selectedConfig} onConfigChange={updateConfig} />
                  {startValidationMessage ? (
                    <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive" role="alert">
                      {startValidationMessage}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    size="lg"
                    className="min-h-12 w-full text-base"
                    data-testid="start-game"
                    disabled={isStarting}
                    onClick={() => {
                      void startGame();
                    }}
                  >
                    <Play aria-hidden="true" />
                    {isStarting ? setup("startingGame") : setup("startGame")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </section>
    </main>
  );
}
