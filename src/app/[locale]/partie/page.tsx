import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { GameScreen } from "@/components/game/game-screen";
import { routing } from "@/i18n/routing";
import { getFrenchLocaleStaticParams } from "@/i18n/static-params";

type PartiePageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export function generateStaticParams() {
  return getFrenchLocaleStaticParams();
}

export default async function PartiePage({ params }: PartiePageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale) || locale !== "fr") {
    notFound();
  }

  setRequestLocale(locale);

  return <GameScreen locale={locale} />;
}
