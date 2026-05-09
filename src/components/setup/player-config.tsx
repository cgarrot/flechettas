"use client";

import { Bot, CheckCircle2, Plus, UserRound, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  const humanCount = players.filter((player) => !player.isBot).length;
  const botCount = players.length - humanCount;
  const canAddPlayer = players.length < maxTotalPlayers;
  const canAddHuman = canAddPlayer && humanCount < maxHumanPlayers;
  const canCreateHuman = canAddHuman && (!sessionBackedHumans || newHumanName.trim().length > 0);

  return (
    <section className="space-y-3" aria-labelledby="player-config-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
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
        <div className="flex flex-wrap justify-end gap-2">
          <Badge variant="secondary">{setup("playerCount", { count: humanCount })}</Badge>
          <Badge variant="outline">{setup("botCount", { count: botCount })}</Badge>
        </div>
      </div>

      {sessionBackedHumans ? (
        <Card className="border-primary/20 bg-background/65 py-0">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <UserRound className="size-4 text-primary" aria-hidden="true" />
              {setup("sessionPlayersTitle")}
            </CardTitle>
            <CardDescription className="text-xs">{setup("sessionPlayersDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid max-h-40 gap-2 overflow-y-auto p-3 pt-0 sm:grid-cols-2">
            {availableSessionPlayers.length > 0 ? availableSessionPlayers.map((player) => {
              const isSelected = selectedSessionPlayerIds.includes(player.id);
              const canToggleOn = isSelected || canAddHuman;

              return (
                <Button
                  key={player.id}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  className="min-h-10 justify-start rounded-xl"
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
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        {sessionBackedHumans ? (
          <Input
            value={newHumanName}
            className="min-h-10 bg-background/65"
            placeholder={setup("newSessionPlayerPlaceholder")}
            aria-label={setup("newSessionPlayerName")}
            onChange={(event) => onNewHumanNameChange?.(event.target.value)}
          />
        ) : null}
        <Button
          type="button"
          size="sm"
          className="min-h-10"
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
          className="min-h-10"
          data-testid="add-bot"
          disabled={!canAddPlayer}
          onClick={onAddBot}
        >
          <Bot aria-hidden="true" />
          {setup("addBot")}
        </Button>
      </div>

      {validationMessage ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive" role="alert">
          {validationMessage}
        </p>
      ) : null}

      <div className="space-y-2">
        {players.length === 0 ? (
            <Card className="border-dashed border-primary/20 bg-card/70">
            <CardContent className="py-5 text-center text-sm text-muted-foreground">
              {setup("emptyPlayers")}
            </CardContent>
          </Card>
        ) : null}

        {players.map((player, index) => {
          const playerNumber = index + 1;
          const playerInputId = `player-name-${player.id}`;
          const botLevelId = `bot-level-${player.id}`;

          return (
            <Card key={player.id} className="border-primary/15 bg-card/90 py-0 shadow-lg shadow-primary/5">
              <CardContent className="grid gap-3 p-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="grid gap-2 sm:grid-cols-[1fr_12rem] sm:items-end">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={player.isBot ? "secondary" : "outline"}>
                        {player.isBot ? setup("bot") : setup("human")}
                      </Badge>
                      <label htmlFor={playerInputId} className="text-sm font-medium">
                        {setup("playerNameFor", { number: playerNumber })}
                      </label>
                    </div>
                    <Input
                      id={playerInputId}
                      data-testid={`player-name-${playerNumber}`}
                      value={player.name}
                      autoComplete="off"
                      placeholder={setup("playerName")}
                      className="min-h-10 bg-background/65"
                      disabled={sessionBackedHumans && !player.isBot}
                      onChange={(event) => onRenamePlayer(player.id, event.target.value)}
                    />
                  </div>

                  {player.isBot ? (
                    <div className="space-y-2">
                      <label htmlFor={botLevelId} className="text-sm font-medium">
                        {setup("botLevelFor", { number: playerNumber })}
                      </label>
                      <Select
                        value={String(player.botLevel ?? 1)}
                        onValueChange={(value) => onBotLevelChange(player.id, botLevelFromValue(value))}
                      >
                        <SelectTrigger id={botLevelId} data-testid={`bot-level-${playerNumber}`} className="min-h-10 w-full bg-background/65">
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
                </div>

                {sessionBackedHumans && !player.isBot ? null : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-10 sm:px-4"
                    aria-label={setup("removePlayerA11y", { name: player.name || setup("playerNameFor", { number: playerNumber }) })}
                    onClick={() => onRemovePlayer(player.id)}
                  >
                    <X aria-hidden="true" />
                    <span className="sm:sr-only">{setup("removePlayer")}</span>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
