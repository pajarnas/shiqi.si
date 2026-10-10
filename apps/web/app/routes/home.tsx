import { Badge, PixelIcon, List, ListItem, Window, buttonClass, useMounted } from '@shiqi/ui';
import type { IconName } from '@shiqi/pixel';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  CritterCanvas,
  LiveSky,
  critterName,
  dayOfYear,
  skyNameNow,
  todaysCritterSeed,
} from '~/components/Toys';
import { ToyGrid } from '~/components/ToyGrid';
import { latestNotes } from '~/content/notes';
import { format, useI18n } from '~/i18n';
import { Rich } from '~/i18n/Rich';
import { localizeNoteMeta } from '~/i18n/notes.server';
import { metaStrings } from '~/i18n/root-data';
import { resolveLocale } from '~/i18n/locale.server';
import { LANGUAGES } from '~/i18n/locales';
import { VisitorMap } from '~/components/VisitorMap';
import { publicCountryCounts } from '~/features/visits/visits.server';
import { within } from '~/lib/redis.server';
import { ABOUT, NEXT, SITE, TOOLS } from '~/site';
import type { Route } from './+types/home';

const LATEST = 4;

export const meta: Route.MetaFunction = ({ matches }) => [
  { title: SITE.name },
  { name: 'description', content: metaStrings(matches).site.description },
];

export async function loader({ request }: Route.LoaderArgs) {
  const { locale } = await resolveLocale(request);
  const [noteText, visitors] = await Promise.all([
    localizeNoteMeta(latestNotes(LATEST), locale),
    within(publicCountryCounts(), 1500).catch(() => ({}) as Record<string, number>),
  ]);
  const regionName = new Intl.DisplayNames([LANGUAGES[locale].tag], { type: 'region' });
  const names = Object.fromEntries(
    Object.keys(visitors).map((code) => [code, regionName.of(code) ?? code]),
  );
  return { noteText, visitors, names };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { t } = useI18n();
  return (
    <div className="home">
      <Window title={t.home.window}>
        <div className="hello">
          <div className="hello__text">
            <span className="ui-eyebrow">{t.home.eyebrow}</span>
            <h1>{t.home.title}</h1>
            <p className="hello__lede">{t.home.lede}</p>
            <div className="ui-cluster hello__actions">
              <Link className={buttonClass()} to="/play/wallpaper">
                {t.home.play}
              </Link>
              <Link className={buttonClass({ variant: 'secondary' })} to="/tools">
                {t.home.tools}
              </Link>
            </div>
          </div>
          <TodaysCritter />
        </div>
      </Window>

      <SkyWindow />

      <VisitorsWindow counts={loaderData.visitors} names={loaderData.names} />

      <Window title={t.home.playWindow}>
        <ToyGrid />
      </Window>

      {/* Two columns that stack on their own, so a short window never leaves a gap. */}
      <div className="home__columns">
        <div className="home__stack">
          <Window title={t.home.toolsWindow}>
            <List className="flush">
              {TOOLS.map((tool) => (
                <ListItem
                  key={tool.path}
                  as={Link}
                  to={tool.path}
                  icon={<PixelIcon name={tool.icon} />}
                  title={t.entries[tool.key].title}
                  description={t.entries[tool.key].description}
                  meta="›"
                />
              ))}
            </List>
          </Window>
          <Window title={t.home.aboutWindow}>
            <FactList items={ABOUT.map((f) => ({ ...f, ...t.home.about[f.key] }))} />
          </Window>
        </div>
        <div className="home__stack">
          <Window title={t.home.notesWindow}>
            <List className="flush">
              {latestNotes(LATEST).map((n) => (
                <ListItem
                  key={n.href}
                  as={Link}
                  to={n.href}
                  icon={<PixelIcon name="book" />}
                  title={loaderData.noteText[n.href]?.title ?? n.title}
                  description={loaderData.noteText[n.href]?.summary ?? n.summary}
                  meta={n.date.slice(5)}
                />
              ))}
            </List>
          </Window>
          <Window title={t.home.nextWindow}>
            <FactList
              items={NEXT.map((f) => ({ ...f, ...t.home.next[f.key] }))}
              meta={<Badge>{t.home.soon}</Badge>}
            />
          </Window>
        </div>
      </div>
    </div>
  );
}

const TOP_COUNTRIES = 5;

function VisitorsWindow({
  counts,
  names,
}: {
  counts: Record<string, number>;
  names: Record<string, string>;
}) {
  const { t } = useI18n();
  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, TOP_COUNTRIES);
  const label = (name: string, n: number) => format(t.visitors.count, { name, n });
  return (
    <Window title={format(t.visitors.window, { n: Object.keys(counts).length })}>
      <div className="visitors">
        <VisitorMap counts={counts} names={names} label={label} title={t.visitors.title} />
        <div className="visitors__text">
          <p className="ui-muted">{top.length ? t.visitors.lede : t.visitors.empty}</p>
          {top.length > 0 && (
            <>
              <span className="ui-eyebrow">{t.visitors.top}</span>
              <ol className="visitors__top">
                {top.map(([code, n]) => (
                  <li key={code}>
                    <span>{names[code] ?? code}</span>
                    <span className="ui-pixel">{n}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      </div>
    </Window>
  );
}

function TodaysCritter() {
  const { t } = useI18n();
  const mounted = useMounted();
  const [frame, setFrame] = useState(0);
  const [hop, setHop] = useState(0);
  // The date is the visitor's, so render the critter only after hydration.
  const seed = mounted ? todaysCritterSeed() : 0;
  const name = critterName(t, seed);
  return (
    <figure className="critter">
      <button
        type="button"
        className="critter__btn"
        aria-label={t.critter.pet}
        onClick={() => {
          setFrame((f) => 1 - f);
          setHop((n) => n + 1);
        }}
      >
        <span key={hop} className={hop ? 'critter__sprite hop' : 'critter__sprite'}>
          {mounted && (
            <CritterCanvas seed={seed} frame={frame} label={format(t.critter.label, { name })} />
          )}
        </span>
      </button>
      <figcaption>
        <span className="ui-pixel ui-muted">
          {format(t.critter.day, { n: mounted ? dayOfYear() : '---' })}
        </span>
        <strong>{mounted ? name : t.critter.loading}</strong>
        <span className="ui-muted">{t.critter.caption}</span>
      </figcaption>
    </figure>
  );
}

function SkyWindow() {
  const { t } = useI18n();
  const mounted = useMounted();
  return (
    <Window title={format(t.sky.window, { name: mounted ? skyNameNow(t) : t.sky.now })}>
      <div className="sky">
        {mounted ? <LiveSky label={t.sky.canvas} /> : <div className="sky__placeholder" />}
        <p className="ui-muted">
          <Rich
            text={t.sky.text}
            tags={{
              b: (s) => <strong>{s}</strong>,
              link: (s) => <Link to="/play/wallpaper">{s}</Link>,
            }}
          />
        </p>
      </div>
    </Window>
  );
}

/** A plain list of icon + title + description rows (no links). */
function FactList({
  items,
  meta,
}: {
  items: readonly { key: string; icon: IconName; title: string; description: string }[];
  meta?: ReactNode;
}) {
  return (
    <List className="flush">
      {items.map((f) => (
        <ListItem
          key={f.key}
          icon={<PixelIcon name={f.icon} />}
          title={f.title}
          description={f.description}
          meta={meta}
        />
      ))}
    </List>
  );
}
