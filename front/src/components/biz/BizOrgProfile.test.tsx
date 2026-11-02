import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocationMapProps } from '@/components/biz/LocationMap';
import { BizOrgProfile } from './BizOrgProfile';

// 실제 지도 대신 받은 prop을 화면에 찍는 스텁 — 지도 props 전달 계약을 검증한다.
const mapProps = vi.hoisted(() => ({ latest: null as LocationMapProps | null }));
vi.mock('@/components/biz/LocationMap', () => ({
  LocationMap: (props: LocationMapProps) => {
    mapProps.latest = props;
    return <div data-testid="location-map" />;
  },
}));

describe('BizOrgProfile', () => {
  afterEach(() => {
    cleanup();
    mapProps.latest = null;
  });
  beforeEach(() => vi.clearAllMocks());

  it('배너 편집 모드에서 파일 아이콘형 업로더를 보여준다', () => {
    render(
      <BizOrgProfile
        name="세모챌"
        bannerInput={<input type="file" aria-label="배너 이미지 선택" />}
      />,
    );
    expect(screen.getByText('파일 찾기')).not.toBeNull();
    expect(screen.queryByText('배경 이미지 추가')).toBeNull();
  });

  it('배너 이미지가 있어도 파일 아이콘형 업로더를 보여준다', () => {
    render(
      <BizOrgProfile
        name="세모챌"
        bannerUrl="https://cdn.example.com/banner.png"
        bannerInput={<input type="file" aria-label="배너 이미지 선택" />}
      />,
    );
    expect(screen.getByText('파일 찾기')).not.toBeNull();
    expect(screen.queryByText('배경 이미지 변경')).toBeNull();
  });

  it('읽기 전용 모드에는 업로더를 보여주지 않는다', () => {
    render(<BizOrgProfile name="세모챌" bannerUrl="https://cdn.example.com/banner.png" />);
    expect(screen.queryByText('파일 찾기')).toBeNull();
  });

  it('지도 좌표·주소를 LocationMap에 전달하고 기본은 읽기 전용이다', () => {
    render(
      <BizOrgProfile
        name="세모챌"
        mapLatitude={37.5665}
        mapLongitude={126.978}
        mapAddress="서울시 강남구"
      />,
    );
    expect(mapProps.latest).toMatchObject({
      latitude: 37.5665,
      longitude: 126.978,
      address: '서울시 강남구',
      editable: false,
    });
  });

  it('mapEditable과 onMapChange를 LocationMap에 그대로 연결한다', () => {
    const onMapChange = vi.fn();
    render(<BizOrgProfile name="세모챌" mapEditable onMapChange={onMapChange} />);
    expect(mapProps.latest?.editable).toBe(true);
    mapProps.latest?.onChange?.(37.1, 127.1);
    expect(onMapChange).toHaveBeenCalledWith(37.1, 127.1);
  });

  it('프사·기업명이 배너 이미지 위에 그려지도록 Identity가 포지션 레이어에 있다', () => {
    render(<BizOrgProfile name="세모챌" bannerUrl="https://cdn.example.com/banner.png" />);
    const identity = screen.getByText('세모챌').parentElement!;
    // 배너가 position 요소라 같은 레이어에서는 DOM 순서대로 Identity(프사)가 위에 올라야 한다.
    expect(getComputedStyle(identity).position).toBe('relative');
  });
});
