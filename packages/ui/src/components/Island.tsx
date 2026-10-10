import { useEffect, useState, type ComponentType, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/**
 * A placeholder for an interactive widget inside static HTML (an MDX note,
 * or its machine translation). It renders an empty marked element; the page
 * mounts the real component into it with useIslands. The marker survives
 * translation, so a translated note keeps its widgets.
 */
export function Island({ name, props }: { name: string; props?: Record<string, unknown> }) {
  return (
    <div
      className="ui-island notranslate"
      translate="no"
      data-island={name}
      data-props={props ? JSON.stringify(props) : undefined}
    />
  );
}

export type IslandRegistry = Record<string, ComponentType<Record<string, unknown>>>;

interface Mounted {
  el: Element;
  Component: ComponentType<Record<string, unknown>>;
  props: Record<string, unknown>;
}

/**
 * Find every Island under `root` and render its component there, through a
 * portal, so it shares this tree's context. Re-scans when `key` changes
 * (e.g. the HTML was swapped for a translation).
 */
export function useIslands(
  root: RefObject<Element | null>,
  registry: IslandRegistry,
  key: unknown,
): ReactNode {
  const [mounted, setMounted] = useState<Mounted[]>([]);
  useEffect(() => {
    const found: Mounted[] = [];
    root.current?.querySelectorAll('[data-island]').forEach((el) => {
      const Component = registry[el.getAttribute('data-island') ?? ''];
      if (!Component) return;
      let props: Record<string, unknown> = {};
      try {
        props = JSON.parse(el.getAttribute('data-props') ?? '{}') as Record<string, unknown>;
      } catch {
        /* keep defaults */
      }
      el.textContent = '';
      found.push({ el, Component, props });
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the islands only exist in the DOM after render
    setMounted(found);
  }, [root, registry, key]);
  return mounted.map(({ el, Component, props }, i) =>
    createPortal(<Component {...props} />, el, String(i)),
  );
}
