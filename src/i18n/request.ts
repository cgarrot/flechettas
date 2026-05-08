import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import type { RequestConfig } from "next-intl/server";

import { routing, type Locale } from "./routing";

type Messages = NonNullable<RequestConfig["messages"]>;
type MessageModule = { default: Messages };

const loadMessages: Record<Locale, () => Promise<MessageModule>> = {
  fr: () => import("../messages/fr.json") as Promise<MessageModule>,
  en: () => import("../messages/en.json") as Promise<MessageModule>,
};

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await loadMessages[locale]()).default,
  };
});
