import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { RouteContent } from "@/components/layout/route-content";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { OfflineIndicator } from "@/components/pwa/offline-indicator";
import { UpdatePrompt } from "@/components/pwa/update-prompt";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { routing, type Locale } from "@/i18n/routing";

import "../globals.css";
import "../scoreboard-theme.css";

export const metadata: Metadata = {
  applicationName: "Fléchettas",
  title: "Fléchettas",
  description: "Local-first darts scoring PWA",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Fléchettas",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#071711",
  colorScheme: "dark light",
};

type LocaleLayoutProps = Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>;

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const typedLocale = locale as Locale;

  return (
    <html
      lang={locale}
      className="dark"
      style={{ scrollPaddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}
      suppressHydrationWarning
    >
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
            <div className="min-h-dvh bg-background text-foreground">
              <div className="md:pl-24">
                <AppHeader locale={typedLocale} />
                <RouteContent>{children}</RouteContent>
              </div>
              <BottomNav locale={typedLocale} />
              <OfflineIndicator />
              <UpdatePrompt />
              <InstallPrompt />
            </div>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
