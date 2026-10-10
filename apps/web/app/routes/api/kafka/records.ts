// GET /api/kafka/records?topic=&partition=&from=&limit= — up to 50 records
// from one partition, starting at offset `from` (default: the latest ones).
//   curl 'https://shiqi.si/api/kafka/records?topic=lab-orders&partition=0&limit=10'
import { readRecords } from '~/features/kafka-real/cluster.server';
import { badRequest, json, limitPublic, withKafka } from '~/features/kafka-real/http.server';
import { parseRecordsQuery } from '~/features/kafka-real/snapshot';
import { KAFKA_API_TEXT } from '~/features/kafka-real/text';

export async function loader({ request }: { request: Request }) {
  const limited = limitPublic(request);
  if (limited) return limited;
  const q = parseRecordsQuery(new URL(request.url).searchParams);
  if (!q.ok) return badRequest(KAFKA_API_TEXT.invalid(q.error));
  return withKafka(async (port) => {
    const records = await readRecords(port, q.value);
    return records ? json(records) : badRequest(KAFKA_API_TEXT.noSuchPartition, 404);
  });
}
