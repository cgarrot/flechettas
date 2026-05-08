import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { HomeScreen } from "@/components/home/home-screen";
import { routing } from "@/i18n/routing";
import { getAllLocaleStaticParams } from "@/i18n/static-params";

type LocaleHomePageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export function generateStaticParams() {
  return getAllLocaleStaticParams();
}

export default async function LocaleHomePage({ params }: LocaleHomePageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale) || (locale !== "fr" && locale !== "en")) {
    notFound();
  }

  setRequestLocale(locale);

  return <HomeScreen locale={locale} />;
}
