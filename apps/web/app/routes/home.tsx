import { PixelIcon, List, ListItem, Window, buttonClass, useMounted } from '@shiqi/ui';
import { critterName } from '@shiqi/pixel';
import { useState } from 'react';
import { Link } from 'react-router';
import {
  CritterCanvas,
  LiveSky,
  dayOfYear,
  skyNameNow,
  todaysCritterSeed,
} from '~/components/Toys';
import { ToyGrid } from '~/components/ToyGrid';
import { latestNotes } from '~/content/notes';
import { SITE, TOOLS } from '~/site';
import type { Route } from './+types/home';

export const meta: Route.MetaFunction = () => [
  { title: 'shiqi.si' },
  { name: 'description', content: SITE.description },
];

export default function Home() {
  return (
    <div className="home">
      <Window title="shiqi.si — 你好">
        <div className="hello">
          <div className="hello__text">
            <span className="ui-eyebrow">HELLO, WORLD</span>
            <h1>你好，我是 Shiqi。</h1>
            <p className="hello__lede">
              在亚特兰大读书、写代码。喜欢规范，喜欢像素，喜欢刚刚好的东西。 这里是我的
              sandbox：几个小玩具、几件顺手的工具、一些笔记，以后还会有课程笔记和在线小测验。
            </p>
            <div className="ui-cluster hello__actions">
              <Link className={buttonClass()} to="/play/wallpaper">
                去玩玩
              </Link>
              <Link className={buttonClass({ variant: 'secondary' })} to="/tools">
                工具箱
              </Link>
            </div>
          </div>
          <TodaysCritter />
        </div>
      </Window>

      <SkyWindow />

      <Window title="玩具 — PLAY">
        <ToyGrid />
      </Window>

      <div className="home__pair">
        <Window title="工具 — TOOLS">
          <List className="flush">
            {TOOLS.map((t) => (
              <ListItem
                key={t.path}
                as={Link}
                to={t.path}
                icon={<PixelIcon name={t.icon} />}
                title={t.title}
                description={t.description}
                meta="›"
              />
            ))}
          </List>
        </Window>
        <Window title="笔记 — NOTES">
          <List className="flush">
            {latestNotes(4).map((n) => (
              <ListItem
                key={n.href}
                as={Link}
                to={n.href}
                icon={<PixelIcon name="book" />}
                title={n.title}
                description={n.summary}
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
  const mounted = useMounted();
  const [frame, setFrame] = useState(0);
  const [hop, setHop] = useState(0);
  // The date is the visitor's, so render the critter only after hydration.
  const seed = mounted ? todaysCritterSeed() : 0;
  return (
    <figure className="critter">
      <button
        type="button"
        className="critter__btn"
        aria-label="摸一摸今天的小怪"
        onClick={() => {
          setFrame((f) => 1 - f);
          setHop((n) => n + 1);
        }}
      >
        <span key={hop} className={hop ? 'critter__sprite hop' : 'critter__sprite'}>
          {mounted && (
            <CritterCanvas seed={seed} frame={frame} label={`今日小怪：${critterName(seed)}`} />
          )}
        </span>
      </button>
      <figcaption>
        <span className="ui-pixel ui-muted">DAY {mounted ? dayOfYear() : '---'}</span>
        <strong>{mounted ? critterName(seed) : '……'}</strong>
        <span className="ui-muted">今日小怪，每天换一只</span>
      </figcaption>
    </figure>
  );
}

function SkyWindow() {
  const mounted = useMounted();
  return (
    <Window title={`sky.app — ${mounted ? skyNameNow() : '现在'}`}>
      <div className="sky">
        {mounted ? <LiveSky /> : <div className="sky__placeholder" />}
        <p className="ui-muted">
          这片天空跟着<strong>你</strong>
          的时钟走：清晨是薄荷色，午后变金，夜里有萤火虫。想要一张当壁纸？去
          <Link to="/play/wallpaper">像素壁纸</Link>。
        </p>
      </div>
    </Window>
  );
}
