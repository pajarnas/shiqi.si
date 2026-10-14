// The B1/B2 (visitor) DS-160 question set: what to ask each family member, in
// the order the DS-160 pages ask it. Answers are stored the way they get typed
// into ceac.state.gov — English, names in pinyin, dates as YYYY-MM-DD — so the
// answer sheet can be copied field by field.

export type FieldType = 'text' | 'date' | 'choice' | 'yesno' | 'list';

/** Every answer is a string; `list` answers hold one item per line. */
export type Answers = Record<string, string>;

export interface Field {
  key: string;
  /** What the family member sees, in Chinese. */
  zh: string;
  /** The DS-160 wording, so the sheet lines up with the real form. */
  en: string;
  type: FieldType;
  /** Allowed values for `choice`. */
  options?: readonly string[];
  /** Guidance for the assistant: format, what counts as an answer, common mistakes. */
  hint?: string;
  optional?: boolean;
  /** Asked only when this returns true for the answers so far. */
  when?: (a: Answers) => boolean;
}

export interface Section {
  id: string;
  zh: string;
  en: string;
  /**
   * `case`: filled once by the organiser and shared by every applicant in the
   * family (the trip, the US contact). `applicant`: asked of each person.
   */
  scope: 'case' | 'applicant';
  fields: readonly Field[];
}

const yes = (key: string) => (a: Answers) => a[key] === 'yes';
const married = (a: Answers) =>
  ['MARRIED', 'COMMON LAW MARRIAGE', 'CIVIL UNION', 'SEPARATED'].includes(a.maritalStatus ?? '');
const employed = (a: Answers) =>
  !['RETIRED', 'NOT EMPLOYED', 'HOMEMAKER', 'STUDENT'].includes(a.occupation ?? '');

export const SECTIONS: readonly Section[] = [
  {
    id: 'trip',
    zh: '行程',
    en: 'Travel Information',
    scope: 'case',
    fields: [
      {
        key: 'purpose',
        zh: '来美目的',
        en: 'Purpose of Trip',
        type: 'choice',
        options: [
          'B1/B2 BUSINESS & TOURISM',
          'B2 TOURISM/MEDICAL TREATMENT',
          'B1 BUSINESS/CONFERENCE',
        ],
        hint: 'Visiting family is B2 TOURISM.',
      },
      { key: 'arrivalDate', zh: '预计到达日期', en: 'Intended Date of Arrival', type: 'date' },
      {
        key: 'stayLength',
        zh: '预计停留多久',
        en: 'Intended Length of Stay',
        type: 'text',
        hint: 'Number and unit, e.g. "3 MONTHS". B2 stays are normally up to 6 months.',
      },
      {
        key: 'usAddress',
        zh: '在美住址',
        en: 'Address Where You Will Stay in the U.S.',
        type: 'text',
        hint: 'Street, city, state, ZIP.',
      },
      {
        key: 'payer',
        zh: '谁付旅费',
        en: 'Person/Entity Paying for Your Trip',
        type: 'choice',
        options: ['SELF', 'OTHER PERSON', 'COMPANY/ORGANIZATION'],
      },
      {
        key: 'payerDetails',
        zh: '付款人姓名、关系、电话、地址',
        en: 'Payer Name, Relationship, Phone, Address',
        type: 'text',
        when: (a) => a.payer === 'OTHER PERSON',
      },
    ],
  },
  {
    id: 'usContact',
    zh: '在美联系人',
    en: 'U.S. Point of Contact Information',
    scope: 'case',
    fields: [
      {
        key: 'contactName',
        zh: '联系人姓名',
        en: 'Contact Person Surname, Given Names',
        type: 'text',
      },
      {
        key: 'contactRelation',
        zh: '和申请人的关系',
        en: 'Relationship to You',
        type: 'choice',
        options: [
          'RELATIVE',
          'SPOUSE',
          'FRIEND',
          'BUSINESS ASSOCIATE',
          'EMPLOYER',
          'SCHOOL OFFICIAL',
          'OTHER',
        ],
      },
      { key: 'contactAddress', zh: '联系人地址', en: 'U.S. Contact Address', type: 'text' },
      { key: 'contactPhone', zh: '联系人电话', en: 'Phone Number', type: 'text' },
      { key: 'contactEmail', zh: '联系人邮箱', en: 'Email Address', type: 'text' },
    ],
  },
  {
    id: 'personal',
    zh: '个人信息',
    en: 'Personal Information',
    scope: 'applicant',
    fields: [
      {
        key: 'surname',
        zh: '姓（拼音）',
        en: 'Surnames',
        type: 'text',
        hint: 'Uppercase pinyin exactly as in the passport, e.g. ZHANG.',
      },
      {
        key: 'givenNames',
        zh: '名（拼音）',
        en: 'Given Names',
        type: 'text',
        hint: 'Uppercase pinyin exactly as in the passport, e.g. XIAOMING.',
      },
      { key: 'nativeName', zh: '中文姓名', en: 'Full Name in Native Alphabet', type: 'text' },
      {
        key: 'otherNames',
        zh: '曾用名',
        en: 'Other Names Used',
        type: 'list',
        optional: true,
        hint: 'Former names, maiden names. Empty if none.',
      },
      {
        key: 'telecode',
        zh: '姓名电码',
        en: 'Telecode That Represents Your Name',
        type: 'text',
        optional: true,
        hint: 'Four-digit Chinese commercial code per character. The organiser can look it up; do not press the applicant for it.',
      },
      { key: 'sex', zh: '性别', en: 'Sex', type: 'choice', options: ['MALE', 'FEMALE'] },
      {
        key: 'maritalStatus',
        zh: '婚姻状况',
        en: 'Marital Status',
        type: 'choice',
        options: [
          'MARRIED',
          'COMMON LAW MARRIAGE',
          'CIVIL UNION',
          'SINGLE',
          'WIDOWED',
          'DIVORCED',
          'SEPARATED',
          'OTHER',
        ],
      },
      { key: 'birthDate', zh: '出生日期', en: 'Date of Birth', type: 'date' },
      {
        key: 'birthPlace',
        zh: '出生城市和省份',
        en: 'Place of Birth (City, State/Province)',
        type: 'text',
        hint: 'In pinyin, e.g. "CHENGDU, SICHUAN".',
      },
      {
        key: 'otherNationality',
        zh: '是否有其他国籍',
        en: 'Do you hold or have you held any nationality other than China?',
        type: 'yesno',
      },
      {
        key: 'otherNationalityDetails',
        zh: '其他国籍是哪国、护照号',
        en: 'Other Nationality Details',
        type: 'text',
        when: yes('otherNationality'),
      },
      {
        key: 'permanentResident',
        zh: '是否是其他国家的永久居民',
        en: 'Are you a permanent resident of a country other than your nationality?',
        type: 'yesno',
      },
      {
        key: 'nationalId',
        zh: '身份证号',
        en: 'National Identification Number',
        type: 'text',
        hint: '18 characters, the last may be X.',
      },
    ],
  },
  {
    id: 'address',
    zh: '地址和电话',
    en: 'Address and Phone Information',
    scope: 'applicant',
    fields: [
      {
        key: 'homeAddress',
        zh: '家庭住址',
        en: 'Home Address',
        type: 'text',
        hint: 'In English/pinyin: room, building, street, district, city, province, postal code.',
      },
      { key: 'phone', zh: '手机号', en: 'Primary Phone Number', type: 'text' },
      { key: 'email', zh: '邮箱', en: 'Email Address', type: 'text' },
      {
        key: 'socialMedia',
        zh: '过去 5 年用过的社交媒体和账号名',
        en: 'Social Media Provider/Platform and Identifier (last 5 years)',
        type: 'list',
        hint: 'One per line as "PLATFORM: handle", e.g. "WECHAT: zhang123", "SINA WEIBO: ...", "DOUYIN: ...". Write NONE if none.',
      },
    ],
  },
  {
    id: 'passport',
    zh: '护照',
    en: 'Passport Information',
    scope: 'applicant',
    fields: [
      {
        key: 'passportNumber',
        zh: '护照号',
        en: 'Passport/Travel Document Number',
        type: 'text',
        hint: 'Starts with E for current Chinese passports, e.g. E12345678.',
      },
      {
        key: 'passportIssuePlace',
        zh: '签发地',
        en: 'Where Was the Passport Issued (City, Province)',
        type: 'text',
      },
      { key: 'passportIssueDate', zh: '签发日期', en: 'Issuance Date', type: 'date' },
      {
        key: 'passportExpiryDate',
        zh: '有效期至',
        en: 'Expiration Date',
        type: 'date',
        hint: 'Must be valid for at least 6 months beyond the stay.',
      },
      {
        key: 'passportLost',
        zh: '有没有丢过护照',
        en: 'Have you ever lost a passport or had one stolen?',
        type: 'yesno',
      },
      {
        key: 'passportLostDetails',
        zh: '丢失的护照号、时间、经过',
        en: 'Lost Passport Details',
        type: 'text',
        when: yes('passportLost'),
      },
    ],
  },
  {
    id: 'companions',
    zh: '同行人',
    en: 'Travel Companions',
    scope: 'applicant',
    fields: [
      {
        key: 'companions',
        zh: '和谁一起来',
        en: 'Persons Traveling With You',
        type: 'list',
        optional: true,
        hint: 'Name in pinyin and relationship, one per line. Empty if traveling alone.',
      },
    ],
  },
  {
    id: 'previousTravel',
    zh: '以前去美国的记录',
    en: 'Previous U.S. Travel',
    scope: 'applicant',
    fields: [
      {
        key: 'beenToUs',
        zh: '以前去过美国吗',
        en: 'Have you ever been in the U.S.?',
        type: 'yesno',
      },
      {
        key: 'previousVisits',
        zh: '最近几次去美国的日期和停留天数',
        en: 'Previous Visits (Date Arrived, Length of Stay)',
        type: 'list',
        when: yes('beenToUs'),
        hint: 'Up to the last 5 visits, one per line: "YYYY-MM-DD, 30 DAYS".',
      },
      {
        key: 'hadVisa',
        zh: '以前拿过美国签证吗',
        en: 'Have you ever been issued a U.S. Visa?',
        type: 'yesno',
      },
      {
        key: 'lastVisaDetails',
        zh: '上次签证的签发日期和签证号',
        en: 'Last Visa Issue Date and Visa Number',
        type: 'text',
        when: yes('hadVisa'),
        hint: 'The red 8-digit number on the visa foil.',
      },
      {
        key: 'refused',
        zh: '有没有被拒签过，或在入境时被拒',
        en: 'Have you ever been refused a U.S. Visa, or been refused admission?',
        type: 'yesno',
      },
      {
        key: 'refusedDetails',
        zh: '什么时候、在哪、什么签证、原因',
        en: 'Refusal Explanation',
        type: 'text',
        when: yes('refused'),
      },
      {
        key: 'immigrantPetition',
        zh: '有没有人给你递交过移民申请',
        en: 'Has anyone ever filed an immigrant petition on your behalf?',
        type: 'yesno',
      },
    ],
  },
  {
    id: 'family',
    zh: '家庭',
    en: 'Family Information',
    scope: 'applicant',
    fields: [
      {
        key: 'fatherName',
        zh: '父亲姓名（拼音）和出生日期',
        en: "Father's Full Name and Date of Birth",
        type: 'text',
        hint: 'Write "UNKNOWN" for parts not known.',
      },
      { key: 'fatherInUs', zh: '父亲在美国吗', en: 'Is your father in the U.S.?', type: 'yesno' },
      {
        key: 'motherName',
        zh: '母亲姓名（拼音）和出生日期',
        en: "Mother's Full Name and Date of Birth",
        type: 'text',
      },
      { key: 'motherInUs', zh: '母亲在美国吗', en: 'Is your mother in the U.S.?', type: 'yesno' },
      {
        key: 'immediateRelativesInUs',
        zh: '配偶、子女、未婚夫妻、兄弟姐妹有在美国的吗',
        en: 'Immediate Relatives in the U.S. (Name, Relationship, Status)',
        type: 'list',
        hint: 'One per line: name, relationship, status (U.S. CITIZEN / LPR / NONIMMIGRANT, e.g. F-1 student / OTHER). Write NONE if none.',
      },
      {
        key: 'otherRelativesInUs',
        zh: '其他亲戚在美国吗',
        en: 'Do you have any other relatives in the U.S.?',
        type: 'yesno',
      },
      {
        key: 'spouseName',
        zh: '配偶姓名（拼音）',
        en: "Spouse's Full Name",
        type: 'text',
        when: married,
      },
      {
        key: 'spouseBirth',
        zh: '配偶出生日期、出生城市',
        en: "Spouse's Date and Place of Birth",
        type: 'text',
        when: married,
      },
      {
        key: 'spouseNationality',
        zh: '配偶国籍',
        en: "Spouse's Nationality",
        type: 'text',
        when: married,
      },
      {
        key: 'spouseAddress',
        zh: '配偶住址',
        en: "Spouse's Address",
        type: 'text',
        when: married,
        hint: '"SAME AS HOME ADDRESS" is fine when it is.',
      },
    ],
  },
  {
    id: 'work',
    zh: '工作和教育',
    en: 'Present/Previous Work/Education/Training',
    scope: 'applicant',
    fields: [
      {
        key: 'occupation',
        zh: '现在的职业',
        en: 'Primary Occupation',
        type: 'choice',
        options: [
          'AGRICULTURE',
          'ARTIST/PERFORMER',
          'BUSINESS',
          'COMMUNICATIONS',
          'COMPUTER SCIENCE',
          'CULINARY/FOOD SERVICES',
          'EDUCATION',
          'ENGINEERING',
          'GOVERNMENT',
          'HOMEMAKER',
          'LEGAL PROFESSION',
          'MEDICAL/HEALTH',
          'MILITARY',
          'NATURAL SCIENCE',
          'NOT EMPLOYED',
          'PHYSICAL SCIENCES',
          'RELIGIOUS VOCATION',
          'RESEARCH',
          'RETIRED',
          'SOCIAL SCIENCE',
          'STUDENT',
          'OTHER',
        ],
      },
      {
        key: 'employer',
        zh: '单位名称、地址、电话',
        en: 'Present Employer or School Name, Address, Phone',
        type: 'text',
        when: employed,
        hint: 'In English; the official English name if the company has one.',
      },
      { key: 'startDate', zh: '入职日期', en: 'Start Date', type: 'date', when: employed },
      {
        key: 'monthlyIncome',
        zh: '月收入（人民币）',
        en: 'Monthly Income in Local Currency',
        type: 'text',
        when: employed,
        hint: 'Digits only, in CNY.',
      },
      {
        key: 'duties',
        zh: '工作内容',
        en: 'Briefly Describe Your Duties',
        type: 'text',
        when: employed,
      },
      {
        key: 'previousWork',
        zh: '过去 5 年的其他工作',
        en: 'Previous Employers (last 5 years)',
        type: 'list',
        optional: true,
        hint: 'One per line: employer, address, title, from–to. Empty if none.',
      },
      {
        key: 'education',
        zh: '初中以上的学校',
        en: 'Educational Institutions Attended (secondary level and above)',
        type: 'list',
        hint: 'One per line: school, address, course of study, from–to.',
      },
    ],
  },
  {
    id: 'additional',
    zh: '其他',
    en: 'Additional Work/Education/Training Information',
    scope: 'applicant',
    fields: [
      {
        key: 'clan',
        zh: '属于某个宗族或部落吗',
        en: 'Do you belong to a clan or tribe?',
        type: 'yesno',
      },
      {
        key: 'languages',
        zh: '会说的语言',
        en: 'Languages You Speak',
        type: 'list',
        hint: 'e.g. CHINESE MANDARIN, CHINESE CANTONESE, ENGLISH.',
      },
      {
        key: 'countriesVisited',
        zh: '过去 5 年去过的国家',
        en: 'Countries Visited in the Last Five Years',
        type: 'list',
        optional: true,
      },
      {
        key: 'organizations',
        zh: '参加过的专业、社会或慈善组织',
        en: 'Professional, Social, or Charitable Organizations',
        type: 'list',
        optional: true,
      },
      {
        key: 'military',
        zh: '服过兵役吗',
        en: 'Have you ever served in the military?',
        type: 'yesno',
      },
      {
        key: 'militaryDetails',
        zh: '军种、军衔、专业、起止时间',
        en: 'Military Service Details',
        type: 'text',
        when: yes('military'),
      },
    ],
  },
  {
    id: 'security',
    zh: '安全和背景问题',
    en: 'Security and Background',
    scope: 'applicant',
    fields: [
      {
        key: 'securityAllNo',
        zh: '官方背景问题（传染病、犯罪记录、毒品、违反移民法等）是否全部为“否”',
        en: 'Security and Background Parts 1–5: are all answers No?',
        type: 'yesno',
        hint: 'Read the question to the applicant plainly. Never answer for them and never suggest an answer. If anything is "yes", say the organiser will go through it with them.',
      },
      {
        key: 'securityNotes',
        zh: '需要说明的情况',
        en: 'Explanation for any Yes answer',
        type: 'text',
        when: (a) => a.securityAllNo === 'no',
      },
    ],
  },
];

export const ALL_FIELDS: readonly (Field & { section: Section })[] = SECTIONS.flatMap((s) =>
  s.fields.map((f) => ({ ...f, section: s })),
);

const BY_KEY = new Map(ALL_FIELDS.map((f) => [f.key, f]));

export function fieldByKey(key: string) {
  return BY_KEY.get(key);
}

/** Fields that apply to someone with these answers (conditional ones dropped). */
export function activeFields(answers: Answers, scope?: Section['scope']) {
  return ALL_FIELDS.filter(
    (f) => (!scope || f.section.scope === scope) && (!f.when || f.when(answers)),
  );
}

/** Applicant fields still needed, in asking order. */
export function missingFields(answers: Answers) {
  return activeFields(answers, 'applicant').filter((f) => !f.optional && !answers[f.key]?.trim());
}

export function progress(answers: Answers): { done: number; total: number } {
  const needed = activeFields(answers, 'applicant').filter((f) => !f.optional);
  return { done: needed.filter((f) => answers[f.key]?.trim()).length, total: needed.length };
}
