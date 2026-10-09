import { Clock, MenuBar, PixelDesktop, ThemeSelect } from '@shiqi/ui';
import { Link, NavLink, Outlet } from 'react-router';
import { Logo } from '~/components/Logo';
import { NAV } from '~/site';

/** Chrome shared by every page: animated desktop, menu bar, footer. */
export default function SiteLayout() {
  return (
    <>
      <a className="skip-link" href="#main">
        跳到正文
      </a>
      <PixelDesktop />
      <MenuBar
        brand={
          <Link to="/" className="brand" aria-label="shiqi.si 首页">
            <Logo />
            <span className="ui-pixel">shiqi.si</span>
          </Link>
        }
        end={
          <>
            <ThemeSelect />
            <Clock className="menubar-clock" />
          </>
        }
      >
        {NAV.slice(1).map((n) => (
          <NavLink key={n.path} to={n.path} end={n.path === '/'}>
            {n.label}
          </NavLink>
        ))}
      </MenuBar>
      <main id="main" className="desk ui-container">
        <Outlet />
      </main>
      <footer className="site-footer ui-container">
        <p>
          <span className="ui-pixel">© 2026 shiqi.si</span> · React + TypeScript 手写 · 无追踪、无
          Cookie · <Link to="/ui">组件库</Link>
        </p>
      </footer>
    </>
  );
}
