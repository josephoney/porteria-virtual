import { useCallback, useState } from 'react';

/**
 * Tracks an arbitrary number of expanded nodes. `useExpandedRow` only keeps one
 * id, which is enough for a detail row but not for a tree where several
 * branches stay open at the same time.
 */
export function useExpandedTree(initial: string[] = []) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(initial));

  const isExpanded = useCallback((id: string) => expanded.has(id), [expanded]);

  const toggle = useCallback((id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expand = useCallback((id: string) => {
    setExpanded((current) => {
      if (current.has(id)) return current;
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }, []);

  const collapse = useCallback((id: string) => {
    setExpanded((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  const reset = useCallback(() => setExpanded(new Set()), []);

  return { expanded, isExpanded, toggle, expand, collapse, reset };
}
