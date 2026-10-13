// Messages the /api/kafka/* routes send back. API callers are scripts and the
// lab page, so they stay in English and outside the translated string tables.
import { API_TEXT } from '~/lib/api.server';

export const KAFKA_API_TEXT = {
  invalid: (field: string) => `invalid ${field}`,
  notLabTopic: 'only topics named lab-* can be changed',
  jsonOnly: 'send Content-Type: application/json',
  tooMany: API_TEXT.tooMany,
  tooManyTopics: (max: number) => `at most ${max} lab topics; delete one first`,
  noSuchTopic: 'no such topic',
  noSuchPartition: 'no such partition',
  failed: 'the cluster refused the request',
} as const;
