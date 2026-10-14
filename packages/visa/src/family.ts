// The family's member list, given once in the VISA_FAMILY setting so names stay
// out of the (public) repository: "张三:B1/B2,李四:H-1B,…".
import { VISA_TYPES, type VisaType } from './schema';
import type { Profile, VisaStore } from './store';

/**
 * Reads "name:visa" entries separated by commas, semicolons or new lines. The
 * visa defaults to B1/B2; anything between name and visa is ignored.
 */
export function parseFamily(raw: string | undefined): Profile[] {
  return (raw ?? '')
    .split(/[,;，；\n]/)
    .map((entry) => entry.split(/[:：]/).map((p) => p.trim()))
    .filter(([name]) => name)
    .map((parts) => ({ name: parts[0]!, visa: parts.length > 1 ? parts.at(-1)! : '' }))
    .map(({ name, visa }) => ({
      name,
      visa: (VISA_TYPES as readonly string[]).includes(visa.toUpperCase())
        ? (visa.toUpperCase() as VisaType)
        : 'B1/B2',
    }));
}

/** Creates the family case with everyone in it, the first time the helper starts with no cases. */
export async function seedFamily(store: VisaStore, family: readonly Profile[]): Promise<boolean> {
  if (family.length === 0 || (await store.listCases()).length > 0) return false;
  const caseId = await store.createCase('我们家');
  for (const p of family) await store.addApplicant(caseId, p);
  return true;
}
