"use client";

import { ArrowLeft, Play, Shuffle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
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
import {
  createGamePresetConfig,
  firstPresetIdForMode,
  modeMessageKeys,
} from "./game-presets";
import { ModeSelector } from "./mode-selector";
import { PlayerConfig } from "./player-config";

import type { GamePreset, GamePresetId } from "./game-presets";
import type { BotLevel, GameConfig, GameMode, PlayerDef, PlayerId, SharedSessionPlayer } from "@/types";

const MAX_HUMAN_PLAYERS = 20;
const MAX_TOTAL_PLAYERS = 20;
const DEFAULT_BOT_LEVEL = 1 satisfies BotLevel;
const ORDER_DRAW_STEPS = 9;
const ORDER_DRAW_STEP_MS = 105;
const ORDER_DRAW_SETTLE_MS = 650;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function randomIndex(maxExclusive: number): number {
  if (maxExclusive <= 1) {
    return 0;
  }

  const values = new Uint32Array(1);
  window.crypto.getRandomValues(values);

  return values[0] % maxExclusive;
}

function shufflePlayers(players: readonly PlayerDef[]): PlayerDef[] {
  const shuffled = [...players];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
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
  const [selectedPresetId, setSelectedPresetId] = useState<GamePresetId>("x01-501-classic");
  const [configs, setConfigs] = useState<Record<GameMode, GameConfig>>(() => createDefaultGameConfigs());
  const [hasLoadedSetupPreferences, setHasLoadedSetupPreferences] = useState(false);
  const [step, setStep] = useState<StepId>("mode");
  const [selectedSessionPlayerIds, setSelectedSessionPlayerIds] = useState<PlayerId[]>([]);
  const [newHumanName, setNewHumanName] = useState("");
  const [botPlayers, setBotPlayers] = useState<PlayerDef[]>([]);
  const [playerValidationMessage, setPlayerValidationMessage] = useState<string | null>(null);
  const [startValidationMessage, setStartValidationMessage] = useState<string | null>(null);
  const [orderDrawPlayers, setOrderDrawPlayers] = useState<PlayerDef[] | null>(null);
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
      setSelectedPresetId(firstPresetIdForMode(storedPreferences.selectedMode));
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

  function selectPresetAndConfigure(preset: GamePreset) {
    setSelectedMode(preset.mode);
    setSelectedPresetId(preset.id);
    setConfigs((currentConfigs) => ({
      ...currentConfigs,
      [preset.mode]: createGamePresetConfig(preset.id, currentConfigs[preset.mode]),
    }));
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

    setStartValidationMessage(null);
    setIsStarting(true);

    try {
      let finalPlayers = validation.players;

      if (validation.players.length > 1) {
        setOrderDrawPlayers(validation.players);

        for (let stepIndex = 0; stepIndex < ORDER_DRAW_STEPS; stepIndex += 1) {
          await sleep(ORDER_DRAW_STEP_MS);
          setOrderDrawPlayers(shufflePlayers(validation.players));
        }

        finalPlayers = shufflePlayers(validation.players);
        setOrderDrawPlayers(finalPlayers);
        await sleep(ORDER_DRAW_SETTLE_MS);
      }

      const configWithPlayers = buildConfigWithPlayers(selectedConfig, finalPlayers);

      await newGame(configWithPlayers, finalPlayers);
      router.push(gameRoute);
    } catch {
      setStartValidationMessage(setup("errors.startFailed"));
      setStep("setup");
    } finally {
      setOrderDrawPlayers(null);
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
              <ModeSelector selectedPresetId={selectedPresetId} onSelectPreset={selectPresetAndConfigure} />
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

            {orderDrawPlayers ? (
              <div className="fixed inset-0 z-[120] grid place-items-center bg-background/85 p-4 backdrop-blur-md" role="status" aria-live="polite">
                <Card className="w-full max-w-md border-primary/30 bg-card/95 py-0 shadow-2xl shadow-primary/20">
                  <CardContent className="space-y-4 p-4 sm:p-5">
                    <div className="space-y-2 text-center">
                      <Badge variant="outline" className="mx-auto bg-background/70 uppercase tracking-[0.18em] text-primary">
                        <Shuffle className="size-3" aria-hidden="true" />
                        {setup("orderDrawKicker")}
                      </Badge>
                      <div className="space-y-1">
                        <h3 className="text-2xl font-black tracking-tight">{setup("orderDrawTitle")}</h3>
                        <p className="text-sm text-muted-foreground">{setup("orderDrawDescription")}</p>
                      </div>
                    </div>

                    <ol className="grid gap-2">
                      {orderDrawPlayers.map((player, index) => (
                        <li
                          key={`${player.id}-${index}`}
                          className="grid grid-cols-[2.5rem_1fr] items-center gap-3 rounded-2xl border border-border/70 bg-background/70 p-2"
                        >
                          <span className="grid size-10 place-items-center rounded-full bg-primary text-sm font-black text-primary-foreground">
                            {index + 1}
                          </span>
                          <span className="min-w-0 truncate text-lg font-black">{player.name}</span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
