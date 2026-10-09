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

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
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
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <Outlet />
      </ToastProvider>
    </ThemeProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = '出错了';
  let detail = '页面遇到了一个意外的问题。';
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
        <a href="/">回首页</a>
      </p>
    </main>
  );
}
