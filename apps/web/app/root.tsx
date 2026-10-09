import '@shiqi/ui/styles.css';
import './app.css';

import { ThemeProvider, ToastProvider, themeScript } from '@shiqi/ui';
import type { ReactNode } from 'react';
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from 'react-router';
import type { Route } from './+types/root';
import { HTML_LANG, I18nProvider, useI18n, type Locale } from './i18n';
import { useRootData } from './i18n/root-data';
import { fillGaps } from './i18n/gaps.server';
import { resolveLocale } from './i18n/locale.server';

export const links: Route.LinksFunction = () => [
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
  {
    rel: 'preload',
    href: '/fonts/silkscreen-latin-400-normal.woff2',
    as: 'font',
    type: 'font/woff2',
    crossOrigin: 'anonymous',
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  const { locale, source } = await resolveLocale(request);
  return { locale, source, extra: await fillGaps(locale) };
}

export type RootData = Awaited<ReturnType<typeof loader>>;

export function Layout({ children }: { children: ReactNode }) {
  const locale: Locale = useRootData()?.locale ?? 'en';
  return (
    <html lang={HTML_LANG[locale]} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" content="#f2b51b" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Meta />
        <Links />
      </head>
      <body>
        <Providers>{children}</Providers>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function Providers({ children }: { children: ReactNode }) {
  const data = useRootData();
  return (
    <I18nProvider locale={data?.locale ?? 'en'} extra={data?.extra}>
      <ThemeProvider>
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { t } = useI18n();
  let title = t.error.title;
  let detail = t.error.detail;
  if (isRouteErrorResponse(error)) {
    title = String(error.status);
    detail = error.statusText || detail;
  } else if (import.meta.env.DEV && error instanceof Error) {
    detail = error.message;
  }
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>{title}</h1>
      <p>{detail}</p>
      <p>
        <a href="/">{t.error.home}</a>
      </p>
    </main>
  );
}
