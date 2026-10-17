// Sample verdicts for the "Verify a verdict" widget, sealed by siam-server's own fingerprint.js
// (canonical JSON -> SHA-256 -> Ed25519 over the hex hash) with a throwaway demo key, not the court key.
// Regenerate with the server code, never by hand: the hash and signature must match the document.

export interface SampleVerdict {
  document: {
    court: string;
    caseCode: string;
    title: string;
    kind: string;
    plaintiff: string;
    defendant: string;
    instance: number;
    judgeId: string;
    winner: string;
    respA: number;
    headline: string;
    findings: string[];
    reasoning: string;
    sentence: string;
    appealResult: string | null;
    issuedAt: number;
    format: number;
  };
  hash: string;
  signature: string;
  code: string;
}

/** The demo key that signed the samples (SPKI PEM). */
export const DEMO_PUBLIC_KEY =
  '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA2ON0Sml2BFL+6catHEnm8Y7sC1lfBvuIjj4d4MTpilc=\n-----END PUBLIC KEY-----\n';

export const SAMPLES: { en: SampleVerdict; zh: SampleVerdict } = {
  en: {
    document: {
      court: '情侣法庭',
      caseCode: '730120',
      title: 'Whose turn was the dishes',
      kind: 'dispute',
      plaintiff: 'Ann',
      defendant: 'Bo',
      instance: 1,
      judgeId: 'tortoise',
      winner: 'A',
      respA: 30,
      headline: 'An agreement about the dishes, and a pan still in the sink.',
      findings: [
        'Both sides agreed in March to take turns, one night each.',
        "Wednesday was the defendant's night; the pan was not washed.",
      ],
      reasoning:
        'Slowly, slowly. An agreement is an agreement. The plaintiff kept their nights and showed the chat; the defendant offered a feeling, not a fact.',
      sentence: 'The defendant washes the dishes for one week.',
      appealResult: null,
      issuedAt: 1792267200000,
      format: 2,
    },
    hash: '56835ea38d378a9380919876bd9ff42e54b43ac7682ade5b68479e746607305d',
    signature:
      'fdnKEE3lLi94uaI9dsWVKrG4nn59meDWt455jO9n7lPTTJK4ldPVKsFBgd+nbKi6tEF+435Y9G+LDqSfBDiuCA==',
    code: '5683-5EA3-8D37-8A93',
  },
  zh: {
    document: {
      court: '情侣法庭',
      caseCode: '730120',
      title: '洗碗该轮到谁',
      kind: 'dispute',
      plaintiff: '安安',
      defendant: '波波',
      instance: 1,
      judgeId: 'tortoise',
      winner: 'A',
      respA: 30,
      headline: '说好轮流洗碗，周三的锅还在水池里。',
      findings: ['双方三月约定轮流洗碗，一人一晚。', '周三轮到被告，锅没有洗。'],
      reasoning:
        '慢慢来，说好的事就得算数。原告守了自己的那两晚，还拿出了聊天记录；被告说的是感受，不是事实。',
      sentence: '被告洗一周碗。',
      appealResult: null,
      issuedAt: 1792267200000,
      format: 2,
    },
    hash: '00fa763bbaacaf98365a5c9d09146195161c16096bb729dd7859941346192491',
    signature:
      'm6FPvm1BXAExbl/Pt+bwkuYax6VAAJ+Ozuc3oxD+xY7V54Z39DLJGwO1OwKBHA5Oyn0niit/mEITVjqVtRjfCQ==',
    code: '00FA-763B-BAAC-AF98',
  },
};

/**
 * Bitcoin proofs for the sample hashes, from siam-server's anchor.js against the public OpenTimestamps
 * calendars. Null until a real proof has confirmed: the page never shows a block it cannot back up.
 */
export const SAMPLE_ANCHORS: Record<
  'en' | 'zh',
  { blockHeight: number; merkleRoot: string; ots: string } | null
> = {
  en: null,
  zh: null,
};
