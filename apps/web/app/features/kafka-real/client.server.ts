// The server's connection to the real Kafka cluster (KAFKA_BROKERS, e.g.
// "kafka-1:9092,kafka-2:9092,kafka-3:9092"). Unset means there is no cluster
// and every /api/kafka route answers 503. The clients connect lazily and
// reconnect on their own, so a cluster that is down only fails the requests
// made while it is down.
import {
  Admin,
  ConnectionPool,
  Consumer,
  Producer,
  describeQuorumV2,
  listOffsetsV9,
  metadataV12,
  stringSerializers,
} from '@platformatic/kafka';

type MetadataResponse = Awaited<ReturnType<typeof metadataV12.api.async>>;
type ListOffsetsTopics = Parameters<typeof listOffsetsV9.api.async>[3];
type ListOffsetsResponse = Awaited<ReturnType<typeof listOffsetsV9.api.async>>;

export interface BrokerAddress {
  host: string;
  port: number;
}

/**
 * The calls the routes make, narrow enough to fake in tests. Metadata and
 * offsets go through the raw protocol because the high-level client hides
 * internal topics like __consumer_offsets (and its listOffsets throws on them).
 */
export interface KafkaPort {
  admin: Pick<
    Admin,
    | 'describeConfigs'
    | 'listGroups'
    | 'describeGroups'
    | 'listConsumerGroupOffsets'
    | 'createTopics'
    | 'deleteTopics'
  >;
  producer: Pick<Producer<string, string, string, string>, 'send'>;
  /** Only its low-level fetch is used; it never joins a group. */
  reader: Pick<Consumer, 'fetch'>;
  /** Every broker and topic, internal topics included. */
  metadata(): Promise<MetadataResponse>;
  /** The active KRaft controller, or null if the quorum can't be asked. */
  controller(): Promise<number | null>;
  /** ListOffsets sent to one broker, which must lead every partition asked about. */
  listOffsets(broker: BrokerAddress, topics: ListOffsetsTopics): Promise<ListOffsetsResponse>;
}

export const CLIENT_ID = 'shiqi-web';
/** Longest a single cluster call may take before the route gives up. */
export const KAFKA_TIMEOUT_MS = 3000;

export function parseBrokers(raw: string | undefined): BrokerAddress[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[A-Za-z0-9.-]+:\d{1,5}$/.test(s))
    .map((s) => {
      const [host = '', port = ''] = s.split(':');
      return { host, port: Number(port) };
    });
}

function connect(brokers: BrokerAddress[]): KafkaPort {
  const base = {
    clientId: CLIENT_ID,
    bootstrapBrokers: brokers,
    timeout: KAFKA_TIMEOUT_MS,
    connectTimeout: KAFKA_TIMEOUT_MS,
    retries: 1,
  };
  const pool = new ConnectionPool(CLIENT_ID, {
    connectTimeout: KAFKA_TIMEOUT_MS,
    requestTimeout: KAFKA_TIMEOUT_MS,
  });
  const anyBroker = () => pool.getFirstAvailable(brokers);
  return {
    admin: new Admin(base),
    // acks=all (the default) so min.insync.replicas really applies.
    producer: new Producer({ ...base, serializers: stringSerializers }),
    reader: new Consumer({ ...base, groupId: `${CLIENT_ID}-reader` }),
    metadata: async () => metadataV12.api.async(await anyBroker(), null, false, false),
    controller: async () => {
      try {
        // Brokers forward this to the controllers.
        const res = await describeQuorumV2.api.async(await anyBroker(), [
          { topicName: '__cluster_metadata', partitions: [{ partitionIndex: 0 }] },
        ]);
        const leader = res.topics[0]?.partitions[0]?.leaderId;
        return leader !== undefined && leader >= 0 ? leader : null;
      } catch {
        return null;
      }
    },
    listOffsets: async (broker, topics) =>
      listOffsetsV9.api.async(await pool.get(broker), -1, 0, topics),
  };
}

let port: KafkaPort | null | undefined;

export function getKafka(): KafkaPort | null {
  if (port === undefined) {
    const brokers = parseBrokers(process.env.KAFKA_BROKERS);
    port = brokers.length ? connect(brokers) : null;
  }
  return port;
}
