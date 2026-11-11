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

export function expandableRowProps(id: string, isExpanded: boolean, toggle: (id: string) => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    'aria-expanded': isExpanded,
    onClick: () => toggle(id),
    onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle(id);
      }
    },
  };
}
