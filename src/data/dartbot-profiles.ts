import type { BotLevel, BotProfile } from "@/types";

export const BOT_PROFILES = {
  1: {
    level: 1,
    name: "DartBot Débutant",
    avg3Dart: 20,
    checkoutRate: 5,
    tripleRate: 0.03,
    doubleRate: 0.05,
  },
  2: {
    level: 2,
    name: "DartBot Amateur",
    avg3Dart: 40,
    checkoutRate: 10,
    tripleRate: 0.08,
    doubleRate: 0.12,
  },
  3: {
    level: 3,
    name: "DartBot Intermédiaire",
    avg3Dart: 60,
    checkoutRate: 18,
    tripleRate: 0.15,
    doubleRate: 0.22,
  },
  4: {
    level: 4,
    name: "DartBot Avancé",
    avg3Dart: 80,
    checkoutRate: 28,
    tripleRate: 0.22,
    doubleRate: 0.32,
  },
  5: {
    level: 5,
    name: "DartBot Expert",
    avg3Dart: 100,
    checkoutRate: 40,
    tripleRate: 0.3,
    doubleRate: 0.42,
  },
  6: {
    level: 6,
    name: "DartBot Légendaire",
    avg3Dart: 120,
    checkoutRate: 55,
    tripleRate: 0.38,
    doubleRate: 0.52,
  },
} satisfies Record<BotLevel, BotProfile>;

export function getBotProfile(level: BotLevel): BotProfile {
  return BOT_PROFILES[level];
}
