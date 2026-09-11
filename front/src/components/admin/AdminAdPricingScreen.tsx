'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { adHttp, adError, type AdPricing } from '@/lib/ad-api';
import { desktopContests, teams } from '@/data/user-design';
import { Dropdown } from '@/components/ui/Dropdown';
import { ContestCard } from '@/components/contests/ContestCard';
import { TeamCard } from '@/components/teams/TeamCard';
import { MovingAds } from '@/components/ads/MovingAds';
import { useToast } from '@/components/common/Toast';

type PreviewView = 'mobile' | 'pc';

const HERO_IMAGE = '/assets/figma-ads/home-hero.png';
const GALLERY_IMAGE = '/assets/figma-ads/home-gallery.png';
const AD_COUNT = 5;
const AD_INTERVAL = 5000;
const PC_HERO_CARD = 1043;
const PC_HERO_GAP = 60;
const PC_HERO_STEP = PC_HERO_CARD + PC_HERO_GAP;
const PC_HERO_CENTER = 1220 / 2;
const PC_GALLERY_ITEM = 298;
const PC_GALLERY_GAP = 32;
const PC_GALLERY_STEP = PC_GALLERY_ITEM + PC_GALLERY_GAP;
const PC_GALLERY_CENTER = 1200 / 2;
const MOBILE_GALLERY_ITEM = 122;
const MOBILE_GALLERY_GAP = 12;
const MOBILE_GALLERY_STEP = MOBILE_GALLERY_ITEM + MOBILE_GALLERY_GAP;
const MOBILE_GALLERY_CENTER = 358 / 2;

const Screen = styled.div({ display: 'flex', flexDirection: 'column', gap: 32, width: '100%' });

const ViewSwitch = styled.div({
  display: 'flex',
  justifyContent: 'flex-end',
});
const ViewSwitchGroup = styled.div({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 20px',
  background: c.white,
  borderRadius: 6,
});
const ViewButton = styled('button', { shouldForwardProp: (prop) => prop !== 'active' })<{
  active: boolean;
}>(({ active }) => ({
  border: 0,
  borderRadius: 6,
  padding: '10px 20px',
  background: active ? c.primary : 'transparent',
  color: active ? c.white : c.gray900,
  cursor: 'pointer',
  ...textStyle.subtitle,
}));

const PreviewStage = styled.div({
  position: 'relative',
  display: 'flex',
  justifyContent: 'center',
  width: '100%',
});

const PcMock = styled.div({
  width: 'min(100%, 1220px)',
  display: 'flex',
  flexDirection: 'column',
  gap: 60,
});
const MobileMock = styled.div({
  width: 'min(100%, 358px)',
  display: 'flex',
  flexDirection: 'column',
  gap: 32,
});

const HeroViewport = styled.div({ overflow: 'hidden' });
const CenterRail = styled('div', {
  shouldForwardProp: (prop) =>
    prop !== 'index' &&
    prop !== 'animate' &&
    prop !== 'step' &&
    prop !== 'itemWidth' &&
    prop !== 'center' &&
    prop !== 'gap',
})<{
  index: number;
  animate: boolean;
  step: number;
  itemWidth: number;
  center: number;
  gap: number;
}>(({ index, animate, step, itemWidth, center, gap }) => ({
  display: 'flex',
  gap,
  '& > *': { flex: `0 0 ${itemWidth}px` },
  transform: `translateX(${center - index * step - itemWidth / 2}px)`,
  transition: animate ? 'transform 420ms ease' : 'none',
}));
const MobileHeroRail = styled('div', {
  shouldForwardProp: (prop) => prop !== 'index' && prop !== 'animate',
})<{ index: number; animate: boolean }>(({ index, animate }) => ({
  display: 'flex',
  '& > *': { flex: '0 0 100%' },
  transform: `translateX(-${index * 100}%)`,
  transition: animate ? 'transform 420ms ease' : 'none',
}));

const HeroCard = styled('button', { shouldForwardProp: (prop) => prop !== 'compact' })<{
  compact?: boolean;
}>(({ compact }) => ({
  position: 'relative',
  display: 'flex',
  width: '100%',
  height: compact ? 170 : 252,
  padding: compact ? 16 : 20,
  flexDirection: 'column',
  justifyContent: 'flex-end',
  gap: compact ? 6 : 16,
  border: 0,
  borderRadius: 12,
  cursor: 'pointer',
  textAlign: 'left',
  backgroundImage: `linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, #FFFFFF 100%), url(${HERO_IMAGE})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  transition: 'box-shadow 180ms ease',
  '&:hover': { boxShadow: '0 12px 28px rgba(27, 33, 44, .18)' },
  '&:focus-visible': { outline: `2px solid ${c.primary}`, outlineOffset: 3 },
}));
const HeroLabel = styled('span', { shouldForwardProp: (prop) => prop !== 'compact' })<{
  compact?: boolean;
}>(({ compact }) => ({
  fontSize: compact ? 14 : 24,
  fontWeight: 400,
  lineHeight: 1.3,
  color: '#101010',
}));
const HeroPrice = styled('strong', { shouldForwardProp: (prop) => prop !== 'compact' })<{
  compact?: boolean;
}>(({ compact }) => ({
  fontSize: compact ? 28 : 48,
  fontWeight: 600,
  lineHeight: 1.3,
  letterSpacing: '-0.01em',
  color: '#101010',
}));

const Pager = styled.div({ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 });
const Dot = styled('button', { shouldForwardProp: (prop) => prop !== 'active' })<{
  active: boolean;
}>(({ active }) => ({
  width: active ? 18 : 6,
  height: 6,
  padding: 0,
  border: 0,
  borderRadius: 99,
  background: active ? c.primary : c.gray200,
  cursor: 'pointer',
  transition: 'width 180ms ease, background 180ms ease',
  '&:focus-visible': { outline: `2px solid ${c.primary}`, outlineOffset: 2 },
}));

const StaticContent = styled.div({ pointerEvents: 'none' });
const Sections = styled.div({
  width: 'min(100%, 1200px)',
  alignSelf: 'center',
  display: 'flex',
  flexDirection: 'column',
  gap: 60,
});
const MobileBody = styled.div({
  display: 'flex',
  flexDirection: 'column',
  gap: 32,
  padding: '0 16px',
});
const SectionStack = styled.div({ display: 'flex', flexDirection: 'column', gap: 28 });
const FilterRow = styled.div({ display: 'flex', gap: 16 });
const Section = styled.section({ display: 'flex', flexDirection: 'column', gap: 16 });
const SectionHead = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});
const SectionTitle = styled.h2({ margin: 0, fontSize: 18, fontWeight: 700, color: '#101010' });
const MoreLabel = styled.span({ ...textStyle.secondaryText, color: '#858A99' });

const Rail = styled.div({
  display: 'flex',
  gap: 16,
  overflowX: 'auto',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
  '& > *': { flex: '0 0 416px' },
});
const MobileRail = styled(Rail)({ '& > *': { flex: '0 0 240px' } });

const GalleryViewport = styled.div({ overflow: 'hidden' });
const GalleryItem = styled.div({
  position: 'relative',
  height: 206,
  borderRadius: 8,
  backgroundImage: `url(${GALLERY_IMAGE})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
});
const MobileGalleryItem = styled(GalleryItem)({ height: 74, borderRadius: 3 });
const GalleryNumber = styled.span({
  position: 'absolute',
  top: 12,
  left: 12,
  padding: '4px 10px',
  borderRadius: 999,
  background: 'rgba(16, 16, 16, .6)',
  color: c.white,
  fontSize: 13,
  fontWeight: 600,
});

const TeamGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 16,
});
const TeamStack = styled.div({ display: 'flex', flexDirection: 'column', gap: 12 });

const Backdrop = styled.div({
  position: 'fixed',
  zIndex: 100,
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  background: 'rgba(17, 17, 17, 0.2)',
});
const Dialog = styled.div({
  width: 'min(100%, 606px)',
  padding: 30,
  borderRadius: 9,
  background: c.white,
  display: 'flex',
  flexDirection: 'column',
  gap: 15,
});
const DialogThumb = styled.div({
  width: '100%',
  height: 133,
  borderRadius: 6,
  backgroundImage: `url(${HERO_IMAGE})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
});
const DialogBody = styled.div({ display: 'flex', flexDirection: 'column', gap: 15 });
const DialogTitle = styled.h2({ margin: 0, ...textStyle.h1_2, color: '#101010' });
const InfoRow = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});
const InfoList = styled.div({ display: 'flex', flexDirection: 'column', gap: 8 });
const InfoItem = styled.div({ display: 'flex', alignItems: 'baseline' });
const InfoLabel = styled.span({
  display: 'inline-block',
  width: 80,
  ...textStyle.caption2,
  color: '#101010',
});
const InfoValue = styled.span({ ...textStyle.caption, color: '#101010' });
const ReportLink = styled(Link)({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 12px',
  borderRadius: 6,
  background: c.primary,
  color: c.white,
  textDecoration: 'none',
  ...textStyle.mFeatureTitle,
});
const DialogActions = styled.div({ display: 'flex', gap: 15 });
const DialogButton = styled('button', { shouldForwardProp: (prop) => prop !== 'primary' })<{
  primary?: boolean;
}>(({ primary }) => ({
  flex: 1,
  height: 37,
  border: primary ? 0 : `1px solid #DFE2E7`,
  borderRadius: 6,
  background: primary ? c.primary : c.white,
  color: primary ? c.white : '#101010',
  cursor: 'pointer',
  ...(primary ? textStyle.mFeatureTitle : textStyle.overline),
}));
const ModalText = styled.p({ margin: 0, ...textStyle.caption, color: '#101010' });
const PriceField = styled.div({
  display: 'flex',
  alignItems: 'center',
  overflow: 'hidden',
  height: 48,
  border: `1px solid ${c.gray300}`,
  borderRadius: 8,
  background: c.white,
  '&:focus-within': { borderColor: c.primary, boxShadow: `0 0 0 3px ${c.primary}20` },
});
const PriceInput = styled.input({
  width: '100%',
  minWidth: 0,
  height: '100%',
  padding: '0 14px',
  border: 0,
  outline: 0,
  color: '#101010',
  background: 'transparent',
  ...textStyle.bodyLarge,
});
const Won = styled.span({ paddingRight: 14, color: c.gray500, ...textStyle.body });

const digitsOnly = (value: string) => value.replace(/[^0-9]/g, '');

function SectionHeading({ title }: { title: string }) {
  return (
    <SectionHead>
      <SectionTitle>{title}</SectionTitle>
      <MoreLabel>더보기 →</MoreLabel>
    </SectionHead>
  );
}

export function AdminAdPricingScreen() {
  const [view, setView] = useState<PreviewView>('pc');
  const [detailAd, setDetailAd] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [dailyPrice, setDailyPrice] = useState(0);
  const [pricing, setPricing] = useState<AdPricing | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState('');
  const toast = useToast();
  const titleId = useId();
  const inputId = useId();
  useEffect(() => {
    adHttp
      .get<AdPricing[]>('/admin/ad-pricing')
      .then((items) => {
        const hero = items.find((item) => item.slot === 'hero');
        if (!hero) throw new Error('상품 없음');
        setPricing(hero);
        setDailyPrice(hero.dailyPrice);
      })
      .catch((error) => setLoadError(adError(error)));
  }, []);

  const dialogOpen = detailAd !== null;
  useEffect(() => {
    if (!dialogOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (editing) setEditing(false);
        else setDetailAd(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dialogOpen, editing]);

  const openDetail = (adNumber: number) => {
    setEditing(false);
    setDetailAd(adNumber);
  };
  const startEditing = () => {
    setDraft(String(dailyPrice));
    setEditing(true);
  };
  const savePrice = async () => {
    if (saving || !pricing) return;
    const nextPrice = Number(digitsOnly(draft));
    if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
      toast.error('광고비를 확인해주세요', '0원보다 큰 금액을 입력해 주세요');
      return;
    }
    setSaving(true);
    try {
      const items = await adHttp.put<AdPricing[]>('/admin/ad-pricing', [
        { slot: 'hero', dailyPrice: nextPrice },
      ]);
      const hero = items.find((item) => item.slot === 'hero');
      if (!hero) throw new Error('상품 없음');
      setPricing(hero);
      setDailyPrice(hero.dailyPrice);
      setDetailAd(null);
      toast.success(
        '광고비가 수정되었습니다',
        `빅배너 하루 광고비 ${nextPrice.toLocaleString()}원`,
      );
    } catch (error) {
      toast.error('광고비 수정 실패', adError(error));
    } finally {
      setSaving(false);
    }
  };

  const renderDots = (activeIndex: number, label: string, goTo: (index: number) => void) => (
    <Pager aria-label={`${label} ${activeIndex + 1} / ${AD_COUNT}`} aria-live="polite">
      {Array.from({ length: AD_COUNT }, (_, index) => (
        <Dot
          key={index}
          type="button"
          active={activeIndex === index}
          aria-label={`${label} ${index + 1}번으로 이동`}
          aria-current={activeIndex === index}
          onClick={() => goTo(index)}
        />
      ))}
    </Pager>
  );

  const heroSlot = (adNumber: number, compact = false) => (
    <HeroCard
      type="button"
      compact={compact}
      onClick={() => openDetail(adNumber)}
      aria-label={`홈 상단 배너 광고 ${adNumber}번 자리`}
    >
      <HeroLabel compact={compact}>하루 광고비</HeroLabel>
      <HeroPrice compact={compact}>
        {pricing ? `${dailyPrice.toLocaleString()}원` : '단가 확인 중'}
      </HeroPrice>
    </HeroCard>
  );

  const railSlots = (loopIndexes: number[]) =>
    loopIndexes.map((item, position) => (
      <div key={`${item}-${position}`}>{heroSlot(item + 1)}</div>
    ));

  return (
    <Screen>
      {loadError && <p role="alert">{loadError}</p>}
      <p>
        기존 광고 계약의 금액과 기간은 유지됩니다. 단가 변경 시 기존 계약자에게 안내하며, 변경된
        금액은 새 계약부터 적용됩니다.
      </p>
      <ViewSwitch>
        <ViewSwitchGroup role="tablist" aria-label="미리보기 화면 전환">
          <ViewButton
            type="button"
            role="tab"
            aria-selected={view === 'mobile'}
            active={view === 'mobile'}
            onClick={() => setView('mobile')}
          >
            모바일 뷰
          </ViewButton>
          <ViewButton
            type="button"
            role="tab"
            aria-selected={view === 'pc'}
            active={view === 'pc'}
            onClick={() => setView('pc')}
          >
            PC 뷰
          </ViewButton>
        </ViewSwitchGroup>
      </ViewSwitch>

      <PreviewStage>
        {view === 'pc' ? (
          <PcMock>
            <MovingAds ariaLabel="홈 상단 광고" itemCount={AD_COUNT} interval={AD_INTERVAL}>
              {({
                activeIndex,
                goTo,
                loopIndexes,
                railIndex,
                shouldAnimate,
                handleTransitionEnd,
              }) => (
                <div>
                  <HeroViewport>
                    <CenterRail
                      index={railIndex}
                      animate={shouldAnimate}
                      step={PC_HERO_STEP}
                      itemWidth={PC_HERO_CARD}
                      center={PC_HERO_CENTER}
                      gap={PC_HERO_GAP}
                      onTransitionEnd={handleTransitionEnd}
                    >
                      {railSlots(loopIndexes)}
                    </CenterRail>
                  </HeroViewport>
                  {renderDots(activeIndex, '상단 광고', goTo)}
                </div>
              )}
            </MovingAds>
            <Sections>
              <StaticContent>
                <SectionStack>
                  <FilterRow>
                    <Dropdown
                      aria-label="분야"
                      size="S"
                      width={104}
                      defaultValue="분야"
                      options={[
                        { value: '분야', label: '분야' },
                        { value: 'IT/SW', label: 'IT/SW' },
                        { value: '디자인', label: '디자인' },
                      ]}
                    />
                    <Dropdown
                      aria-label="연도"
                      size="S"
                      width={104}
                      defaultValue="2025년"
                      options={[
                        { value: '2025년', label: '2025년' },
                        { value: '2024년', label: '2024년' },
                      ]}
                    />
                    <Dropdown
                      aria-label="수상등급"
                      size="S"
                      width={104}
                      defaultValue="수상등급"
                      options={[
                        { value: '수상등급', label: '수상등급' },
                        { value: '대상', label: '대상' },
                        { value: '우수상', label: '우수상' },
                      ]}
                    />
                  </FilterRow>
                  <Section>
                    <SectionHeading title="지영님에게 맞는 AI 추천" />
                    <Rail aria-label="지영님에게 맞는 AI 추천 목록">
                      {desktopContests.slice(0, 6).map((contest) => (
                        <ContestCard key={contest.id} contest={contest} />
                      ))}
                    </Rail>
                  </Section>
                  <Section>
                    <SectionHeading title="마감임박 D-7" />
                    <Rail aria-label="마감임박 목록">
                      {desktopContests.slice(0, 6).map((contest) => (
                        <ContestCard key={`closing-${contest.id}`} contest={contest} />
                      ))}
                    </Rail>
                  </Section>
                </SectionStack>
              </StaticContent>
              <MovingAds
                ariaLabel="홈 중간 이미지 광고"
                itemCount={AD_COUNT}
                interval={AD_INTERVAL}
              >
                {({
                  activeIndex,
                  goTo,
                  loopIndexes,
                  railIndex,
                  shouldAnimate,
                  handleTransitionEnd,
                }) => (
                  <div>
                    <GalleryViewport>
                      <CenterRail
                        index={railIndex}
                        animate={shouldAnimate}
                        step={PC_GALLERY_STEP}
                        itemWidth={PC_GALLERY_ITEM}
                        center={PC_GALLERY_CENTER}
                        gap={PC_GALLERY_GAP}
                        onTransitionEnd={handleTransitionEnd}
                      >
                        {loopIndexes.map((item, position) => (
                          <GalleryItem key={`${item}-${position}`}>
                            <GalleryNumber>광고 {item + 1}</GalleryNumber>
                          </GalleryItem>
                        ))}
                      </CenterRail>
                    </GalleryViewport>
                    {renderDots(activeIndex, '중간 광고', goTo)}
                  </div>
                )}
              </MovingAds>
              <StaticContent>
                <TeamGrid>
                  {teams.slice(0, 3).map((team) => (
                    <TeamCard key={team.id} team={team} />
                  ))}
                </TeamGrid>
              </StaticContent>
            </Sections>
          </PcMock>
        ) : (
          <MobileMock>
            <MovingAds ariaLabel="홈 상단 광고" itemCount={AD_COUNT} interval={AD_INTERVAL}>
              {({
                activeIndex,
                goTo,
                loopIndexes,
                railIndex,
                shouldAnimate,
                handleTransitionEnd,
              }) => (
                <div>
                  <HeroViewport>
                    <MobileHeroRail
                      index={railIndex}
                      animate={shouldAnimate}
                      onTransitionEnd={handleTransitionEnd}
                    >
                      {loopIndexes.map((item, position) => (
                        <div key={`${item}-${position}`}>{heroSlot(item + 1, true)}</div>
                      ))}
                    </MobileHeroRail>
                  </HeroViewport>
                  {renderDots(activeIndex, '상단 광고', goTo)}
                </div>
              )}
            </MovingAds>
            <MobileBody>
              <StaticContent>
                <Section>
                  <SectionHeading title="지영님에게 맞는 AI 추천" />
                  <MobileRail aria-label="지영님에게 맞는 AI 추천 목록">
                    {desktopContests.slice(0, 6).map((contest) => (
                      <ContestCard key={contest.id} contest={contest} />
                    ))}
                  </MobileRail>
                </Section>
                <Section>
                  <SectionHeading title="마감임박 D-7" />
                  <MobileRail aria-label="마감임박 목록">
                    {desktopContests.slice(0, 6).map((contest) => (
                      <ContestCard key={`closing-${contest.id}`} contest={contest} />
                    ))}
                  </MobileRail>
                </Section>
              </StaticContent>
              <MovingAds
                ariaLabel="홈 중간 이미지 광고"
                itemCount={AD_COUNT}
                interval={AD_INTERVAL}
              >
                {({
                  activeIndex,
                  goTo,
                  loopIndexes,
                  railIndex,
                  shouldAnimate,
                  handleTransitionEnd,
                }) => (
                  <div>
                    <GalleryViewport>
                      <CenterRail
                        index={railIndex}
                        animate={shouldAnimate}
                        step={MOBILE_GALLERY_STEP}
                        itemWidth={MOBILE_GALLERY_ITEM}
                        center={MOBILE_GALLERY_CENTER}
                        gap={MOBILE_GALLERY_GAP}
                        onTransitionEnd={handleTransitionEnd}
                      >
                        {loopIndexes.map((item, position) => (
                          <MobileGalleryItem key={`${item}-${position}`}>
                            <GalleryNumber>광고 {item + 1}</GalleryNumber>
                          </MobileGalleryItem>
                        ))}
                      </CenterRail>
                    </GalleryViewport>
                    {renderDots(activeIndex, '중간 광고', goTo)}
                  </div>
                )}
              </MovingAds>
              <StaticContent>
                <TeamStack>
                  {teams.slice(0, 3).map((team) => (
                    <TeamCard key={team.id} team={team} />
                  ))}
                </TeamStack>
              </StaticContent>
            </MobileBody>
          </MobileMock>
        )}
      </PreviewStage>

      {dialogOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <Backdrop
            role="presentation"
            onMouseDown={() => {
              if (editing) setEditing(false);
              else setDetailAd(null);
            }}
          >
            <Dialog
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              onMouseDown={(event) => event.stopPropagation()}
            >
              {editing ? (
                <DialogBody>
                  <DialogTitle id={titleId}>광고비 수정</DialogTitle>
                  <ModalText>
                    홈 상단 배너 상품의 새 계약에 적용할 하루 광고비를 설정해 주세요. 기존 계약의
                    결제 금액은 유지됩니다.
                  </ModalText>
                  <label style={{ display: 'grid', gap: 8 }} htmlFor={inputId}>
                    <span style={{ ...textStyle.subtitle, color: '#101010' }}>하루 광고비</span>
                    <PriceField>
                      <PriceInput
                        id={inputId}
                        inputMode="numeric"
                        autoFocus
                        value={draft ? Number(digitsOnly(draft)).toLocaleString() : ''}
                        onChange={(event) => setDraft(digitsOnly(event.target.value))}
                        aria-label="하루 광고비"
                      />
                      <Won>원</Won>
                    </PriceField>
                  </label>
                  <DialogActions>
                    <DialogButton type="button" onClick={() => setEditing(false)}>
                      취소
                    </DialogButton>
                    <DialogButton
                      type="button"
                      primary
                      disabled={saving || !pricing}
                      onClick={savePrice}
                    >
                      {saving ? '저장 중…' : '저장'}
                    </DialogButton>
                  </DialogActions>
                </DialogBody>
              ) : (
                <>
                  <DialogThumb aria-hidden="true" />
                  <DialogBody>
                    <DialogTitle id={titleId}>빅배너 -{detailAd}번 금액</DialogTitle>
                    <InfoRow>
                      <InfoList>
                        <InfoItem>
                          <InfoLabel>현재 광고사</InfoLabel>
                          <InfoValue>{pricing?.organization ?? '현재 광고 없음'}</InfoValue>
                        </InfoItem>
                        <InfoItem>
                          <InfoLabel>광고 기간</InfoLabel>
                          <InfoValue>{pricing?.period ?? '-'}</InfoValue>
                        </InfoItem>
                      </InfoList>
                      <ReportLink href={`/admin/analytics?ad=${detailAd}`}>리포트 보기</ReportLink>
                    </InfoRow>
                    <DialogActions>
                      <DialogButton type="button" onClick={() => setDetailAd(null)}>
                        취소
                      </DialogButton>
                      <DialogButton type="button" primary onClick={startEditing}>
                        금액 수정하기
                      </DialogButton>
                    </DialogActions>
                  </DialogBody>
                </>
              )}
            </Dialog>
          </Backdrop>,
          document.body,
        )}
    </Screen>
  );
}
