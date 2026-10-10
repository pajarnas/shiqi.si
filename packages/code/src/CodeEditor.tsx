import { cx } from '@shiqi/ui';
import type { EditorView } from '@codemirror/view';
import { useEffect, useRef, useState } from 'react';
import { useCodeStrings } from './strings';

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Ctrl/Cmd+Enter. */
  onRun?: () => void;
  /** 1-based lines to mark as having an error. */
  errorLine?: number;
  className?: string;
}

/**
 * A TypeScript editor (CodeMirror 6), loaded on demand. Until it loads, and
 * when rendered on the server, the code shows as a plain read-only block.
 */
export function CodeEditor({ value, onChange, onRun, className }: CodeEditorProps) {
  const s = useCodeStrings();
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const [ready, setReady] = useState(false);
  const latest = useRef({ onChange, onRun });
  useEffect(() => {
    latest.current = { onChange, onRun };
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [
        { EditorView, keymap, lineNumbers, highlightActiveLine },
        { EditorState },
        cm,
        js,
        lang,
        hl,
      ] = await Promise.all([
        import('@codemirror/view'),
        import('@codemirror/state'),
        import('codemirror'),
        import('@codemirror/lang-javascript'),
        import('@codemirror/language'),
        import('@lezer/highlight'),
      ]);
      if (cancelled || !host.current) return;
      const t = hl.tags;
      const style = lang.HighlightStyle.define([
        { tag: [t.keyword, t.controlKeyword, t.definitionKeyword], color: 'var(--code-keyword)' },
        { tag: [t.number, t.bool, t.null], color: 'var(--code-number)' },
        { tag: [t.string], color: 'var(--code-string)' },
        { tag: [t.comment], color: 'var(--text-muted)', fontStyle: 'italic' },
        { tag: [t.typeName, t.className], color: 'var(--code-type)' },
        { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--code-fn)' },
      ]);
      const v = new EditorView({
        parent: host.current,
        state: EditorState.create({
          doc: value,
          extensions: [
            lineNumbers(),
            highlightActiveLine(),
            cm.minimalSetup,
            js.javascript({ typescript: true }),
            lang.syntaxHighlighting(style),
            lang.indentUnit.of('  '),
            keymap.of([
              {
                key: 'Mod-Enter',
                run: () => {
                  latest.current.onRun?.();
                  return true;
                },
              },
              { key: 'Tab', run: (ed) => (ed.dispatch(ed.state.replaceSelection('  ')), true) },
            ]),
            EditorView.updateListener.of((u) => {
              if (u.docChanged) latest.current.onChange(u.state.doc.toString());
            }),
            EditorView.contentAttributes.of({ 'aria-label': s.editor }),
          ],
        }),
      });
      view.current = v;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      view.current?.destroy();
      view.current = null;
    };
    // The editor is created once; later `value` changes are pushed in below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value)
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  return (
    <div className={cx('code-editor', className)}>
      <div ref={host} className="code-editor__host" hidden={!ready} />
      {!ready && (
        <pre className="code-editor__fallback" aria-busy="true" aria-label={s.loading}>
          {value}
        </pre>
      )}
    </div>
  );
}
