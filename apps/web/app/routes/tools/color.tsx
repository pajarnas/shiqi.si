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

export const meta = () => pageMeta('颜色', 'HEX、RGB、HSL、OKLCH 互转，WCAG 2 对比度检查。');

const css = (c: Rgba) => `rgb(${c.r} ${c.g} ${c.b} / ${c.a})`;

export default function ColorTool() {
  const [fg, setFg] = useState('#121212');
  const [bg, setBg] = useState('#f2b51b');
  const a = parseColor(fg);
  const b = parseColor(bg);
  const ratio = a && b ? contrastRatio(a, b) : null;
  const levels = ratio ? wcagLevels(ratio) : null;
  const f = a ? formatColor(a) : null;

  return (
    <PageWindow
      file="tools/color"
      eyebrow="COLOR"
      title="颜色"
      lede="输入 HEX、rgb() 或 hsl()。第一个颜色当文字，第二个当背景，顺便算 WCAG 对比度。"
    >
      <Stack gap={5}>
        <div className="two-col">
          <Field label="文字颜色" error={fg && !a ? '无法解析' : undefined}>
            {(p) => (
              <Cluster>
                <input
                  type="color"
                  aria-label="选择文字颜色"
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
          <Field label="背景颜色" error={bg && !b ? '无法解析' : undefined}>
            {(p) => (
              <Cluster>
                <input
                  type="color"
                  aria-label="选择背景颜色"
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
            <p className="contrast__big">像素 Aa 1984</p>
            <p>敏捷的金色小怪跳过了绿色的山丘。</p>
            <Cluster className="contrast__badges">
              <span className="ui-pixel contrast__ratio">{ratio.toFixed(2)}:1</span>
              <Badge tone={levels.normalAA ? 'green' : 'gold'}>
                正文 AA {levels.normalAA ? '✓' : '✗'}
              </Badge>
              <Badge tone={levels.normalAAA ? 'green' : 'gold'}>
                正文 AAA {levels.normalAAA ? '✓' : '✗'}
              </Badge>
              <Badge tone={levels.largeAA ? 'green' : 'gold'}>
                大字 AA {levels.largeAA ? '✓' : '✗'}
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
