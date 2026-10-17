import type { IconName } from '@shiqi/pixel';
import { Badge, Callout, Card, Field, Grid, PixelIcon, Section, Select, Stack } from '@shiqi/ui';
import { useState } from 'react';
import { PageWindow, pageMeta } from '~/components/PageWindow';
import { JUDGE_IDS } from '~/features/siam/court';
import { Courtroom, EMPTY_DRAFT, type Draft } from '~/features/siam/Courtroom';
import { useI18n, type Strings } from '~/i18n';
import type { Route } from './+types/siam';

export const meta: Route.MetaFunction = ({ matches }) => pageMeta(matches, (t) => t.siam);

/** One icon per feature card, in the order of strings.siam.features.items. */
const FEATURE_ICONS: readonly IconName[] = [
  'gavel',
  'picture',
  'note',
  'swap',
  'magnifier',
  'star',
];

const MEDALS = [
  { id: 'first_win', icon: 'star' },
  { id: 'win_10', icon: 'bolt' },
  { id: 'comeback', icon: 'swap' },
  { id: 'draw', icon: 'heart' },
  { id: 'accepted', icon: 'flower' },
  { id: 'evidence', icon: 'magnifier' },
  { id: 'hearing', icon: 'note' },
  { id: 'cases_10', icon: 'folder' },
] as const satisfies readonly {
  id: keyof Strings['siam']['medals']['items'];
  icon: IconName;
}[];

/** App screenshots from local simulator runs, served from public/siam/. Empty until the first run. */
const SCREENSHOTS: readonly { src: string; alt: string }[] = [];

type Scene = Strings['siam']['scenes']['items'][number];

const draftOf = (scene: Scene): Draft => ({
  title: scene.title,
  a: scene.a.statement,
  aEvidence: scene.a.evidence.join('\n'),
  b: scene.b.statement,
  bEvidence: scene.b.evidence.join('\n'),
});

export default function Siam() {
  const { t } = useI18n();
  const s = t.siam;
  const [sceneId, setSceneId] = useState<string | null>(s.scenes.items[0]?.id ?? null);
  const scene = s.scenes.items.find((x) => x.id === sceneId);
  const [draft, setDraft] = useState<Draft>(scene ? draftOf(scene) : EMPTY_DRAFT);

  const pick = (id: string | null) => {
    const next = s.scenes.items.find((x) => x.id === id);
    setSceneId(next ? next.id : null);
    setDraft(next ? draftOf(next) : EMPTY_DRAFT);
    document.getElementById('court')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="desk-wide">
      <PageWindow page="siam" title={s.title} lede={s.lede}>
        <p className="siam-status">
          <Badge>{s.status.label}</Badge> {s.status.text}
        </p>

        <Section eyebrow="CASES" title={s.scenes.title} description={s.scenes.lede}>
          <Grid min="15rem" gap={4}>
            {s.scenes.items.map((x) => (
              <Card
                key={x.id}
                as="button"
                type="button"
                interactive
                padded
                className="siam-scene"
                aria-pressed={x.id === sceneId}
                onClick={() => pick(x.id)}
              >
                <strong>{x.title}</strong>
                <span>{x.blurb}</span>
                <span className="siam-scene__try">{s.scenes.try} →</span>
              </Card>
            ))}
          </Grid>
        </Section>

        <Section id="court" eyebrow="COURTROOM" title={s.demo.title} description={s.demo.lede}>
          <Stack gap={4}>
            <Field label={s.demo.scene} className="siam-scene-pick">
              {(p) => (
                <Select {...p} value={sceneId ?? ''} onChange={(e) => pick(e.target.value || null)}>
                  {s.scenes.items.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title}
                    </option>
                  ))}
                  <option value="">{s.demo.own}</option>
                </Select>
              )}
            </Field>
            <Courtroom
              key={sceneId ?? 'own'}
              draft={draft}
              onDraftChange={setDraft}
              makeup={scene?.makeup}
            />
          </Stack>
        </Section>

        <Section eyebrow="BENCH" title={s.judges.title} description={s.judges.lede}>
          <Grid min="14rem" gap={4}>
            {JUDGE_IDS.map((id) => {
              const j = s.judges.items[id];
              return (
                <Card key={id} padded className="siam-judge">
                  <PixelIcon name={id} size={48} />
                  <strong>{j.name}</strong>
                  <span className="siam-judge__role">{j.role}</span>
                  <q>{j.catchphrase}</q>
                  <span>{j.bio}</span>
                </Card>
              );
            })}
          </Grid>
        </Section>

        <Section eyebrow="FEATURES" title={s.features.title}>
          <Grid min="15rem" gap={4}>
            {s.features.items.map((f, i) => (
              <Card key={f.title} padded className="siam-feature">
                <PixelIcon name={FEATURE_ICONS[i] ?? 'star'} size={32} />
                <strong>{f.title}</strong>
                <span>{f.text}</span>
              </Card>
            ))}
          </Grid>
        </Section>

        <Section eyebrow="HOW" title={s.steps.title}>
          <ol className="siam-steps">
            {s.steps.items.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </Section>

        <Section eyebrow="MEDALS" title={s.medals.title} description={s.medals.lede}>
          <Grid min="10rem" gap={4}>
            {MEDALS.map((m) => (
              <div key={m.id} className="siam-medal">
                <span className="siam-medal__disc">
                  <PixelIcon name={m.icon} size={32} />
                </span>
                <strong>{s.medals.items[m.id].name}</strong>
                <span>{s.medals.items[m.id].text}</span>
              </div>
            ))}
          </Grid>
        </Section>

        <Section eyebrow="SCREENSHOTS" title={s.shots.title} description={s.shots.lede}>
          {SCREENSHOTS.length ? (
            <div className="siam-shots">
              {SCREENSHOTS.map((shot) => (
                <img key={shot.src} src={shot.src} alt={shot.alt} loading="lazy" />
              ))}
            </div>
          ) : (
            <Callout>{s.shots.empty}</Callout>
          )}
        </Section>
      </PageWindow>
    </div>
  );
}
