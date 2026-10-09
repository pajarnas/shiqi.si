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
import { format, useI18n } from '~/i18n';
import { Rich } from '~/i18n/Rich';
import type { Route } from './+types/ui';

export const meta: Route.MetaFunction = ({ matches }) => pageMeta(matches, (t) => t.gallery);

/** Index of the right option for each question in strings.gallery.quiz. */
const QUIZ_ANSWERS = [1, 1];

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
  const { t } = useI18n();
  const g = t.gallery;
  const { preference, setPreference } = useTheme();
  const toast = useToast();
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [sw, setSw] = useState('#f2b51b');
  const [range, setRange] = useState(40);

  return (
    <PageWindow page="ui" title={g.title} lede={g.lede}>
      <Stack gap={2}>
        <span className="ui-field__label">{g.theme}</span>
        <Segmented
          label={g.theme}
          value={preference}
          onChange={(v: ThemePreference) => setPreference(v)}
          options={THEMES.map((th) => ({ value: th.id, label: t.ui.themes[th.id] }))}
        />
      </Stack>

      <Section eyebrow="TOKENS" title={g.tokensTitle} description={g.tokensDescription}>
        <Grid min="8rem" gap={3}>
          {TOKENS.map((tok) => (
            <div key={tok} className="token">
              <span className="token__chip" style={{ background: `var(--${tok})` }} />
              <code>--{tok}</code>
            </div>
          ))}
        </Grid>
      </Section>

      <Section eyebrow="TYPE" title={g.typeTitle}>
        <Stack gap={3}>
          <h1>{g.h1}</h1>
          <h2>{g.h2}</h2>
          <h3>{g.h3}</h3>
          <p>
            <Rich
              text={g.typeBody}
              tags={{
                px: (s) => <span className="ui-pixel">{s}</span>,
                c: (s) => <code>{s}</code>,
              }}
            />
          </p>
        </Stack>
      </Section>

      <Section eyebrow="BUTTON" title={g.buttonTitle}>
        <Cluster gap={3}>
          <Button>{g.primary}</Button>
          <Button variant="secondary">{g.secondary}</Button>
          <Button variant="accent">{g.accent}</Button>
          <Button variant="ghost">{g.ghost}</Button>
          <Button size="sm">{g.small}</Button>
          <Button disabled>{g.disabled}</Button>
          <Button iconOnly aria-label={g.star}>
            <PixelIcon name="star" size={16} />
          </Button>
          <Button onClick={() => toast(g.toastText)}>{g.toast}</Button>
        </Cluster>
      </Section>

      <Section eyebrow="FORM" title={g.formTitle}>
        <div className="two-col">
          <Stack gap={4}>
            <Field label={g.text} hint={g.textHint}>
              {(p) => <TextInput {...p} placeholder={g.placeholder} />}
            </Field>
            <Field label={g.errorLabel} error={g.errorText}>
              {(p) => <TextInput {...p} defaultValue="???" />}
            </Field>
            <Field label={g.select}>
              {(p) => (
                <Select {...p}>
                  <option>{t.colors.gold}</option>
                  <option>{t.colors.green}</option>
                </Select>
              )}
            </Field>
          </Stack>
          <Stack gap={4}>
            <Segmented
              label={g.segmented}
              value={seg}
              onChange={setSeg}
              options={[
                { value: 'a', label: g.one },
                { value: 'b', label: g.two },
                { value: 'c', label: g.three },
              ]}
            />
            <Swatches
              label={g.swatches}
              value={sw}
              onChange={setSw}
              colors={[
                { value: '#121212', name: t.colors.ink },
                { value: '#fbf8ef', name: t.colors.paper },
                { value: '#f2b51b', name: t.colors.gold },
                { value: '#1f9d55', name: t.colors.green },
              ]}
            />
            <Field label={format(g.slider, { n: range })}>
              {(p) => (
                <Range {...p} value={range} onChange={(e) => setRange(Number(e.target.value))} />
              )}
            </Field>
            <Checkbox label={g.checkbox} defaultChecked />
          </Stack>
        </div>
      </Section>

      <Section eyebrow="DISPLAY" title={g.displayTitle}>
        <Stack gap={4}>
          <Cluster gap={3}>
            <Badge>NEW</Badge>
            <Badge tone="green">OK</Badge>
            <span>
              {g.shortcut} <Kbd>⌘</Kbd> <Kbd>K</Kbd>
            </span>
          </Cluster>
          <Callout>{g.callout}</Callout>
          <Card>
            <OutputList
              rows={[
                { label: g.key, value: g.value },
                { label: 'ISO 8601', value: '2026-10-09' },
              ]}
            />
          </Card>
          <Card>
            <List>
              <ListItem
                icon={<PixelIcon name="folder" />}
                title={g.listItem}
                description={g.listItemDescription}
                meta="›"
              />
              <ListItem
                icon={<PixelIcon name="envelope" />}
                title={g.anotherItem}
                description={g.anotherItemDescription}
                meta="12"
              />
            </List>
          </Card>
          <Window title="window.app">
            <p>{g.windowText}</p>
          </Window>
        </Stack>
      </Section>

      <Section eyebrow="ICONS" title={g.iconsTitle} description={g.iconsDescription}>
        <div className="icon-grid">
          {(Object.keys(ICONS) as IconName[]).map((name) => (
            <figure key={name}>
              <PixelIcon name={name} size={32} />
              <figcaption>{name}</figcaption>
            </figure>
          ))}
        </div>
      </Section>

      <Section eyebrow="QUIZ" title={g.quizTitle} description={g.quizDescription}>
        <Quiz
          title="DEMO"
          questions={g.quiz.map((q, i) => ({
            ...q,
            answer: QUIZ_ANSWERS[i] ?? 0,
            explain: q.explain || undefined,
          }))}
        />
      </Section>
    </PageWindow>
  );
}
