import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { HistoryDetailScreen } from "@/components/history/history-detail-screen";
import { routing } from "@/i18n/routing";

type HistoryDetailPageProps = Readonly<{
  params: Promise<{ locale: string; id: string }>;
}>;

export default async function HistoryDetailPage({ params }: HistoryDetailPageProps) {
  const { locale, id } = await params;

  if (!hasLocale(routing.locales, locale) || locale !== "en") {
    notFound();
  }

  setRequestLocale(locale);

  return <HistoryDetailScreen locale={locale} gameId={id} />;
}
