import { PixelIcon, List, ListItem, Window, buttonClass, useMounted } from '@shiqi/ui';
import { useState } from 'react';
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
import { SITE, TOOLS } from '~/site';
import type { Route } from './+types/home';

const LATEST = 4;

export const meta: Route.MetaFunction = ({ matches }) => [
  { title: SITE.name },
  { name: 'description', content: metaStrings(matches).site.description },
];

export async function loader({ request }: Route.LoaderArgs) {
  const { locale } = await resolveLocale(request);
  return { noteText: await localizeNoteMeta(latestNotes(LATEST), locale) };
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

      <Window title={t.home.playWindow}>
        <ToyGrid />
      </Window>

      <div className="home__pair">
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
        <Window title={t.home.notesWindow}>
          <List className="flush">
            {latestNotes(LATEST).map((n) => (
              <ListItem
                key={n.slug}
                as={Link}
                to={`/notes/${n.slug}`}
                icon={<PixelIcon name="book" />}
                title={loaderData.noteText[n.slug]?.title ?? n.title}
                description={loaderData.noteText[n.slug]?.summary ?? n.summary}
                meta={n.date.slice(5)}
              />
            ))}
          </List>
        </Window>
      </div>
    </div>
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
