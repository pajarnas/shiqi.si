import { Clock, MenuBar, PixelDesktop, ThemeSelect } from '@shiqi/ui';
import { Link, NavLink, Outlet } from 'react-router';
import { LanguageSwitch } from '~/components/LanguageSwitch';
import { Logo } from '~/components/Logo';
import { useI18n } from '~/i18n';
import { NAV, SITE } from '~/site';

/** Chrome shared by every page: animated desktop, menu bar, footer. */
export default function SiteLayout() {
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
        <Outlet />
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
