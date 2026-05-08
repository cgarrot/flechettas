import { routing, type Locale } from "./routing";

type LocaleStaticParams = Array<{ locale: Locale }>;

export function getAllLocaleStaticParams(): LocaleStaticParams {
  return routing.locales.map((locale) => ({ locale }));
}

export function getFrenchLocaleStaticParams(): LocaleStaticParams {
  return [{ locale: "fr" }];
}

export function getEnglishLocaleStaticParams(): LocaleStaticParams {
  return [{ locale: "en" }];
}
