"use client";

import { Bot, CheckCircle2, Plus, UserRound, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { BotLevel, PlayerDef, SharedSessionPlayer } from "@/types";

export const BOT_LEVELS = [1, 2, 3, 4, 5, 6] as const satisfies readonly BotLevel[];

export const botLevelMessageKeys = {
  1: "beginner20",
  2: "amateur40",
  3: "intermediate60",
  4: "advanced80",
  5: "expert100",
  6: "legendary120",
} as const satisfies Record<BotLevel, string>;

type PlayerConfigProps = Readonly<{
  players: readonly PlayerDef[];
  maxHumanPlayers: number;
  maxTotalPlayers: number;
  validationMessage?: string | null;
  onAddHuman: () => void | Promise<void>;
  onAddBot: () => void;
  onRemovePlayer: (playerId: string) => void;
  onRenamePlayer: (playerId: string, name: string) => void;
  onBotLevelChange: (playerId: string, level: BotLevel) => void;
  sessionBackedHumans?: boolean;
  availableSessionPlayers?: readonly SharedSessionPlayer[];
  selectedSessionPlayerIds?: readonly string[];
  newHumanName?: string;
  onNewHumanNameChange?: (name: string) => void;
  onToggleSessionPlayer?: (playerId: string) => void;
}>;

function botLevelFromValue(value: string): BotLevel {
  const parsed = Number.parseInt(value, 10);

  return BOT_LEVELS.includes(parsed as BotLevel) ? (parsed as BotLevel) : 1;
}

export function PlayerConfig({
  players,
  maxHumanPlayers,
  maxTotalPlayers,
  validationMessage,
  onAddHuman,
  onAddBot,
  onRemovePlayer,
  onRenamePlayer,
  onBotLevelChange,
  sessionBackedHumans = false,
  availableSessionPlayers = [],
  selectedSessionPlayerIds = [],
  newHumanName = "",
  onNewHumanNameChange,
  onToggleSessionPlayer,
}: PlayerConfigProps) {
  const setup = useTranslations("Setup");
  const levels = useTranslations("DartBotLevels");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const humanCount = players.filter((player) => !player.isBot).length;
  const botCount = players.length - humanCount;
  const canAddPlayer = players.length < maxTotalPlayers;
  const canAddHuman = canAddPlayer && humanCount < maxHumanPlayers;
  const canCreateHuman = canAddHuman && (!sessionBackedHumans || newHumanName.trim().length > 0);

  return (
    <section className="space-y-3" aria-labelledby="player-config-title">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <Badge variant="outline" className="bg-background/70 uppercase tracking-[0.16em] text-primary">
            <UserRound className="size-3" aria-hidden="true" />
            {setup("playerStepKicker")}
          </Badge>
          <h2 id="player-config-title" className="text-lg font-black tracking-tight sm:text-xl">
            {setup("playerStepTitle")}
          </h2>
          <p className="max-w-xl text-xs leading-5 text-muted-foreground">
            {setup("playerStepDescription", { count: maxTotalPlayers })}
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button type="button" size="sm" className="min-h-11 shrink-0 rounded-xl" data-testid="add-participant">
              <Plus className="size-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{setup("addParticipant")}</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
            <DialogHeader className="text-left">
              <DialogTitle>{setup("playerDialogTitle")}</DialogTitle>
              <DialogDescription>{setup("playerDialogDescription", { count: maxTotalPlayers })}</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              {sessionBackedHumans ? (
                <div className="grid gap-2 rounded-2xl border border-primary/20 bg-background/65 p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{setup("sessionPlayersTitle")}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {availableSessionPlayers.length > 0 ? availableSessionPlayers.map((player) => {
                      const isSelected = selectedSessionPlayerIds.includes(player.id);
                      const canToggleOn = isSelected || canAddHuman;

                      return (
                        <Button
                          key={player.id}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          className="min-h-11 justify-start rounded-xl"
                          disabled={!canToggleOn}
                          aria-pressed={isSelected}
                          onClick={() => onToggleSessionPlayer?.(player.id)}
                        >
                          {isSelected ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <UserRound className="size-4" aria-hidden="true" />}
                          <span className="min-w-0 flex-1 truncate text-left">{player.name}</span>
                          <span className="text-xs opacity-75">{isSelected ? setup("selectedForMatch") : setup("tapToInclude")}</span>
                        </Button>
                      );
                    }) : (
                      <p className="rounded-xl border border-dashed border-primary/20 bg-card/70 px-4 py-5 text-center text-sm text-muted-foreground sm:col-span-2">
                        {setup("noSessionPlayers")}
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-2 rounded-2xl border border-border/70 bg-background/65 p-3 sm:grid-cols-[1fr_auto_auto]">
                {sessionBackedHumans ? (
                  <Input
                    value={newHumanName}
                    className="min-h-11 bg-background/65"
                    placeholder={setup("newSessionPlayerPlaceholder")}
                    aria-label={setup("newSessionPlayerName")}
                    onChange={(event) => onNewHumanNameChange?.(event.target.value)}
                  />
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  className="min-h-11"
                  data-testid="add-player"
                  disabled={!canCreateHuman}
                  onClick={() => {
                    void onAddHuman();
                  }}
                >
                  <Plus aria-hidden="true" />
                  {setup("addPlayer")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="min-h-11"
                  data-testid="add-bot"
                  disabled={!canAddPlayer}
                  onClick={() => {
                    onAddBot();
                    setIsAddOpen(false);
                  }}
                >
                  <Bot aria-hidden="true" />
                  {setup("addBot")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {validationMessage ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive" role="alert">
          {validationMessage}
        </p>
      ) : null}

      <Card className="border-primary/15 bg-background/65 py-0">
        <CardContent className="space-y-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{setup("selectedParticipants")}</p>
            <div className="flex gap-1.5">
              <Badge variant="secondary">{setup("playerCount", { count: humanCount })}</Badge>
              <Badge variant="outline">{setup("botCount", { count: botCount })}</Badge>
            </div>
          </div>

          {players.length === 0 ? (
            <div className="rounded-xl border border-dashed border-primary/20 bg-card/70 px-4 py-5 text-center text-sm text-muted-foreground">
              {setup("emptyPlayers")}
            </div>
          ) : null}

          <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1">
            {players.map((player, index) => {
              const playerNumber = index + 1;
              const playerInputId = `player-name-${player.id}`;
              const botLevelId = `bot-level-${player.id}`;
              const fallbackName = setup("playerNameFor", { number: playerNumber });

              return (
                <div key={player.id} className="flex min-w-0 items-center gap-1.5 rounded-xl border border-border/70 bg-card/80 p-1.5 shadow-sm shadow-primary/5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 font-mono text-xs font-black text-primary">
                    {playerNumber}
                  </span>
                  <Badge
                    variant={player.isBot ? "secondary" : "outline"}
                    className="grid size-6 place-items-center p-0"
                    aria-label={player.isBot ? setup("bot") : setup("human")}
                  >
                    {player.isBot ? <Bot className="size-3.5" aria-hidden="true" /> : <UserRound className="size-3.5" aria-hidden="true" />}
                  </Badge>

                  <div className="min-w-0 flex-1">
                    <label htmlFor={playerInputId} className="sr-only">
                      {fallbackName}
                    </label>
                    <Input
                      id={playerInputId}
                      data-testid={`player-name-${playerNumber}`}
                      value={player.name}
                      autoComplete="off"
                      placeholder={setup("playerName")}
                      className="h-8 min-h-0 w-full rounded-lg border-transparent bg-background/55 px-2 text-sm font-black shadow-none focus-visible:border-ring"
                      disabled={sessionBackedHumans && !player.isBot}
                      onChange={(event) => onRenamePlayer(player.id, event.target.value)}
                    />
                  </div>

                  {player.isBot ? (
                    <div className="min-w-0 flex-1">
                      <label htmlFor={botLevelId} className="sr-only">
                        {setup("botLevelFor", { number: playerNumber })}
                      </label>
                      <Select
                        value={String(player.botLevel ?? 1)}
                        onValueChange={(value) => onBotLevelChange(player.id, botLevelFromValue(value))}
                      >
                        <SelectTrigger id={botLevelId} data-testid={`bot-level-${playerNumber}`} className="h-8 min-h-0 w-full rounded-lg bg-background/65 px-2 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BOT_LEVELS.map((level) => (
                            <SelectItem key={level} value={String(level)}>
                              {levels(botLevelMessageKeys[level])}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  {sessionBackedHumans && !player.isBot ? null : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 min-h-0 shrink-0 rounded-full text-muted-foreground hover:text-destructive"
                      aria-label={setup("removePlayerA11y", { name: player.name || fallbackName })}
                      onClick={() => onRemovePlayer(player.id)}
                    >
                      <X className="size-4" aria-hidden="true" />
                      <span className="sr-only">{setup("removePlayer")}</span>
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
