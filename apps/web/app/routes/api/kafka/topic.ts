// DELETE /api/kafka/topics/:name — delete a lab-* topic (admin only).
//   curl -u admin:$ADMIN_PASSWORD -X DELETE https://shiqi.si/api/kafka/topics/lab-orders
import { deleteLabTopic } from '~/features/kafka-real/cluster.server';
import { badRequest, guardAdminWrite, withKafka } from '~/features/kafka-real/http.server';
import { isLabTopic } from '~/features/kafka-real/snapshot';
import { KAFKA_API_TEXT } from '~/features/kafka-real/text';

export async function action({ request, params }: { request: Request; params: { name?: string } }) {
  if (request.method !== 'DELETE') return badRequest(KAFKA_API_TEXT.invalid('method'), 405);
  const denied = guardAdminWrite(request, false);
  if (denied) return denied;
  if (!isLabTopic(params.name)) return badRequest(KAFKA_API_TEXT.notLabTopic, 403);
  const name = params.name;
  return withKafka(async (port) => {
    await deleteLabTopic(port, name);
    return new Response(null, { status: 204 });
  });
}
