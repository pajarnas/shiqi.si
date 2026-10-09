import { Clock, MenuBar, PixelDesktop, ThemeSelect } from '@shiqi/ui';
import type { ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { ErrorScreen, errorStatus } from '~/components/ErrorScreen';
import { LanguageSwitch } from '~/components/LanguageSwitch';
import { Logo } from '~/components/Logo';
import { useI18n } from '~/i18n';
import { NAV, SITE } from '~/site';
import type { Route } from './+types/site';

/** Chrome shared by every page: animated desktop, menu bar, footer. */
export default function SiteLayout() {
  return (
    <Chrome>
      <Outlet />
    </Chrome>
  );
}

/** Headers on a thrown response (e.g. WWW-Authenticate on a 401) reach the browser. */
export function headers({ errorHeaders }: Route.HeadersArgs) {
  return errorHeaders ?? new Headers();
}

/** Errors inside a page keep the menu bar, so visitors can just click away. */
export function ErrorBoundary({ error }: { error: unknown }) {
  return (
    <Chrome>
      <ErrorScreen status={errorStatus(error)} />
    </Chrome>
  );
}

function Chrome({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <>
      <a className="skip-link" href="#main">
        {t.chrome.skipToContent}
      </a>
      <PixelDesktop />
      <MenuBar
        brand={
          <Link to="/" className="brand" aria-label={t.chrome.homeLink}>
            <Logo />
            <span className="ui-pixel">{SITE.name}</span>
          </Link>
        }
        end={
          <>
            <LanguageSwitch />
            <ThemeSelect />
            <Clock className="menubar-clock" />
          </>
        }
      >
        {NAV.slice(1).map((n) => (
          <NavLink key={n.path} to={n.path} end={n.path === '/'}>
            {t.nav[n.key]}
          </NavLink>
        ))}
      </MenuBar>
      <main id="main" className="desk ui-container">
        {children}
      </main>
      <footer className="site-footer ui-container">
        <p>
          <span className="ui-pixel">{SITE.copyright}</span> · {t.chrome.footer} ·{' '}
          <Link to="/ui">{t.chrome.components}</Link>
        </p>
      </footer>
    </>
  );
}
