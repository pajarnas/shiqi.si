// What the family needs to know besides the form itself: steps, documents,
// fees, current rules and official links, in Chinese and English. The chat
// assistant reads the same text, so the page and the assistant agree.
// Rules change; every entry here was checked against the sources in LINKS on
// the date below, and the page tells readers to confirm on the official sites.
import type { VisaType } from './schema';

export interface Bilingual {
  zh: string;
  en: string;
}

export const CHECKED_ON = '2026-10-14';

export interface Step extends Bilingual {
  title: Bilingual;
}

export const STEPS: Record<VisaType, readonly Step[]> = {
  'B1/B2': [
    {
      title: { zh: '在这里收集资料', en: 'Collect the answers here' },
      zh: '每个人在聊天里把 DS-160 要问的问题答完，全家共用的行程和在美联系人由负责人填一次。',
      en: 'Each person answers the DS-160 questions in the chat; the organiser fills in the shared trip and U.S. contact once.',
    },
    {
      title: { zh: '在官网填 DS-160', en: 'Fill in the DS-160 online' },
      zh: '在 ceac.state.gov 选择面签城市，照答案单逐页填，上传照片，申请人本人确认后电子签名提交，打印带条形码的确认页。',
      en: 'On ceac.state.gov choose the interview post, copy the answer sheet page by page, upload the photo, have the applicant sign electronically and print the barcode confirmation page.',
    },
    {
      title: { zh: '交签证费、约面谈', en: 'Pay the fee and book the interview' },
      zh: '在美国驻华使领馆指定的预约网站建账户、交 MRV 签证费、选面谈时间。每个人（包括孩子）都要单独预约。',
      en: 'On the appointment site the U.S. Mission in China uses, create an account, pay the MRV fee and book a slot. Every person, children included, needs their own appointment.',
    },
    {
      title: { zh: '去使领馆面谈', en: 'Attend the interview' },
      zh: '带护照、确认页、预约单和支持材料，按十指指纹，回答签证官的问题。现在首次申请基本都要面谈，14 岁以下的孩子和 79 岁以上的老人也要去。',
      en: 'Bring the passport, confirmation page, appointment letter and supporting documents; give fingerprints and answer the officer. First-time applicants, including children under 14 and adults over 79, now generally must appear in person.',
    },
    {
      title: { zh: '拿护照、登记 EVUS', en: 'Collect the passport and enrol in EVUS' },
      zh: '通过后护照会寄到或送到指定地点。拿到 10 年 B1/B2 签证后，每次出发前要确认 EVUS 登记有效（一般 2 年一次）。',
      en: 'After approval the passport is delivered or picked up. With a 10-year B1/B2 visa on a PRC passport, make sure the EVUS enrolment is valid before each trip (usually renewed every 2 years).',
    },
  ],
  'H-1B': [
    {
      title: { zh: '准备材料、填 DS-160', en: 'Prepare documents and fill in the DS-160' },
      zh: '用最新的 I-797 批准通知、雇主信息和以往的签证记录回答问题，在 ceac.state.gov 提交 DS-160。',
      en: 'Answer with the latest I-797 approval notice, employer details and past visa records, then submit the DS-160 on ceac.state.gov.',
    },
    {
      title: { zh: '把社交媒体设成公开', en: 'Set social media to public' },
      zh: '从 2025 年 12 月 15 日起，H-1B 和 H-4 申请人要把 DS-160 里列出的社交媒体账号设成公开，方便签证官做网上审查。',
      en: 'Since 15 December 2025, H-1B and H-4 applicants must set the social media accounts listed on the DS-160 to public for the online presence review.',
    },
    {
      title: { zh: '在中国约面谈', en: 'Book the interview in China' },
      zh: '要在国籍国或常住国申请，所以在中国使领馆约。H-1B 续签的免面谈（“代递”）已基本取消，需要本人去面谈。H-1B 面谈名额紧，尽早约。',
      en: 'Applications must be made in the country of nationality or residence, so book in China. The interview waiver ("dropbox") for H-1B renewals has largely ended; plan for an in-person interview and book early, as H-1B slots are tight.',
    },
    {
      title: { zh: '面谈、等护照', en: 'Interview and wait for the passport' },
      zh: '带齐雇主材料去面谈。可能被要求补材料或行政审查（221(g)），回美国的机票最好留出余地。',
      en: 'Bring the employer documents. Some cases get a 221(g) request or administrative processing, so leave slack before the return flight.',
    },
  ],
};

export interface Doc extends Bilingual {
  /** Needed by everyone on this visa; otherwise it helps but is optional. */
  required: boolean;
}

export const DOCUMENTS: Record<VisaType, readonly Doc[]> = {
  'B1/B2': [
    {
      required: true,
      zh: '护照：有效期比离开美国的日期至少多 6 个月，带上所有旧护照',
      en: 'Passport valid at least 6 months beyond the stay, plus all old passports',
    },
    {
      required: true,
      zh: 'DS-160 确认页（带条形码）',
      en: 'DS-160 confirmation page with barcode',
    },
    {
      required: true,
      zh: '面谈预约确认单、签证费收据',
      en: 'Appointment confirmation and fee receipt',
    },
    {
      required: true,
      zh: '近 6 个月的白底彩色照片，51×51 毫米，不戴眼镜',
      en: 'Colour photo on white, taken in the last 6 months, 2×2 in (51×51 mm), no glasses',
    },
    {
      required: false,
      zh: '在美亲属的邀请信，写明关系、行程和谁负担费用',
      en: 'Invitation letter from the U.S. relative: relationship, plans and who pays',
    },
    {
      required: false,
      zh: '在美亲属的身份证明：H-1B 批准通知 I-797、工作证明、工资单',
      en: "U.S. relative's status: H-1B I-797, employment letter, pay stubs",
    },
    {
      required: false,
      zh: '亲属关系证明：户口本、出生证明（公证件或原件）',
      en: 'Proof of relationship: household register (hukou), birth certificates',
    },
    {
      required: false,
      zh: '在国内的工作证明或退休证，写明职位、收入、准假',
      en: 'Employment letter with position, salary and approved leave, or retirement certificate',
    },
    {
      required: false,
      zh: '资产证明：银行流水或存款证明、房产证',
      en: 'Funds and ties: bank statements or deposit certificate, property certificate',
    },
    {
      required: false,
      zh: '孩子：出生证明、在读证明；父母一方不同去时带另一方的同意书',
      en: 'Children: birth certificate, school enrolment letter, consent of a parent not attending',
    },
    {
      required: false,
      zh: '以前去过美国的：旧签证和出入境记录',
      en: 'Previous U.S. visits: old visas and travel records',
    },
  ],
  'H-1B': [
    {
      required: true,
      zh: '护照（有效期 6 个月以上）和所有旧护照',
      en: 'Passport valid 6+ months and all old passports',
    },
    {
      required: true,
      zh: 'DS-160 确认页、面谈预约单、签证费收据',
      en: 'DS-160 confirmation, appointment confirmation and fee receipt',
    },
    {
      required: true,
      zh: '最新的 I-797A/I-797B 批准通知原件',
      en: 'Original latest I-797A/I-797B approval notice',
    },
    {
      required: true,
      zh: '雇主开的在职证明：职位、薪水、入职日期、工作内容',
      en: 'Employment verification letter: title, salary, start date, duties',
    },
    { required: true, zh: '近 2–3 个月的工资单', en: 'Pay stubs from the last 2–3 months' },
    { required: true, zh: '白底照片 51×51 毫米', en: 'Photo 2×2 in (51×51 mm) on white' },
    { required: false, zh: '近几年的 W-2 或报税表', en: 'Recent W-2s or tax returns' },
    {
      required: false,
      zh: 'H-1B 申请材料副本（I-129、LCA），学历和学位证书',
      en: 'Copy of the petition (I-129, LCA), degree certificates',
    },
    {
      required: false,
      zh: '简历、公司介绍；在客户现场工作的要带客户信',
      en: 'Résumé, company profile; client letter if placed at a client site',
    },
    { required: false, zh: '旧签证和 I-94 记录', en: 'Previous visas and I-94 records' },
  ],
};

export interface Fee extends Bilingual {
  label: Bilingual;
}

export const FEES: readonly Fee[] = [
  {
    label: { zh: 'B1/B2 签证费（MRV）', en: 'B1/B2 application fee (MRV)' },
    zh: '185 美元/人，交了不退',
    en: 'USD 185 per person, non-refundable',
  },
  {
    label: { zh: 'H-1B 签证费（MRV）', en: 'H-1B application fee (MRV)' },
    zh: '205 美元',
    en: 'USD 205',
  },
  {
    label: { zh: '签证诚信费（Visa Integrity Fee）', en: 'Visa integrity fee' },
    zh: '法律规定 250 美元起，签证批下来时才收；各使领馆开始收的时间不一样，以预约网站显示为准',
    en: 'From USD 250 by law, charged only when the visa is issued; posts are starting at different times, so check the appointment site',
  },
  {
    label: { zh: 'EVUS 登记费', en: 'EVUS enrolment' },
    zh: '30.75 美元（2026 年 1 月 1 日起），一般 2 年登记一次',
    en: 'USD 30.75 since 1 January 2026, usually every 2 years',
  },
];

export const TIPS: readonly Bilingual[] = [
  {
    zh: 'DS-160 上的每一项都要和护照、真实情况一致；填错了可以重新填一份，面谈时用新的确认页。',
    en: 'Everything on the DS-160 must match the passport and the facts; if something is wrong, file a new one and bring the new confirmation page.',
  },
  {
    zh: '探亲签证（B2）看的是“会按时回国”：工作、退休金、房产、家人在国内，都是有力的证明。',
    en: 'A B2 officer looks for strong reasons to return: a job or pension, property and family at home.',
  },
  {
    zh: '每次入境的停留期限看 I-94（入境后在 i94.cbp.dhs.gov 查），通常最长 6 个月，不是看签证有效期。',
    en: 'How long each visit may last is set by the I-94 (look it up at i94.cbp.dhs.gov after entry), usually up to 6 months; the visa dates do not decide it.',
  },
  {
    zh: 'B1/B2 签证在过期后 12 个月内续签、上次是 10 年签证且当时已满 18 岁，可能可以免面谈；第一次申请都要面谈。',
    en: 'Renewing a full-validity B1/B2 within 12 months of expiry, issued at 18 or older, may qualify for an interview waiver; first-time applicants interview.',
  },
  {
    zh: '面谈被要求补材料（221(g) 白条/蓝条）不是拒签，按要求补交就行。',
    en: 'A 221(g) request for more documents is not a refusal; send what is asked for.',
  },
  {
    zh: '一家人可以一起约同一时间面谈，签证官通常会一起问。',
    en: 'A family can book the same slot and is usually interviewed together.',
  },
];

export interface UsefulLink {
  url: string;
  title: Bilingual;
  note: Bilingual;
}

export const LINKS: readonly UsefulLink[] = [
  {
    url: 'https://ceac.state.gov/genniv/',
    title: { zh: 'DS-160 填表网站', en: 'DS-160 online form' },
    note: {
      zh: '官方填表，20 分钟不动会超时，记好 Application ID',
      en: 'Official form; times out after 20 idle minutes, note the Application ID',
    },
  },
  {
    url: 'https://china.usembassy-china.org.cn/visas/',
    title: { zh: '美国驻华使领馆签证页', en: 'U.S. Mission China visas' },
    note: {
      zh: '预约、交费、领取护照的官方入口',
      en: 'Official entry point for booking, fees and passport pickup',
    },
  },
  {
    url: 'https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/global-visa-wait-times.html',
    title: { zh: '各地面谈等待时间', en: 'Visa appointment wait times' },
    note: {
      zh: '查北京、上海、广州、沈阳等地要等多久',
      en: 'Check waits for Beijing, Shanghai, Guangzhou, Shenyang and others',
    },
  },
  {
    url: 'https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/fees/fees-visa-services.html',
    title: { zh: '官方签证费标准', en: 'Official visa fees' },
    note: { zh: '费用以这里为准', en: 'The authoritative fee list' },
  },
  {
    url: 'https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos.html',
    title: { zh: '签证照片要求', en: 'Visa photo requirements' },
    note: { zh: '尺寸、背景、能不能戴眼镜', en: 'Size, background, glasses' },
  },
  {
    url: 'https://www.evus.gov/',
    title: { zh: 'EVUS 登记', en: 'EVUS enrolment' },
    note: {
      zh: '持 10 年 B 签的中国护照出发前登记',
      en: 'Required before travel for PRC passports with 10-year B visas',
    },
  },
  {
    url: 'https://i94.cbp.dhs.gov/',
    title: { zh: 'I-94 查询', en: 'I-94 lookup' },
    note: { zh: '入境后查可以停留到哪天', en: 'After entry, see how long you may stay' },
  },
  {
    url: 'https://ceac.state.gov/CEACStatTracker/Status.aspx',
    title: { zh: '签证状态查询', en: 'Visa status check' },
    note: {
      zh: '面谈后查是否签发、是否在审查',
      en: 'After the interview, see if the visa is issued or in processing',
    },
  },
  {
    url: 'https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html',
    title: { zh: '旅游探亲签证说明', en: 'Visitor visa guide' },
    note: { zh: '官方的 B1/B2 介绍', en: 'Official B1/B2 overview' },
  },
  {
    url: 'https://travel.state.gov/content/travel/en/us-visas/employment/temporary-worker-visas.html',
    title: { zh: 'H-1B 等工作签证说明', en: 'Temporary worker visas' },
    note: { zh: '官方的 H 类签证介绍', en: 'Official guide to H visas' },
  },
];

/** A plain-text digest of all of the above, for the chat assistant's system prompt. */
export function knowledgeDigest(): string {
  const steps = (v: VisaType) =>
    STEPS[v].map((s, i) => `${i + 1}. ${s.title.en}: ${s.en}`).join('\n');
  const docs = (v: VisaType) =>
    DOCUMENTS[v].map((d) => `- ${d.required ? '[required] ' : ''}${d.en}`).join('\n');
  return [
    `# Visa knowledge (checked ${CHECKED_ON}; tell the family to confirm on official sites)`,
    '## B1/B2 steps',
    steps('B1/B2'),
    '## H-1B renewal steps',
    steps('H-1B'),
    '## B1/B2 documents',
    docs('B1/B2'),
    '## H-1B documents',
    docs('H-1B'),
    '## Fees',
    FEES.map((f) => `- ${f.label.en}: ${f.en}`).join('\n'),
    '## Tips',
    TIPS.map((t) => `- ${t.en}`).join('\n'),
    '## Official links',
    LINKS.map((l) => `- ${l.title.en}: ${l.url}`).join('\n'),
  ].join('\n\n');
}
