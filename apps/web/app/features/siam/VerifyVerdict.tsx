// "Verify a verdict": a sample verdict from the Siam server, checked in the browser the way the app's
// verify page does it. Edit the sentence and the fingerprint, signature and Bitcoin proof stop matching.
import { Button, Card, Cluster, Field, Stack, TextArea } from '@shiqi/ui';
import { useState } from 'react';
import { format, useI18n } from '~/i18n';
import { JUDGE_IDS, type JudgeId } from './court';
import { antiForgeryCode, canonicalJSON, sha256Hex, verifySignature } from './fingerprint';
import { DEMO_PUBLIC_KEY, SAMPLE_ANCHORS, SAMPLES } from './verify-sample';

type Check = {
  ok: boolean | null;
  text: string;
  links?: { href: string; label: string; download?: string }[];
};

/** Where the page mentions on-chain notarization at all. */
const ON_CHAIN = { en: true, zh: false } as const;

const isJudge = (id: string): id is JudgeId => (JUDGE_IDS as readonly string[]).includes(id);

export function VerifyVerdict() {
  const { t, locale } = useI18n();
  const s = t.siam;
  const v = s.verify;
  const lang = locale === 'zh' ? 'zh' : 'en';
  const sample = SAMPLES[lang];
  const anchor = SAMPLE_ANCHORS[lang];
  const doc = sample.document;
  const [sentence, setSentence] = useState(doc.sentence);
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const hash = await sha256Hex(canonicalJSON({ ...doc, sentence }));
      const intact = hash === sample.hash;
      const sig = await verifySignature(DEMO_PUBLIC_KEY, hash, sample.signature);
      const out: Check[] = [
        intact
          ? { ok: true, text: format(v.hashOk, { code: sample.code }) }
          : {
              ok: false,
              text: format(v.hashBad, { got: antiForgeryCode(hash), code: sample.code }),
            },
        sig === null
          ? { ok: null, text: v.sigUnsupported }
          : { ok: sig, text: sig ? v.sigOk : v.sigBad },
      ];
      // On-chain notarization is overseas only; the Chinese page shows the fingerprint and signature.
      if (ON_CHAIN[lang]) {
        out.push(
          !anchor
            ? { ok: null, text: v.anchorSoon }
            : intact
              ? {
                  ok: true,
                  text: format(v.anchorOk, { height: anchor.blockHeight }),
                  links: [
                    { href: `https://mempool.space/block/${anchor.blockHeight}`, label: v.block },
                    { href: anchor.ots, label: v.proof, download: `siam-${sample.code}.ots` },
                  ],
                }
              : { ok: false, text: v.anchorBad },
        );
      }
      setChecks(out);
    } finally {
      setBusy(false);
    }
  };

  const edited = sentence !== doc.sentence;

  return (
    <Card padded className="siam-verify">
      <Stack gap={4}>
        <div className="siam-verify__paper">
          <p className="siam-verify__eyebrow">
            {v.sample} · {format(v.caseNo, { code: doc.caseCode })}
          </p>
          <h3>{doc.title}</h3>
          <p>{doc.headline}</p>
          <p className="siam-verify__meta">
            {format(v.judge, {
              judge: isJudge(doc.judgeId) ? s.judges.items[doc.judgeId].name : '',
            })}
          </p>
          <Field label={v.sentence}>
            {(p) => (
              <TextArea
                {...p}
                rows={2}
                value={sentence}
                onChange={(e) => {
                  setSentence(e.target.value);
                  setChecks(null);
                }}
              />
            )}
          </Field>
          <p className="siam-verify__code">
            {v.code} <code>{sample.code}</code>
          </p>
        </div>
        <Cluster gap={2}>
          <Button onClick={() => void run()} disabled={busy}>
            {busy ? v.checking : v.check}
          </Button>
          {edited && (
            <Button
              variant="ghost"
              onClick={() => {
                setSentence(doc.sentence);
                setChecks(null);
              }}
            >
              {v.reset}
            </Button>
          )}
        </Cluster>
        {checks && (
          <ol className="siam-verify__checks" aria-live="polite">
            {checks.map((c) => (
              <li key={c.text} data-ok={c.ok === null ? 'na' : String(c.ok)}>
                <span aria-hidden="true">{c.ok === null ? '·' : c.ok ? '✓' : '✗'}</span>
                <span>
                  {c.text}
                  {c.links?.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      download={l.download}
                      rel="noreferrer"
                      target={l.download ? undefined : '_blank'}
                    >
                      {l.label}
                    </a>
                  ))}
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="siam-verify__note">
          {v.demoKey} {v.legal}
        </p>
      </Stack>
    </Card>
  );
}
