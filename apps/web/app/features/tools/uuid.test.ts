import { describe, expect, it } from 'vitest';
import { inspectUuid, uuidv4, uuidv7 } from './uuid';

const zeros = (n: number) => new Uint8Array(n);

describe('uuid', () => {
  it('sets version and variant bits', () => {
    expect(uuidv4(zeros)).toBe('00000000-0000-4000-8000-000000000000');
    expect(uuidv7(0, zeros)).toBe('00000000-0000-7000-8000-000000000000');
  });

  it('puts the timestamp first in v7 (RFC 9562 test vector time)', () => {
    const id = uuidv7(0x017f22e279b0, zeros);
    expect(id.startsWith('017f22e2-79b0-7')).toBe(true);
    expect(inspectUuid(id)?.time?.getTime()).toBe(0x017f22e279b0);
  });

  it('inspects versions, variants and v1 time', () => {
    const v1 = inspectUuid('C232AB00-9414-11EC-B3C8-9F6BDECED846');
    expect(v1?.version).toBe(1);
    expect(v1?.variant).toBe('RFC 9562');
    expect(v1?.time?.toISOString()).toBe('2022-02-22T19:22:22.000Z');
    expect(inspectUuid('nope')).toBeNull();
  });
});
