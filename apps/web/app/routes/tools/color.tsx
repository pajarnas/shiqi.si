import { Badge, Card, Cluster, Field, OutputList, Stack, TextInput } from '@shiqi/ui';
import { useState } from 'react';
import { PageWindow, pageMeta } from '~/components/PageWindow';
import {
  contrastRatio,
  formatColor,
  parseColor,
  wcagLevels,
  type Rgba,
} from '~/features/tools/color';
import { useI18n } from '~/i18n';
import type { Route } from './+types/color';

export const meta: Route.MetaFunction = ({ matches }) =>
  pageMeta(matches, (t) => ({ title: t.entries.color.title, description: t.color.description }));

const css = (c: Rgba) => `rgb(${c.r} ${c.g} ${c.b} / ${c.a})`;

export default function ColorTool() {
  const { t } = useI18n();
  const [fg, setFg] = useState('#121212');
  const [bg, setBg] = useState('#f2b51b');
  const a = parseColor(fg);
  const b = parseColor(bg);
  const ratio = a && b ? contrastRatio(a, b) : null;
  const levels = ratio ? wcagLevels(ratio) : null;
  const f = a ? formatColor(a) : null;

  return (
    <PageWindow page="color" title={t.entries.color.title} lede={t.color.lede}>
      <Stack gap={5}>
        <div className="two-col">
          <Field label={t.color.text} error={fg && !a ? t.color.invalid : undefined}>
            {(p) => (
              <Cluster>
                <input
                  type="color"
                  aria-label={t.color.pickText}
                  value={f?.hex.slice(0, 7) ?? '#000000'}
                  onChange={(e) => setFg(e.target.value)}
                  className="color-well"
                />
                <TextInput
                  {...p}
                  value={fg}
                  onChange={(e) => setFg(e.target.value)}
                  style={{ flex: 1 }}
                />
              </Cluster>
            )}
          </Field>
          <Field label={t.color.background} error={bg && !b ? t.color.invalid : undefined}>
            {(p) => (
              <Cluster>
                <input
                  type="color"
                  aria-label={t.color.pickBackground}
                  value={b ? formatColor(b).hex.slice(0, 7) : '#ffffff'}
                  onChange={(e) => setBg(e.target.value)}
                  className="color-well"
                />
                <TextInput
                  {...p}
                  value={bg}
                  onChange={(e) => setBg(e.target.value)}
                  style={{ flex: 1 }}
                />
              </Cluster>
            )}
          </Field>
        </div>

        {a && b && ratio && levels && (
          <Card className="contrast" style={{ color: css(a), background: css(b) }}>
            <p className="contrast__big">{t.color.sampleBig}</p>
            <p>{t.color.sample}</p>
            <Cluster className="contrast__badges">
              <span className="ui-pixel contrast__ratio">{ratio.toFixed(2)}:1</span>
              <Badge tone={levels.normalAA ? 'green' : 'gold'}>
                {t.color.normalAA} {levels.normalAA ? '✓' : '✗'}
              </Badge>
              <Badge tone={levels.normalAAA ? 'green' : 'gold'}>
                {t.color.normalAAA} {levels.normalAAA ? '✓' : '✗'}
              </Badge>
              <Badge tone={levels.largeAA ? 'green' : 'gold'}>
                {t.color.largeAA} {levels.largeAA ? '✓' : '✗'}
              </Badge>
            </Cluster>
          </Card>
        )}

        {f && (
          <Card>
            <OutputList
              rows={[
                { label: 'HEX', value: f.hex },
                { label: 'RGB', value: f.rgb },
                { label: 'HSL', value: f.hsl },
                { label: 'OKLCH', value: f.oklch },
              ]}
            />
          </Card>
        )}
      </Stack>
    </PageWindow>
  );
}
