// Every word @shiqi/code shows. English is the default; apps pass their own
// translation through <CodeStringsProvider>.
import { createContext, useContext, type ReactNode } from 'react';

export const CODE_STRINGS = {
  editor: 'Code editor',
  loading: 'Loading the editor…',
  run: 'Run tests',
  running: 'Running…',
  reset: 'Start over',
  resetConfirm: 'Throw away your code and start from the template?',
  hint: 'Hint',
  hintN: 'Hint {n} of {total}',
  solution: 'Show Kafka’s version',
  hideSolution: 'Hide Kafka’s version',
  passed: '{n} of {total} tests pass',
  allPassed: 'All {total} tests pass. Your function is now running the demo.',
  got: 'got {got}',
  expected: 'expected {expected}',
  threw: 'threw: {error}',
  use: 'Run the demo on',
  mine: 'My code',
  kafka: 'Kafka’s code',
  notReady: 'Pass every test to plug your code in.',
  errors: {
    'unbraced-loop': 'Put every loop body in { braces } so the page can stop a runaway loop.',
    missing: 'Define a function called {name}.',
    compile: 'Line {line}: {message}',
    compileNoLine: '{message}',
  },
};

export type CodeStrings = typeof CODE_STRINGS;

const CodeStringsContext = createContext<CodeStrings>(CODE_STRINGS);

export function CodeStringsProvider({
  strings,
  children,
}: {
  strings: CodeStrings;
  children: ReactNode;
}) {
  return <CodeStringsContext.Provider value={strings}>{children}</CodeStringsContext.Provider>;
}

export const useCodeStrings = () => useContext(CodeStringsContext);
