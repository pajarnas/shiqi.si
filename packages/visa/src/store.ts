// MySQL storage for visa cases. Everything personal is sealed (see crypto.ts)
// before it is written; only ids, status and timestamps are plain columns.
import type { Anthropic } from '@anthropic-ai/sdk';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { Sealer } from './crypto';
import type { Answers, VisaType } from './schema';

/**
 * Schema changes, applied in order and recorded in their own visa_schema_migrations
 * table, so the tables can move with this package to a separate service. Never
 * edit one that shipped; add a new one.
 */
export const VISA_MIGRATIONS: readonly string[] = [
  `CREATE TABLE visa_cases (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    label_sealed TEXT NOT NULL,
    answers_sealed MEDIUMTEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE visa_applicants (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    case_id INT UNSIGNED NOT NULL,
    profile_sealed TEXT NOT NULL,
    answers_sealed MEDIUMTEXT NOT NULL,
    answers_zh_sealed MEDIUMTEXT NOT NULL,
    messages_sealed MEDIUMTEXT NOT NULL,
    status ENUM('collecting', 'review', 'confirmed') NOT NULL DEFAULT 'collecting',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY visa_applicants_case (case_id),
    CONSTRAINT visa_applicants_case_fk FOREIGN KEY (case_id) REFERENCES visa_cases (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

/** Brings the visa tables up to date; safe to call on every start. */
export async function migrateVisa(db: Pool): Promise<void> {
  await db.query(
    `CREATE TABLE IF NOT EXISTS visa_schema_migrations (
      version INT UNSIGNED PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,
  );
  const [rows] = await db.query<RowDataPacket[]>('SELECT version FROM visa_schema_migrations');
  const done = new Set(rows.map((r) => r.version as number));
  for (const [i, sql] of VISA_MIGRATIONS.entries()) {
    const version = i + 1;
    if (done.has(version)) continue;
    await db.query(sql);
    await db.query('INSERT INTO visa_schema_migrations (version) VALUES (?)', [version]);
    console.log(`[visa] applied migration ${version}`);
  }
}

export type ApplicantStatus = 'collecting' | 'review' | 'confirmed';

export interface Profile {
  /** Their name as the family writes it, e.g. 张三. */
  name: string;
  /** Relationship to the organiser, e.g. 母亲. */
  relation: string;
  visa: VisaType;
}

export interface Applicant {
  id: number;
  caseId: number;
  profile: Profile;
  answers: Answers;
  /** The same answers as the family gave them in Chinese, where that differs from the English. */
  answersZh: Answers;
  /** The whole conversation with the assistant, tool calls included, as sent to the API. */
  messages: Anthropic.Beta.BetaMessageParam[];
  status: ApplicantStatus;
  updatedAt: Date;
}

export interface VisaCase {
  id: number;
  label: string;
  /** Shared answers (the trip, the U.S. contact) that every applicant inherits. */
  answers: Answers;
  createdAt: Date;
}

interface CaseRow extends RowDataPacket {
  id: number;
  label_sealed: string;
  answers_sealed: string;
  created_at: Date;
}

interface ApplicantRow extends RowDataPacket {
  id: number;
  case_id: number;
  profile_sealed: string;
  answers_sealed: string;
  answers_zh_sealed: string;
  messages_sealed: string;
  status: ApplicantStatus;
  updated_at: Date;
}

export class VisaStore {
  constructor(
    private readonly db: Pool,
    private readonly sealer: Sealer,
  ) {}

  private toCase(r: CaseRow): VisaCase {
    return {
      id: r.id,
      label: this.sealer.open<string>(r.label_sealed),
      answers: this.sealer.open<Answers>(r.answers_sealed),
      createdAt: r.created_at,
    };
  }

  private toApplicant(r: ApplicantRow): Applicant {
    return {
      id: r.id,
      caseId: r.case_id,
      profile: this.sealer.open<Profile>(r.profile_sealed),
      answers: this.sealer.open<Answers>(r.answers_sealed),
      answersZh: this.sealer.open<Answers>(r.answers_zh_sealed),
      messages: this.sealer.open<Anthropic.Beta.BetaMessageParam[]>(r.messages_sealed),
      status: r.status,
      updatedAt: r.updated_at,
    };
  }

  async createCase(label: string): Promise<number> {
    const [res] = await this.db.query<ResultSetHeader>(
      'INSERT INTO visa_cases (label_sealed, answers_sealed) VALUES (?, ?)',
      [this.sealer.seal(label), this.sealer.seal({})],
    );
    return res.insertId;
  }

  async listCases(): Promise<VisaCase[]> {
    const [rows] = await this.db.query<CaseRow[]>('SELECT * FROM visa_cases ORDER BY id DESC');
    return rows.map((r) => this.toCase(r));
  }

  async getCase(id: number): Promise<VisaCase | null> {
    const [rows] = await this.db.query<CaseRow[]>('SELECT * FROM visa_cases WHERE id = ?', [id]);
    return rows[0] ? this.toCase(rows[0]) : null;
  }

  async saveCaseAnswers(id: number, answers: Answers): Promise<void> {
    await this.db.query('UPDATE visa_cases SET answers_sealed = ? WHERE id = ?', [
      this.sealer.seal(answers),
      id,
    ]);
  }

  /** Deletes a case and everything its applicants said. */
  async deleteCase(id: number): Promise<void> {
    await this.db.query('DELETE FROM visa_cases WHERE id = ?', [id]);
  }

  async addApplicant(caseId: number, profile: Profile): Promise<number> {
    const [res] = await this.db.query<ResultSetHeader>(
      `INSERT INTO visa_applicants (case_id, profile_sealed, answers_sealed, answers_zh_sealed, messages_sealed)
       VALUES (?, ?, ?, ?, ?)`,
      [
        caseId,
        this.sealer.seal(profile),
        this.sealer.seal({}),
        this.sealer.seal({}),
        this.sealer.seal([]),
      ],
    );
    return res.insertId;
  }

  /** One case's applicants, or everyone's when no case is given. */
  async listApplicants(caseId?: number): Promise<Applicant[]> {
    const [rows] = await this.db.query<ApplicantRow[]>(
      caseId === undefined
        ? 'SELECT * FROM visa_applicants ORDER BY id'
        : 'SELECT * FROM visa_applicants WHERE case_id = ? ORDER BY id',
      caseId === undefined ? [] : [caseId],
    );
    return rows.map((r) => this.toApplicant(r));
  }

  async getApplicant(id: number): Promise<Applicant | null> {
    const [rows] = await this.db.query<ApplicantRow[]>(
      'SELECT * FROM visa_applicants WHERE id = ?',
      [id],
    );
    return rows[0] ? this.toApplicant(rows[0]) : null;
  }

  async saveApplicant(
    a: Pick<Applicant, 'id' | 'answers' | 'answersZh' | 'messages' | 'status'>,
  ): Promise<void> {
    await this.db.query(
      'UPDATE visa_applicants SET answers_sealed = ?, answers_zh_sealed = ?, messages_sealed = ?, status = ? WHERE id = ?',
      [
        this.sealer.seal(a.answers),
        this.sealer.seal(a.answersZh),
        this.sealer.seal(a.messages),
        a.status,
        a.id,
      ],
    );
  }

  async deleteApplicant(id: number): Promise<void> {
    await this.db.query('DELETE FROM visa_applicants WHERE id = ?', [id]);
  }
}
