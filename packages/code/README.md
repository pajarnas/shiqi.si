# @shiqi/code

Write-and-run code exercises in the browser.

- `CodeEditor`: a TypeScript editor (CodeMirror 6). It loads on demand and falls back to a plain code block on the server.
- `compile(source, name)`: strips types with sucrase and returns the function called `name`. Every loop gets a step counter, so an infinite loop throws `LoopLimitError` instead of freezing the page. Loop bodies must use braces.
- `runTests(fn, tests, reference)`: each test calls the function and compares the result with `expect`, or with the reference implementation's result.
- `Exercise`: puts the three together. It saves the reader's code in `localStorage`, re-runs the tests as they type, shows hints and the reference solution, and calls `onChange` with the reader's function once every test passes. That lets the page swap the reader's code into a live demo.

All text comes from `CODE_STRINGS`. Pass a translation through `<CodeStringsProvider>`.

Used by the "Build your own Kafka" course (`@shiqi/kafka-viz/course`).
