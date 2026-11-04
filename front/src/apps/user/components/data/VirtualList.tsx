'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, type ReactNode } from 'react';

interface VirtualListProps<T> {
  items: T[];
  estimateSize: (index: number) => number;
  height: number;
  renderItem: (item: T, index: number) => ReactNode;
  onEndReached?: () => void;
  endReachedOffset?: number;
}

// Generic virtualized list for long scrollable collections
// (challenge feeds, notification history, etc.).
export function VirtualList<T>({
  items,
  estimateSize,
  height,
  renderItem,
  onEndReached,
  endReachedOffset = 200,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 8,
  });

  const handleScroll = () => {
    if (!onEndReached || !parentRef.current) return;
    const el = parentRef.current;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - endReachedOffset) {
      onEndReached();
    }
  };

  return (
    <div
      ref={parentRef}
      onScroll={handleScroll}
      style={{ height, overflow: 'auto', position: 'relative' }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderItem(items[virtualRow.index] as T, virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
