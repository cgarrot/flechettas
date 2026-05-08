import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { GameScreen } from "@/components/game/game-screen";
import { routing } from "@/i18n/routing";
import { getEnglishLocaleStaticParams } from "@/i18n/static-params";

type GamePageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export function generateStaticParams() {
  return getEnglishLocaleStaticParams();
}

export default async function GamePage({ params }: GamePageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale) || locale !== "en") {
    notFound();
  }

  setRequestLocale(locale);

  return <GameScreen locale={locale} />;
}
