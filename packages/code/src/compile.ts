// Turn a reader's TypeScript into a callable function. Types are stripped by
// sucrase (no type checking, so it stays small and fast) and every loop gets a
// step counter, so an infinite loop throws instead of freezing the page.

/** Loop iterations allowed per call before the code is stopped. */
export const LOOP_LIMIT = 1_000_000;

export class CompileError extends Error {
  constructor(
    message: string,
    /** 1-based line, when known. */
    readonly line?: number,
  ) {
    super(message);
  }
}

export class LoopLimitError extends Error {
  constructor() {
    super(`A loop ran more than ${LOOP_LIMIT.toLocaleString('en')} times, so it was stopped.`);
  }
}

/** Why a loop couldn't be protected; the message is shown to the reader. */
export const UNBRACED_LOOP = 'unbraced-loop';

const GUARD = '__guard';

/**
 * Insert `if (++__guard.n > LIMIT) __guard.stop();` at the start of every loop
 * body. Strings, template literals, regexes and comments are skipped. A loop
 * whose body has no braces is rejected rather than guessed at.
 */
export function protectLoops(js: string): string {
  let out = '';
  let i = 0;
  const n = js.length;
  const isIdent = (c: string | undefined) => !!c && /[\w$]/.test(c);
  const skipString = (q: string) => {
    const start = i++;
    while (i < n && js[i] !== q) {
      if (js[i] === '\\') i++;
      i++;
    }
    i++;
    return js.slice(start, i);
  };
  const skipTemplate = () => {
    const start = i++;
    while (i < n && js[i] !== '`') {
      if (js[i] === '\\') i++;
      i++;
    }
    i++;
    return js.slice(start, i);
  };
  const skipSpace = () => {
    let s = '';
    while (i < n) {
      if (/\s/.test(js[i] as string)) s += js[i++];
      else if (js.startsWith('//', i)) {
        const end = js.indexOf('\n', i);
        const stop = end < 0 ? n : end;
        s += js.slice(i, stop);
        i = stop;
      } else if (js.startsWith('/*', i)) {
        const end = js.indexOf('*/', i + 2);
        const stop = end < 0 ? n : end + 2;
        s += js.slice(i, stop);
        i = stop;
      } else break;
    }
    return s;
  };
  const balanced = () => {
    // js[i] === '('
    let depth = 0;
    const start = i;
    while (i < n) {
      const c = js[i] as string;
      if (c === '"' || c === "'") {
        skipString(c);
        continue;
      }
      if (c === '`') {
        skipTemplate();
        continue;
      }
      if (c === '(') depth++;
      if (c === ')') {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
      i++;
    }
    return js.slice(start, i);
  };
  const guard = `if (++${GUARD}.n > ${LOOP_LIMIT}) ${GUARD}.stop();`;

  while (i < n) {
    const c = js[i] as string;
    if (c === '"' || c === "'") {
      out += skipString(c);
      continue;
    }
    if (c === '`') {
      out += skipTemplate();
      continue;
    }
    if (js.startsWith('//', i) || js.startsWith('/*', i)) {
      out += skipSpace();
      continue;
    }
    const prev = js[i - 1];
    const word = /^(for|while|do)\b/.exec(js.slice(i, i + 6))?.[1];
    if (word && !isIdent(prev) && prev !== '.') {
      out += word;
      i += word.length;
      let head = skipSpace();
      if (word !== 'do') {
        if (js[i] !== '(') {
          out += head;
          continue;
        }
        head += balanced();
        const after = skipSpace();
        // `} while (x);` closing a do-while: no body follows.
        if (word === 'while' && js[i] === ';') {
          out += head + after;
          continue;
        }
        head += after;
      }
      if (js[i] !== '{') throw new CompileError(UNBRACED_LOOP);
      out += `${head}{ ${guard}`;
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

type Transform = (code: string, options: { transforms: ['typescript'] }) => { code: string };
let transform: Transform | undefined;

/** Load the compiler ahead of time (it is a separate chunk). */
export async function loadCompiler() {
  transform ??= (await import('sucrase')).transform as Transform;
}

/**
 * Compile `source` and return the function called `name` it declares. Each
 * call of the returned function gets its own loop budget.
 */
export async function compile<F extends (...args: never[]) => unknown>(
  source: string,
  name: string,
): Promise<F> {
  await loadCompiler();
  let js: string;
  try {
    js = (transform as Transform)(source, { transforms: ['typescript'] }).code;
  } catch (e) {
    const err = e as Error & { loc?: { line: number } };
    throw new CompileError(err.message.replace(/\s*\(\d+:\d+\)$/, ''), err.loc?.line);
  }
  const body = `"use strict";\n${protectLoops(js)}\nreturn typeof ${name} === 'function' ? ${name} : undefined;`;
  let made: ((g: { n: number; stop: () => never }) => F | undefined) | undefined;
  try {
    made = new Function(GUARD, body) as typeof made;
  } catch (e) {
    throw new CompileError((e as Error).message);
  }
  const g = {
    n: 0,
    stop: (): never => {
      throw new LoopLimitError();
    },
  };
  const fn = made?.(g);
  if (!fn) throw new CompileError(`missing:${name}`);
  return ((...args: Parameters<F>) => {
    g.n = 0;
    return fn(...args);
  }) as F;
}
