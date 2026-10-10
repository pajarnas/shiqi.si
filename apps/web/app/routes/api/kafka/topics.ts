// POST /api/kafka/topics — create a lab-* topic (admin only).
//   curl -u admin:$ADMIN_PASSWORD -H 'Content-Type: application/json' \
//     -d '{"name":"lab-orders","partitions":3,"replicationFactor":3}' https://shiqi.si/api/kafka/topics
import { LAB_TOPICS_MAX, createLabTopic } from '~/features/kafka-real/cluster.server';
import {
  badRequest,
  guardAdminWrite,
  json,
  readJson,
  withKafka,
} from '~/features/kafka-real/http.server';
import { parseCreateTopic } from '~/features/kafka-real/snapshot';
import { KAFKA_API_TEXT } from '~/features/kafka-real/text';

export async function action({ request }: { request: Request }) {
  if (request.method !== 'POST') return badRequest(KAFKA_API_TEXT.invalid('method'), 405);
  const denied = guardAdminWrite(request);
  if (denied) return denied;
  const input = parseCreateTopic(await readJson(request));
  if (!input.ok)
    return badRequest(
      input.error === 'name' ? KAFKA_API_TEXT.notLabTopic : KAFKA_API_TEXT.invalid(input.error),
    );
  return withKafka(async (port) => {
    const created = await createLabTopic(port, input.value);
    return created === 'limit'
      ? badRequest(KAFKA_API_TEXT.tooManyTopics(LAB_TOPICS_MAX), 409)
      : json(created, 201);
  });
}
