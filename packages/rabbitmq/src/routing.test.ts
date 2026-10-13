import { describe, expect, it } from 'vitest';
import { headersMatch, topicMatches } from './routing';

describe('topic patterns', () => {
  it('match like the RabbitMQ tutorial says', () => {
    // https://www.rabbitmq.com/tutorials/tutorial-five-javascript
    expect(topicMatches('*.orange.*', 'quick.orange.rabbit')).toBe(true);
    expect(topicMatches('*.*.rabbit', 'quick.orange.rabbit')).toBe(true);
    expect(topicMatches('lazy.#', 'lazy.orange.elephant')).toBe(true);
    expect(topicMatches('lazy.#', 'lazy')).toBe(true);
    expect(topicMatches('*.orange.*', 'quick.orange.male.rabbit')).toBe(false);
    expect(topicMatches('*.*.rabbit', 'lazy.orange.male.rabbit')).toBe(false);
    expect(topicMatches('lazy.#', 'lazy.orange.male.rabbit')).toBe(true);
    expect(topicMatches('#', '')).toBe(true);
    expect(topicMatches('a.#.z', 'a.z')).toBe(true);
    expect(topicMatches('a.#.z', 'a.b.c.z')).toBe(true);
    expect(topicMatches('*', '')).toBe(false);
  });
});

describe('headers matching', () => {
  it('needs all headers by default, any with x-match=any', () => {
    const h = { format: 'pdf', type: 'report' };
    expect(headersMatch({ format: 'pdf', type: 'report' }, h)).toBe(true);
    expect(headersMatch({ format: 'pdf', type: 'log' }, h)).toBe(false);
    expect(headersMatch({ 'x-match': 'any', format: 'pdf', type: 'log' }, h)).toBe(true);
  });
});
