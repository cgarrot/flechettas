import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { HistoryListScreen } from "@/components/history/history-list-screen";
import { routing } from "@/i18n/routing";
import { getFrenchLocaleStaticParams } from "@/i18n/static-params";

type HistoriquePageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export function generateStaticParams() {
  return getFrenchLocaleStaticParams();
}

export default async function HistoriquePage({ params }: HistoriquePageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale) || locale !== "fr") {
    notFound();
  }

  setRequestLocale(locale);

  return <HistoryListScreen locale={locale} />;
}
