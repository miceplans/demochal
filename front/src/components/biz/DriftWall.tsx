'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import styled from '@emotion/styled';

export interface DriftWallItem {
  image: string;
  title?: string;
  href?: string;
}

interface DriftWallProps {
  items: DriftWallItem[];
  columns?: number;
  tileWidth?: number;
  tileHeight?: number;
  gap?: number;
  radius?: number;
  tilt?: number;
  turn?: number;
  perspective?: number;
  depth?: number;
  speed?: number;
  variance?: number;
  parallax?: number;
  pauseOnHover?: boolean;
  className?: string;
}

const Wall = styled.div({
  height: 'clamp(420px, 54vw, 640px)',
  overflow: 'hidden',
  position: 'relative',
  background: '#060010',
  perspective: 'var(--dw-perspective)',
  isolation: 'isolate',
  '&::before, &::after': {
    content: '""',
    position: 'absolute',
    inset: 0,
    zIndex: 2,
    pointerEvents: 'none',
  },
  '&::before': {
    background: 'linear-gradient(90deg, #060010 0%, transparent 18%, transparent 82%, #060010 100%)',
  },
  '&::after': {
    background: 'linear-gradient(180deg, #060010 0%, transparent 17%, transparent 75%, #060010 100%)',
  },
  '@media (max-width: 700px)': { height: 440 },
});
const Plane = styled.div({
  position: 'absolute',
  left: '50%',
  top: '50%',
  display: 'flex',
  gap: 'var(--dw-gap)',
  width: 'max-content',
  transformStyle: 'preserve-3d',
  willChange: 'transform',
});
const Column = styled.div({ height: '140%', overflow: 'hidden', width: 'var(--dw-tile-w)' });
const Track = styled.div({ display: 'flex', flexDirection: 'column', gap: 'var(--dw-gap)', willChange: 'transform' });
const Tile = styled.div<{ active: boolean }>(({ active }) => ({
  width: 'var(--dw-tile-w)',
  height: 'var(--dw-tile-h)',
  borderRadius: 'var(--dw-radius)',
  overflow: 'hidden',
  transform: active ? 'translateZ(var(--dw-lift)) scale(1.04)' : 'translateZ(0)',
  filter: active ? 'brightness(1.1)' : 'brightness(var(--dw-dim))',
  transition: 'transform 260ms ease, filter 260ms ease',
  '& img': { width: '100%', height: '100%', objectFit: 'cover', userSelect: 'none' },
}));

const factorForColumn = (index: number, variance: number) => {
  const normalized = ((index * 0.6180339887 + 0.35) % 1) * 2 - 1;
  return 1 + variance * normalized;
};

export function DriftWall({
  items,
  columns = 4,
  tileWidth = 280,
  tileHeight = 220,
  gap = 16,
  radius = 6,
  tilt = 0,
  turn = 0,
  perspective = 2400,
  depth = 0,
  speed = 18,
  variance = 0.3,
  parallax = 0.8,
  pauseOnHover = false,
  className,
}: DriftWallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const tracks = useRef<(HTMLDivElement | null)[]>([]);
  const offsets = useRef<number[]>([]);
  const velocities = useRef<number[]>([]);
  const pointer = useRef({ x: 0, y: 0 });
  const dampedPointer = useRef({ x: 0, y: 0 });
  const hoveredColumn = useRef(-1);
  const isHovered = useRef(false);
  const raf = useRef<number | null>(null);
  const lastTime = useRef<number | null>(null);
  const [height, setHeight] = useState(600);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const columnsOfItems = useMemo(() => {
    const result = Array.from({ length: columns }, () => [] as DriftWallItem[]);
    items.forEach((item, index) => result[index % columns].push(item));
    return result.filter((column) => column.length > 0);
  }, [columns, items]);
  const meta = useMemo(() => {
    const unit = tileHeight + gap;
    return columnsOfItems.map((column) => {
      const copyHeight = Math.max(unit, column.length * unit);
      return { copyHeight, copies: Math.max(2, Math.ceil((height * 1.6) / copyHeight) + 1) };
    });
  }, [columnsOfItems, gap, height, tileHeight]);
  const baseVelocity = useMemo(
    () => columnsOfItems.map((_, index) => speed * factorForColumn(index, variance) * (index % 2 === 0 ? 1 : -1)),
    [columnsOfItems, speed, variance],
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height || 600));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    offsets.current = meta.map(({ copyHeight }, index) => copyHeight * ((index * 0.37) % 1));
    velocities.current = meta.map(() => 0);
  }, [meta]);

  useEffect(() => {
    const animate = (now: number) => {
      const dt = lastTime.current === null ? 0 : Math.min(0.05, (now - lastTime.current) / 1000);
      lastTime.current = now;
      const smoothing = 1 - Math.exp(-dt / 0.12);
      dampedPointer.current.x += (pointer.current.x * parallax * 8 - dampedPointer.current.x) * smoothing;
      dampedPointer.current.y += (pointer.current.y * parallax * 8 - dampedPointer.current.y) * smoothing;
      if (planeRef.current) {
        planeRef.current.style.transform = `translate(-50%, -50%) scale(1.18) rotateX(${tilt - dampedPointer.current.y}deg) rotateY(${turn + dampedPointer.current.x}deg) translateZ(${-depth}px)`;
      }
      if (!reducedMotion) {
        meta.forEach(({ copyHeight }, index) => {
          const target = isHovered.current && (pauseOnHover || hoveredColumn.current === index) ? 0 : baseVelocity[index];
          velocities.current[index] += (target - velocities.current[index]) * (1 - Math.exp(-dt / (target ? 0.28 : 0.16)));
          offsets.current[index] = ((offsets.current[index] + velocities.current[index] * dt) % copyHeight + copyHeight) % copyHeight;
          if (tracks.current[index]) tracks.current[index]!.style.transform = `translate3d(0, ${-offsets.current[index]}px, 0)`;
        });
      }
      raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      lastTime.current = null;
    };
  }, [baseVelocity, depth, meta, parallax, pauseOnHover, reducedMotion, tilt, turn]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || reducedMotion) return;
    pointer.current = { x: (event.clientX - rect.left) / rect.width - 0.5, y: (event.clientY - rect.top) / rect.height - 0.5 };
  }, [reducedMotion]);
  const variables = {
    '--dw-tile-w': `${tileWidth}px`, '--dw-tile-h': `${tileHeight}px`, '--dw-gap': `${gap}px`,
    '--dw-radius': `${radius}px`, '--dw-perspective': `${perspective}px`, '--dw-lift': '64px', '--dw-dim': 0.65,
  } as CSSProperties;

  if (columnsOfItems.length === 0) return null;
  return (
    <Wall ref={containerRef} className={className} style={variables} onPointerMove={onPointerMove} onPointerEnter={() => { isHovered.current = true; }} onPointerLeave={() => { isHovered.current = false; hoveredColumn.current = -1; pointer.current = { x: 0, y: 0 }; setActiveId(null); }} aria-label="행사 이미지 드리프트 월">
      <Plane ref={planeRef}>
        {columnsOfItems.map((column, columnIndex) => (
          <Column key={columnIndex}>
            <Track ref={(element) => { tracks.current[columnIndex] = element; }}>
              {Array.from({ length: meta[columnIndex]?.copies ?? 2 }, (_, copyIndex) => column.map((item, itemIndex) => {
                const id = `${columnIndex}-${copyIndex}-${itemIndex}`;
                return <Tile key={id} active={activeId === id} onPointerEnter={() => { hoveredColumn.current = columnIndex; setActiveId(id); }} onPointerLeave={() => { hoveredColumn.current = -1; setActiveId(null); }}><img src={item.image} alt={item.title ?? ''} draggable={false} loading="lazy" /></Tile>;
              }))}
            </Track>
          </Column>
        ))}
      </Plane>
    </Wall>
  );
}
