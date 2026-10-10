import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NOTES } from './index';

/** Markdown that shows up as literal text when the MDX pipeline doesn't understand it. */
const LEAKS: [string, RegExp][] = [
  ['a table row', /\|\s*-{3,}\s*\|/],
  ['bold markers', /\*\*\S[^<]*?\S\*\*/],
  ['a code fence', /```/],
  ['a heading marker', />#{1,6} /],
];

const text = (html: string) => html.replace(/<(pre|code)\b[\s\S]*?<\/\1>/g, '');

describe('every note renders its Markdown', () => {
  for (const note of NOTES) {
    it(note.href, () => {
      const html = renderToStaticMarkup(createElement(note.Component));
      for (const [what, re] of LEAKS)
        expect(text(html), `${what} rendered as text`).not.toMatch(re);
    });
  }

  it('turns pipe tables into <table>', () => {
    const isr = NOTES.find((n) => n.slug === 'kafka-replication-isr');
    expect(renderToStaticMarkup(createElement(isr!.Component))).toContain('<table>');
  });
});
