import { ICONS, type IconName } from '@shiqi/pixel';
import {
  Badge,
  Button,
  Callout,
  Card,
  Checkbox,
  Cluster,
  Field,
  Grid,
  Kbd,
  List,
  ListItem,
  OutputList,
  PixelIcon,
  Quiz,
  Range,
  Section,
  Segmented,
  Select,
  Stack,
  Swatches,
  THEMES,
  TextInput,
  Window,
  useTheme,
  useToast,
  type ThemePreference,
} from '@shiqi/ui';
import { useState } from 'react';
import { PageWindow, pageMeta } from '~/components/PageWindow';

export const meta = () => pageMeta('组件库', '@shiqi/ui 的全部组件和主题，一页看完。');

const TOKENS = [
  'bg',
  'surface',
  'text',
  'text-muted',
  'border',
  'accent',
  'accent-soft',
  'accent-2',
  'link',
  'code-bg',
];

export default function UiGallery() {
  const { preference, setPreference } = useTheme();
  const toast = useToast();
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [sw, setSw] = useState('#f2b51b');
  const [range, setRange] = useState(40);

  return (
    <PageWindow
      file="ui/"
      eyebrow="@shiqi/ui"
      title="组件库"
      lede="网站上每个界面元素都来自这里。主题只是一组 CSS 变量；组件只读语义变量，所以换主题不用改组件。"
    >
      <Stack gap={2}>
        <span className="ui-field__label">主题</span>
        <Segmented
          label="主题"
          value={preference}
          onChange={(v: ThemePreference) => setPreference(v)}
          options={THEMES.map((t) => ({ value: t.id, label: t.label }))}
        />
      </Stack>

      <Section eyebrow="TOKENS" title="语义颜色" description="来自 themes.css，组件只用这些。">
        <Grid min="8rem" gap={3}>
          {TOKENS.map((t) => (
            <div key={t} className="token">
              <span className="token__chip" style={{ background: `var(--${t})` }} />
              <code>--{t}</code>
            </div>
          ))}
        </Grid>
      </Section>

      <Section eyebrow="TYPE" title="文字">
        <Stack gap={3}>
          <h1>标题一 H1</h1>
          <h2>标题二 H2</h2>
          <h3>标题三 H3</h3>
          <p>
            正文用系统字体（苹方 / SF），英文标签用 <span className="ui-pixel">SILKSCREEN</span>{' '}
            像素字体，代码用 <code>ui-monospace</code>。
          </p>
        </Stack>
      </Section>

      <Section eyebrow="BUTTON" title="按钮">
        <Cluster gap={3}>
          <Button>主要</Button>
          <Button variant="secondary">次要</Button>
          <Button variant="accent">强调</Button>
          <Button variant="ghost">幽灵</Button>
          <Button size="sm">小号</Button>
          <Button disabled>禁用</Button>
          <Button iconOnly aria-label="星星">
            <PixelIcon name="star" size={16} />
          </Button>
          <Button onClick={() => toast('你好，像素')}>弹个提示</Button>
        </Cluster>
      </Section>

      <Section eyebrow="FORM" title="表单">
        <div className="two-col">
          <Stack gap={4}>
            <Field label="文本" hint="Field 会自动连好 label、提示和错误。">
              {(p) => <TextInput {...p} placeholder="写点什么" />}
            </Field>
            <Field label="出错的样子" error="这里有个错误">
              {(p) => <TextInput {...p} defaultValue="???" />}
            </Field>
            <Field label="选择">
              {(p) => (
                <Select {...p}>
                  <option>金色</option>
                  <option>绿色</option>
                </Select>
              )}
            </Field>
          </Stack>
          <Stack gap={4}>
            <Segmented
              label="分段控件"
              value={seg}
              onChange={setSeg}
              options={[
                { value: 'a', label: '一' },
                { value: 'b', label: '二' },
                { value: 'c', label: '三' },
              ]}
            />
            <Swatches
              label="色板"
              value={sw}
              onChange={setSw}
              colors={[
                { value: '#121212', name: '墨' },
                { value: '#fbf8ef', name: '纸' },
                { value: '#f2b51b', name: '金' },
                { value: '#1f9d55', name: '绿' },
              ]}
            />
            <Field label={`滑块 ${range}`}>
              {(p) => (
                <Range {...p} value={range} onChange={(e) => setRange(Number(e.target.value))} />
              )}
            </Field>
            <Checkbox label="复选框" defaultChecked />
          </Stack>
        </div>
      </Section>

      <Section eyebrow="DISPLAY" title="展示">
        <Stack gap={4}>
          <Cluster gap={3}>
            <Badge>NEW</Badge>
            <Badge tone="green">OK</Badge>
            <span>
              快捷键 <Kbd>⌘</Kbd> <Kbd>K</Kbd>
            </span>
          </Cluster>
          <Callout>Callout：用来放提示和补充说明。</Callout>
          <Card>
            <OutputList
              rows={[
                { label: '键', value: '值，可以复制' },
                { label: 'ISO 8601', value: '2026-10-09' },
              ]}
            />
          </Card>
          <Card>
            <List>
              <ListItem
                icon={<PixelIcon name="folder" />}
                title="列表项"
                description="Settings 风格的分组列表"
                meta="›"
              />
              <ListItem
                icon={<PixelIcon name="envelope" />}
                title="另一项"
                description="可以渲染成链接"
                meta="12"
              />
            </List>
          </Card>
          <Window title="window.app">
            <p>窗口：条纹标题栏 + 方形关闭框。每个页面都装在一个窗口里。</p>
          </Window>
        </Stack>
      </Section>

      <Section
        eyebrow="ICONS"
        title="像素图标"
        description="每个图标都是几行字符画，放在 @shiqi/pixel 里。"
      >
        <div className="icon-grid">
          {(Object.keys(ICONS) as IconName[]).map((name) => (
            <figure key={name}>
              <PixelIcon name={name} size={32} />
              <figcaption>{name}</figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section eyebrow="QUIZ" title="小测验" description="课程笔记里会用到。">
        <Quiz
          title="DEMO"
          questions={[
            {
              q: '这个网站的主题色是？',
              options: ['红和蓝', '金和绿', '紫和粉'],
              answer: 1,
              explain: '金色、绿色，加上黑和白。',
            },
            { q: '一个图标最大多少像素？', options: ['8×8', '16×16', '64×64'], answer: 1 },
          ]}
        />
      </Section>
    </PageWindow>
  );
}
