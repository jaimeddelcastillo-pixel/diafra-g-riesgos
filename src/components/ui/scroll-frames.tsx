import { useEffect } from 'react';

/** Legacy native tables share the same frame without reparenting React-owned nodes. */
export function ScrollFrames() {
  useEffect(() => {
    const frames = new Set<HTMLElement>();
    const update = () => {
      for (const table of document.querySelectorAll('table')) {
        const parent = table.parentElement;
        if (!parent || parent.classList.contains('table-scroll-frame')) continue;
        parent.classList.add('table-scroll-frame'); frames.add(parent);
      }
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); for (const frame of frames) frame.classList.remove('table-scroll-frame'); };
  }, []);
  return null;
}