// POST /api/kafka/produce — write records to a lab-* topic (admin only), with
// acks=all. Body: { topic, key?, value, partition? } or { topic, messages: [...] }.
//   curl -u admin:$ADMIN_PASSWORD -H 'Content-Type: application/json' \
//     -d '{"topic":"lab-orders","key":"o-1","value":"hello"}' https://shiqi.si/api/kafka/produce
import { produce } from '~/features/kafka-real/cluster.server';
import {
  badRequest,
  guardAdminWrite,
  json,
  readJson,
  withKafka,
} from '~/features/kafka-real/http.server';
import { parseProduce } from '~/features/kafka-real/snapshot';
import { KAFKA_API_TEXT } from '~/features/kafka-real/text';

export async function action({ request }: { request: Request }) {
  if (request.method !== 'POST') return badRequest(KAFKA_API_TEXT.invalid('method'), 405);
  const denied = guardAdminWrite(request);
  if (denied) return denied;
  const input = parseProduce(await readJson(request));
  if (!input.ok)
    return badRequest(
      input.error === 'topic' ? KAFKA_API_TEXT.notLabTopic : KAFKA_API_TEXT.invalid(input.error),
    );
  return withKafka(async (port) => {
    const offsets = await produce(port, input.value);
    if (offsets === 'topic') return badRequest(KAFKA_API_TEXT.noSuchTopic, 404);
    if (offsets === 'partition') return badRequest(KAFKA_API_TEXT.noSuchPartition, 404);
    return json({ offsets });
  });
}
