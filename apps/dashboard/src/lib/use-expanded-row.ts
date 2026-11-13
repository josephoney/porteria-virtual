import { useCallback, useState, type KeyboardEvent } from 'react';

export function useExpandedRow() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isExpanded = useCallback((id: string) => expandedId === id, [expandedId]);

  const toggle = useCallback((id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  }, []);

  const collapse = useCallback(() => setExpandedId(null), []);

  return { expandedId, isExpanded, toggle, collapse };
}

/**
 * Props for a table row that expands a detail panel.
 *
 * The row deliberately keeps its `row` role: putting `role="button"` on a `<tr>`
 * makes a screen reader announce the whole table as a button and stops
 * announcing the columns. `aria-expanded` is valid on a row and is what carries
 * the state. The keyboard handler stays so the row remains operable without a
 * mouse, and `data-expandable` gives styling and tests a stable hook.
 */
export function expandableRowProps(id: string, isExpanded: boolean, toggle: (id: string) => void) {
  return {
    tabIndex: 0,
    'aria-expanded': isExpanded,
    'data-expandable': 'true',
    onClick: () => toggle(id),
    onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle(id);
      }
    },
  };
}
