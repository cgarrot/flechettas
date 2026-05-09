"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createSharedSessionPlayer } from "@/lib/shared-session-api";
import { useGameStore } from "@/store";
import { cn } from "@/lib/utils";

import {
  buildConfigWithPlayers,
  createDefaultGameConfigs,
  GameConfigForm,
} from "./game-config";
import { ModeSelector, modeMessageKeys } from "./mode-selector";
import { botLevelMessageKeys, PlayerConfig } from "./player-config";

import type { BotLevel, GameConfig, GameMode, PlayerDef, PlayerId, SharedSessionPlayer } from "@/types";

const MAX_HUMAN_PLAYERS = 20;
const MAX_TOTAL_PLAYERS = 20;
const DEFAULT_BOT_LEVEL = 1 satisfies BotLevel;
const STEP_IDS = ["mode", "players", "config", "review"] as const;

type StepId = (typeof STEP_IDS)[number];
type Locale = "fr" | "en";

type SetupFlowProps = Readonly<{
  locale: Locale;
}>;

type ValidationResult =
  | { valid: true; players: PlayerDef[] }
  | { valid: false; message: string };

type ReviewStartProps = Readonly<{
  config: GameConfig;
  players: readonly PlayerDef[];
  isStarting: boolean;
  validationMessage?: string | null;
  onStart: () => void;
}>;

function gameRouteFor(locale: Locale): string {
  return locale === "fr" ? "/fr/partie" : "/en/game";
}

function stepIndexFor(step: StepId): number {
  return STEP_IDS.indexOf(step);
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

function modeSummaryItems(
  config: GameConfig,
  label: (key: string) => string,
  yesNo: (value: boolean | undefined) => string,
): Array<{ label: string; value: string }> {
  const legsToWin = config.matchFormat?.legsToWin ?? 1;
  const setsToWin = config.matchFormat?.setsToWin ?? 1;
  const base = [
    { label: label("legsToWin"), value: String(legsToWin) },
    { label: label("setsToWin"), value: String(setsToWin) },
  ];

  switch (config.mode) {
    case "x01":
      return [
        ...base,
        { label: label("startScore"), value: String(config.startingScore) },
        { label: label("doubleIn"), value: yesNo(config.doubleIn) },
        { label: label("doubleOut"), value: yesNo(config.doubleOut) },
      ];
    case "cricket":
      return [
        ...base,
        { label: label("variant"), value: label(config.variant === "standard" ? "standard" : config.variant === "cut-throat" ? "cutThroat" : "noScore") },
        { label: label("scorePoints"), value: yesNo(config.scorePoints) },
      ];
    case "around-the-clock":
      return [
        ...base,
        { label: label("startSegment"), value: String(config.startSegment) },
        { label: label("endSegment"), value: String(config.endSegment) },
        { label: label("requiredMultiplier"), value: config.requiredMultiplier === "open" || !config.requiredMultiplier ? label("open") : String(config.requiredMultiplier) },
      ];
    case "bobs-27":
      return [
        ...base,
        { label: label("startScore"), value: String(config.startingScore) },
        { label: label("allowNegativeScore"), value: yesNo(config.allowNegativeScore) },
      ];
    case "checkout-121":
      return [
        ...base,
        { label: label("dartsPerTarget"), value: String(config.dartsPerTarget) },
        { label: label("successStep"), value: String(config.successStep) },
        { label: label("failureStep"), value: String(config.failureStep) },
      ];
    case "shanghai":
      return [
        ...base,
        { label: label("instantShanghaiWin"), value: yesNo(config.instantShanghaiWin) },
      ];
    case "training":
      return [
        ...base,
        { label: label("trainingFocus"), value: label(`focus${config.focus.charAt(0).toUpperCase()}${config.focus.slice(1)}`) },
        { label: label("rounds"), value: String(config.rounds ?? 1) },
      ];
    case "killer":
      return [
        ...base,
        { label: label("startingLives"), value: String(config.startingLives) },
        { label: label("assignment"), value: label(config.assignment === "first-hit" ? "assignmentFirstHit" : `assignment${config.assignment.charAt(0).toUpperCase()}${config.assignment.slice(1)}`) },
        { label: label("requiredHitsToBecomeKiller"), value: String(config.requiredHitsToBecomeKiller) },
      ];
  }
}

export function ReviewStart({
  config,
  players,
  isStarting,
  validationMessage,
  onStart,
}: ReviewStartProps) {
  const setup = useTranslations("Setup");
  const modes = useTranslations("Modes");
  const gameConfig = useTranslations("GameConfig");
  const levels = useTranslations("DartBotLevels");
  const misc = useTranslations("Misc");
  const modeLabel = modes(modeMessageKeys[config.mode]);
  const summaryItems = modeSummaryItems(
    config,
    (key) => gameConfig(key),
    (value) => misc(value ? "yes" : "no"),
  );

  return (
    <section className="space-y-5" aria-labelledby="review-start-title">
      <div className="space-y-2">
        <Badge variant="outline" className="bg-background/70 uppercase tracking-[0.18em] text-primary">
          <ClipboardList className="size-3" aria-hidden="true" />
          {setup("reviewStepKicker")}
        </Badge>
        <div className="space-y-2">
          <h2 id="review-start-title" className="text-2xl font-black tracking-tight sm:text-3xl">
            {setup("reviewStepTitle")}
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            {setup("reviewStepDescription")}
          </p>
        </div>
      </div>

      {validationMessage ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive" role="alert">
          {validationMessage}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card className="border-primary/20 bg-card/95">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-primary" aria-hidden="true" />
              {setup("reviewPlayers")}
            </CardTitle>
            <CardDescription>{setup("reviewPlayersDescription", { count: players.length })}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {players.map((player) => (
              <div key={player.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/65 px-4 py-3">
                <div>
                  <p className="font-medium">{player.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {player.isBot
                      ? setup("botWithLevel", { level: levels(botLevelMessageKeys[player.botLevel ?? DEFAULT_BOT_LEVEL]) })
                      : setup("human")}
                  </p>
                </div>
                <Badge variant={player.isBot ? "secondary" : "outline"}>{player.isBot ? setup("bot") : setup("human")}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-card/95">
          <CardHeader>
            <CardTitle>{setup("reviewConfig")}</CardTitle>
            <CardDescription>{modeLabel}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summaryItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/65 px-4 py-3 text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Button
        type="button"
        size="lg"
        className="min-h-14 w-full text-base"
        data-testid="start-game"
        disabled={isStarting}
        onClick={onStart}
      >
        <Play aria-hidden="true" />
        {isStarting ? setup("startingGame") : setup("startGame")}
      </Button>
    </section>
  );
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
  const [step, setStep] = useState<StepId>("mode");
  const [selectedSessionPlayerIds, setSelectedSessionPlayerIds] = useState<PlayerId[]>([]);
  const [newHumanName, setNewHumanName] = useState("");
  const [botPlayers, setBotPlayers] = useState<PlayerDef[]>([]);
  const [playerValidationMessage, setPlayerValidationMessage] = useState<string | null>(null);
  const [startValidationMessage, setStartValidationMessage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const selectedConfig = configs[selectedMode];
  const currentStepIndex = stepIndexFor(step);
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

  function moveToNextStep() {
    if (step === "players") {
      const validation = validatePlayers();

      if (!validation.valid) {
        setPlayerValidationMessage(validation.message);
        return;
      }

      setBotPlayers(validation.players.filter((player) => player.isBot));
      setPlayerValidationMessage(null);
    }

    setStep(STEP_IDS[Math.min(currentStepIndex + 1, STEP_IDS.length - 1)]);
  }

  function moveToPreviousStep() {
    setStep(STEP_IDS[Math.max(currentStepIndex - 1, 0)]);
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
      setStep("players");
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
      setStep("review");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-transparent px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <section className="relative mx-auto flex max-w-6xl flex-col gap-6">
        <div className="pointer-events-none absolute -top-24 right-4 -z-10 size-72 rounded-full bg-chart-2/25 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute top-48 -left-20 -z-10 size-80 rounded-full bg-chart-1/20 blur-3xl" aria-hidden="true" />

        <header className="grid gap-5 rounded-[2rem] border border-primary/20 bg-card/85 p-5 shadow-2xl shadow-primary/10 backdrop-blur sm:p-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
          <div className="space-y-3">
            <Badge variant="outline" className="bg-background/70 uppercase tracking-[0.22em] text-primary">
              {setup("pageKicker")}
            </Badge>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
                {setup("pageTitle")}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                {setup("pageSubtitle", { mode: modeLabel })}
              </p>
            </div>
          </div>
          <Card className="border-primary/20 bg-background/70 py-5">
            <CardHeader>
              <CardTitle className="text-base">{setup("progressLabel")}</CardTitle>
              <CardDescription>{setup("stepCounter", { current: currentStepIndex + 1, total: STEP_IDS.length })}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-4 gap-2" aria-hidden="true">
                {STEP_IDS.map((stepId, index) => (
                  <span
                    key={stepId}
                    className={cn(
                      "h-2 rounded-full bg-muted transition-colors",
                      index <= currentStepIndex && "bg-primary",
                    )}
                  />
                ))}
              </div>
              <p className="text-sm font-medium">{setup(`steps.${step}`)}</p>
            </CardContent>
          </Card>
        </header>

        <Card className="border-primary/20 bg-card/90 p-0 shadow-2xl shadow-primary/10 backdrop-blur">
          <CardContent className="p-5 sm:p-8">
            {step === "mode" ? (
              <ModeSelector selectedMode={selectedMode} onSelectMode={setSelectedMode} />
            ) : null}
            {step === "players" ? (
              <div className="space-y-5">
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
              </div>
            ) : null}
            {step === "config" ? (
              <GameConfigForm config={selectedConfig} onConfigChange={updateConfig} />
            ) : null}
            {step === "review" ? (
              <ReviewStart
                config={buildConfigWithPlayers(selectedConfig, players)}
                players={players}
                isStarting={isStarting}
                validationMessage={startValidationMessage}
                onStart={() => {
                  void startGame();
                }}
              />
            ) : null}
          </CardContent>

          <Separator />

          <div className="flex flex-col-reverse gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-12"
              disabled={currentStepIndex === 0 || isStarting}
              onClick={moveToPreviousStep}
            >
              <ArrowLeft aria-hidden="true" />
              {setup("back")}
            </Button>

            {step !== "review" ? (
              <Button type="button" size="lg" className="min-h-12" disabled={isStarting} onClick={moveToNextStep}>
                {setup("next")}
                <ArrowRight aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </Card>
      </section>
    </main>
  );
}
