import { PixelIcon, useLocalStorage, useMediaQuery } from '@shiqi/ui';
import type { CSSProperties, ReactNode } from 'react';
import { KEY_COLORS } from '../keys';
import { useKafkaStrings } from '../strings';

const cell = (color: string, extra = '') => (
  <span className={`kv-cell ${extra}`} style={{ '--cell': color } as CSSProperties} />
);

const packet = (kind: string, color: string) => (
  <span
    className={`kv-legend__pkt kv-legend__pkt--${kind}`}
    style={{ '--pkt': color } as CSSProperties}
  />
);

function Item({ sample, children }: { sample: ReactNode; children: ReactNode }) {
  return (
    <li>
      <span className="kv-legend__sample" aria-hidden="true">
        {sample}
      </span>
      <span>{children}</span>
    </li>
  );
}

/**
 * Every mark on the stage, drawn with the same classes the stage uses, next
 * to what it means. Open at first on wide screens (on a phone it would push
 * the stage far down); after that, as the reader last left it.
 */
export function Legend() {
  const t = useKafkaStrings().legend;
  const [saved, setSaved] = useLocalStorage<boolean | null>('kafka:legend-open', null);
  const wide = useMediaQuery('(min-width: 64rem)');
  const open = saved ?? wide;
  const role = (kind: string, letter: string) => (
    <span className={`kv-replica__role kv-replica__role--demo kv-replica--${kind}`}>{letter}</span>
  );
  return (
    <details
      className="kv-legend"
      open={open}
      onToggle={(e) => {
        const now = (e.currentTarget as HTMLDetailsElement).open;
        if (now !== open) setSaved(now);
      }}
    >
      <summary>{t.title}</summary>
      <div className="kv-legend__grid">
        <section>
          <h4>{t.sections.brokers}</h4>
          <ul>
            <Item sample={<span className="kv-led kv-led--on" />}>{t.power}</Item>
            <Item sample={<span className="kv-led kv-led--activity kv-led--blink" />}>
              {t.activity}
            </Item>
            <Item
              sample={
                <span className="kv-tag kv-tag--controller">
                  <PixelIcon name="star" size={12} />
                </span>
              }
            >
              {t.controller}
            </Item>
            <Item sample={<span className="kv-legend__meter" />}>{t.meters}</Item>
            <Item sample={<span className="kv-legend__box kv-legend__box--slow" />}>
              {t.slowBroker}
            </Item>
            <Item sample={<span className="kv-legend__box kv-legend__box--down" />}>
              {t.downBroker}
            </Item>
            <Item sample={role('leader', 'L')}>{t.leader}</Item>
            <Item sample={role('follower', 'F')}>{t.follower}</Item>
            <Item sample={role('out', '×')}>{t.outOfSync}</Item>
            <Item sample={<b className="kv-legend__num">12</b>}>{t.leo}</Item>
          </ul>
        </section>
        <section>
          <h4>{t.sections.log}</h4>
          <ul>
            <Item
              sample={Array.from({ length: KEY_COLORS }, (_, i) => (
                <span key={i}>{cell(`var(--kv-key-${i})`)}</span>
              ))}
            >
              {t.record}
            </Item>
            <Item sample={cell('var(--kv-key-none)')}>{t.nullKey}</Item>
            <Item sample={cell('var(--kv-key-0)', 'kv-cell--dirty')}>{t.dirty}</Item>
            <Item sample={cell('var(--kv-key-2)', 'kv-cell--uncommitted')}>{t.uncommitted}</Item>
            <Item sample={cell('var(--surface)', 'kv-cell--tombstone')}>{t.tombstone}</Item>
            <Item sample={<span className="kv-cell kv-cell--gone" />}>{t.gone}</Item>
            <Item sample={<span className="kv-cell kv-cell--missing" />}>{t.missing}</Item>
            <Item sample={cell('var(--kv-key-2)', 'kv-cell--diverged')}>{t.diverged}</Item>
            <Item sample={<span className="kv-swatch kv-swatch--hw" />}>{t.hw}</Item>
            <Item sample={<span className="kv-swatch kv-swatch--own-hw" />}>{t.ownHw}</Item>
            <Item sample={<span className="kv-legend__pin" />}>{t.pin}</Item>
            <Item sample={<span className="kv-legend__box kv-legend__box--selected" />}>
              {t.selected}
            </Item>
          </ul>
        </section>
        <section>
          <h4>{t.sections.clients}</h4>
          <ul>
            <Item sample={<PixelIcon name="envelope" size={16} />}>{t.producer}</Item>
            <Item sample={<span className="kv-legend__box kv-legend__box--slow" />}>
              {t.waiting}
            </Item>
            <Item sample={<PixelIcon name="face" size={16} />}>{t.consumer}</Item>
            <Item sample={<span className="kv-legend__box" />}>{t.group}</Item>
          </ul>
          <h4>{t.sections.motion}</h4>
          <ul>
            <Item
              sample={[0, 2, 3].map((i) => (
                <span key={i}>{packet('record', `var(--kv-key-${i})`)}</span>
              ))}
            >
              {t.packetRecord}
            </Item>
            <Item sample={packet('replica', 'var(--kv-replica)')}>{t.packetReplica}</Item>
            <Item sample={packet('consume', 'var(--kv-consume)')}>{t.packetConsume}</Item>
            <Item sample={packet('error', 'var(--danger)')}>{t.packetError}</Item>
          </ul>
        </section>
      </div>
    </details>
  );
}
