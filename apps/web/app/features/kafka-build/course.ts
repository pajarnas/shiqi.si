// The "Build your own Kafka" course is a series of notes. Each chapter lives
// at /notes/commonplace/build-kafka-<rest> and at /kafka/build/<rest>.
import { seriesNotes, type Note } from '~/content/notes';

export const COURSE = 'build-kafka';
const PREFIX = `${COURSE}-`;

export const chapters = () => seriesNotes(COURSE);
export const chapterPath = (n: Note) => `/kafka/build/${n.slug.slice(PREFIX.length)}`;
export const findChapter = (slug: string | undefined) =>
  chapters().find((n) => n.slug === `${PREFIX}${slug}`);
