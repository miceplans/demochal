import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadGoogleMaps } from '@/lib/google-maps';
import { LocationMap } from './LocationMap';

// JS API를 흉내 내는 가짜 Map/Marker — 리스너를 보관해 클릭·드래그 이벤트를 직접 발동시킨다.
const h = vi.hoisted(() => ({
  mapInstances: [] as Array<{
    center: unknown;
    zoom: number;
    options: Record<string, unknown>;
    listeners: Map<string, (event: unknown) => void>;
  }>,
  markerInstances: [] as Array<{
    position: { lat: number; lng: number } | null;
    draggable: boolean;
    visible: boolean;
    listeners: Map<string, () => void>;
  }>,
}));

vi.mock('@/lib/google-maps', () => {
  class FakeMap {
    listeners = new Map<string, (event: unknown) => void>();
    constructor(
      _element: HTMLElement,
      public options: Record<string, unknown>,
    ) {
      this.center = options.center;
      this.zoom = options.zoom as number;
      h.mapInstances.push(this as never);
    }
    center: unknown;
    zoom: number;
    setCenter(center: unknown) {
      this.center = center;
    }
    setZoom(zoom: number) {
      this.zoom = zoom;
    }
    addListener(event: string, handler: (e: unknown) => void) {
      this.listeners.set(event, handler);
      return { remove: () => this.listeners.delete(event) };
    }
  }
  class FakeMarker {
    listeners = new Map<string, () => void>();
    constructor(
      public options: {
        position: { lat: number; lng: number } | null;
        draggable: boolean;
        visible: boolean;
      },
    ) {
      this.position = options.position;
      this.draggable = options.draggable;
      this.visible = options.visible;
      h.markerInstances.push(this as never);
    }
    position: { lat: number; lng: number } | null;
    draggable: boolean;
    visible: boolean;
    setPosition(position: { lat: number; lng: number } | null) {
      this.position = position;
    }
    setMap() {}
    setVisible(visible: boolean) {
      this.visible = visible;
    }
    getPosition() {
      return this.position
        ? { lat: () => this.position!.lat, lng: () => this.position!.lng }
        : null;
    }
    addListener(event: string, handler: () => void) {
      this.listeners.set(event, handler);
      return { remove: () => this.listeners.delete(event) };
    }
  }
  const mapsApi = {
    Map: FakeMap,
    Marker: FakeMarker,
    Geocoder: class {
      geocode(_request: unknown, callback: (results: unknown[], status: string) => void) {
        callback([], 'ZERO_RESULTS');
      }
    },
  };
  return {
    loadGoogleMaps: vi.fn(async () => mapsApi),
    geocodeAddress: vi.fn(async () => null),
  };
});

describe('LocationMap', () => {
  afterEach(() => {
    cleanup();
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    h.mapInstances.length = 0;
    h.markerInstances.length = 0;
  });
  beforeEach(() => vi.clearAllMocks());

  describe('API 키가 없을 때(embed 폰백)', () => {
    it('좌표가 있으면 좌표로 검색한 구글 지도 embed를 렌더한다', () => {
      const { container } = render(<LocationMap latitude={37.5665} longitude={126.978} />);
      const iframe = container.querySelector('iframe');
      expect(iframe).not.toBeNull();
      expect(iframe!.getAttribute('title')).toBe('기업 위치 지도');
      const src = iframe!.getAttribute('src')!;
      expect(src).toContain('q=37.5665%2C126.978');
      expect(src).toContain('output=embed');
      expect(loadGoogleMaps).not.toHaveBeenCalled();
    });

    it('좌표 없이 주소만 있으면 주소로 검색한 embed를 렌더한다', () => {
      const { container } = render(<LocationMap address="서울시 강남구" />);
      const src = container.querySelector('iframe')!.getAttribute('src')!;
      expect(src).toContain(`q=${encodeURIComponent('서울시 강남구')}`);
    });

    it('좌표·주소가 모두 없으면 플레이스홀더만 보여준다', () => {
      const { container } = render(<LocationMap />);
      expect(container.querySelector('iframe')).toBeNull();
      expect(container.textContent).toContain('위치가 아직 없어요');
    });
  });

  describe('API 키가 있을 때(JS API)', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-key';
    });

    it('저장된 좌표로 지도와 핀을 만든다', async () => {
      render(<LocationMap latitude={37.5665} longitude={126.978} />);
      await waitFor(() => expect(h.mapInstances).toHaveLength(1));
      expect(h.mapInstances[0].center).toEqual({ lat: 37.5665, lng: 126.978 });
      expect(h.markerInstances[0].position).toEqual({ lat: 37.5665, lng: 126.978 });
      expect(h.markerInstances[0].draggable).toBe(false);
    });

    it('editable이면 지도 클릭과 핀 드래그로 onChange를 호출한다', async () => {
      const onChange = vi.fn();
      render(<LocationMap latitude={37.5665} longitude={126.978} editable onChange={onChange} />);
      await waitFor(() => expect(h.markerInstances).toHaveLength(1));
      const map = h.mapInstances[0];
      const marker = h.markerInstances[0];
      expect(marker.draggable).toBe(true);

      map.listeners.get('click')!({ latLng: { lat: () => 10.5, lng: () => 20.25 } });
      expect(onChange).toHaveBeenCalledWith(10.5, 20.25);

      marker.position = { lat: 11, lng: 22 };
      marker.listeners.get('dragend')!();
      expect(onChange).toHaveBeenCalledWith(11, 22);
    });

    it('좌표가 바뀌면 기존 지도 인스턴스에 반영한다', async () => {
      const { rerender } = render(<LocationMap latitude={37.5665} longitude={126.978} />);
      await waitFor(() => expect(h.markerInstances).toHaveLength(1));
      rerender(<LocationMap latitude={35.1} longitude={129.1} />);
      await waitFor(() => expect(h.markerInstances[0].position).toEqual({ lat: 35.1, lng: 129.1 }));
    });

    it('스크립트 로드에 실패하면 embed로 폰백한다', async () => {
      vi.mocked(loadGoogleMaps).mockRejectedValueOnce(new Error('load failed'));
      const { container } = render(<LocationMap latitude={37.5665} longitude={126.978} />);
      await waitFor(() => expect(container.querySelector('iframe')).not.toBeNull());
      expect(container.querySelector('iframe')!.getAttribute('src')).toContain(
        'q=37.5665%2C126.978',
      );
    });

    it('지도 타일이 로드되지 않으면(키 제한 등) 8초 후 embed로 폰백한다', async () => {
      vi.useFakeTimers();
      try {
        const { container } = render(<LocationMap latitude={37.5665} longitude={126.978} />);
        // 타이머 콜백의 setState를 act 안에서 플러시한다.
        await act(async () => {
          await vi.advanceTimersByTimeAsync(8500);
        });
        expect(container.querySelector('iframe')).not.toBeNull();
        expect(container.querySelector('iframe')!.getAttribute('src')).toContain(
          'q=37.5665%2C126.978',
        );
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
