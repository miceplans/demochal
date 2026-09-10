'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type LocomotiveScroll from 'locomotive-scroll';
import styled from '@emotion/styled';
import { colors as c, mobile } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { BizGlobalStyles, BizFooter, BizLink, BizLandingHeader, Logo } from '@/components/biz/BizShell';
import { DriftWall, type DriftWallItem } from '@/components/biz/DriftWall';
import { operationSteps, serviceCards } from '@/data/biz-design';

const Hero = styled.section({
  background:
    'var(--SEMO-Gradient, radial-gradient(92.85% 92.82% at 50% 88.52%, rgba(255, 255, 255, 0.00) 65.22%, #FEFFDC 76.92%, #006FFF 91.35%, #191F28 100%))',
  padding: '120px 80px',
  display: 'flex',
  minHeight: '100vh',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 120,
});
const HeroCopy = styled.div({ display: 'flex', flexDirection: 'column', gap: 36 });
const HeroTitle = styled.h1({ ...textStyle.display, fontWeight: 400 });
const BrandRow = styled.div({ display: 'flex', alignItems: 'center', gap: 36 });
const CtaRow = styled.div({ display: 'flex', gap: 16 });
const Join = styled(BizLink)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 180,
  height: 52,
  borderRadius: 6,
  background: c.primary,
  color: c.white,
  ...textStyle.subtitle,
  fontSize: 18,
});
const Consult = styled(BizLink)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 180,
  height: 52,
  borderRadius: 6,
  background: c.white,
  border: `1px solid ${c.gray200}`,
  ...textStyle.overline,
  fontSize: 17,
});
const FlowLabel = styled.span({ ...textStyle.overline, color: c.gray700 });
const Intro = styled.section({
  background:
    'linear-gradient(180deg, #ffffff 0%, #f0f4fb 10%, #c8d8f6 20%, #40589a 30%, #191f28 40%, #0b0c13 58%, #101018 76%, #ffffff 100%)',
  minHeight: '132vh',
  position: 'relative',
  overflow: 'hidden',
  scrollSnapAlign: 'start',
  [mobile]: { minHeight: 'auto' },
});
const IntroLabel = styled.span({ ...textStyle.overline, color: c.gray700 });
const IntroTitle = styled.h2({ ...textStyle.display, color: c.white });
const Cards = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 28,
  [mobile]: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 },
});
const StoryCard = styled.div({ willChange: 'transform' });
const Card = styled.div({
  border: `1px solid ${c.gray500}`,
  borderRadius: 12,
  background: c.white,
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
});
const CardTitle = styled.h3(textStyle.h3);
const CardDesc = styled.p({ ...textStyle.metaText, color: c.gray700 });
const Ops = styled.section({
  padding: '120px 80px',
  display: 'flex',
  flexDirection: 'column',
  gap: 28,
});
const OpsTitle = styled.h2(textStyle.display);
const OpsGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 18,
});
const OpsTile = styled.div({
  height: 176,
  background: '#f8f8f8',
  borderRadius: 6,
  position: 'relative',
  ...textStyle.display,
  fontWeight: 700,
  padding: '18px 16px',
});
const OpsTileIcon = styled.img({
  position: 'absolute',
  right: 16,
  bottom: 14,
  width: 'auto',
  height: 76,
  maxWidth: '55%',
  objectFit: 'contain',
  objectPosition: 'right bottom',
});

const Reveal = styled.div<{ visible: boolean }>(({ visible }) => ({
  '& [data-reveal-item]': {
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(28px)',
    transition: 'opacity 620ms cubic-bezier(0.22, 1, 0.36, 1), transform 620ms cubic-bezier(0.22, 1, 0.36, 1)',
  },
  '& [data-reveal-item]:nth-of-type(2)': { transitionDelay: visible ? '100ms' : '0ms' },
  '& [data-reveal-item]:nth-of-type(3)': { transitionDelay: visible ? '200ms' : '0ms' },
  '& [data-reveal-item]:nth-of-type(4)': { transitionDelay: visible ? '300ms' : '0ms' },
  '& [data-reveal-item]:nth-of-type(5)': { transitionDelay: visible ? '400ms' : '0ms' },
  '@media (prefers-reduced-motion: reduce)': {
    '& [data-reveal-item]': {
      opacity: 1,
      transform: 'none',
      transition: 'none',
    },
  },
}));

function RevealOnScroll({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.14 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Reveal ref={ref} visible={visible} className={className}>
      {children}
    </Reveal>
  );
}

const IntroReveal = styled(RevealOnScroll)({
  display: 'flex',
  flexDirection: 'column',
  gap: 64,
  zIndex: 1,
  minHeight: '100vh',
  padding: '80px',
  justifyContent: 'center',
  alignItems: 'center',
  position: 'sticky',
  top: 0,
  '& > *': { width: '100%', maxWidth: 1200 },
  [mobile]: { minHeight: 'auto', padding: '120px 16px', position: 'relative', gap: 36 },
});
const OpsReveal = styled(RevealOnScroll)({
  display: 'flex',
  flexDirection: 'column',
  gap: 28,
});
const IntroBackdrop = styled.div({
  position: 'absolute',
  inset: '-3% 0',
  pointerEvents: 'none',
  zIndex: 0,
  '& > div': { height: '100%' },
  WebkitMaskImage:
    'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.94) 32%, #000000 46%, #000000 64%, rgba(0,0,0,0.86) 78%, transparent 100%)',
  maskImage:
    'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.94) 32%, #000000 46%, #000000 64%, rgba(0,0,0,0.86) 78%, transparent 100%)',
});

const marketingWallItems: DriftWallItem[] = [
  { image: '/assets/marketing/20260106094601_b8e20646fcbee92c1af44d84c36a93b7.jpg', title: '행사 현장' },
  { image: '/assets/marketing/20260106092933_3ebed32cf4087a5572de6508f7f03ba4.jpg', title: '행사 프로그램' },
  { image: '/assets/marketing/20260106093101_bbbe2da73ae39d285be65d0a7036e17b.jpg', title: '참가자 경험' },
  { image: '/assets/marketing/20260106094035_287ee8162ac77e2c1b3ae85dae5891db.jpg', title: '브랜드 이벤트' },
  { image: '/assets/marketing/20260106093234_fdad2fc1267991ab5ad848ba0520f1fb.jpg', title: '무대 행사' },
  { image: '/assets/marketing/20260105165859_22a1a3377c734cf7b25b82acd1b5427c.jpg', title: '현장 운영' },
  { image: '/assets/marketing/20260106095026_bf2f23432086c175d5a891272f4739d2.jpg', title: '행사 공간' },
  { image: '/assets/marketing/20250211134854_7cb7bfcaa55a265897a1510943a43a60.jpg', title: '행사 네트워크' },
];
const operationIcons = [
  '/assets/LandingIcons/LandingDocuments.png',
  '/assets/LandingIcons/LandingMegaphone.png',
  '/assets/LandingIcons/LandingApplicant.png',
  '/assets/LandingIcons/LandingCheck.png',
  '/assets/LandingIcons/LandingAward.png',
  '/assets/LandingIcons/LandingPerson.png',
];

export function BizLanding() {
  useEffect(() => {
    document.documentElement.classList.add('biz-landing-scroll');
    return () => document.documentElement.classList.remove('biz-landing-scroll');
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let instance: LocomotiveScroll | undefined;
    let disposed = false;
    void import('locomotive-scroll').then(({ default: Locomotive }) => {
      if (disposed) return;
      instance = new Locomotive({ lenisOptions: { lerp: 0.08, smoothWheel: true } });
    });
    return () => {
      disposed = true;
      instance?.destroy();
    };
  }, []);

  return (
    <>
      {BizGlobalStyles}
      <BizLandingHeader />
      <RevealOnScroll>
        <Hero>
          <HeroCopy data-reveal-item>
            <HeroTitle>쉬운 행사 관리</HeroTitle>
            <BrandRow>
              <Logo size={80} />
              <span style={{ ...textStyle.display, fontSize: 48 }}>에서 시작해보세요!</span>
            </BrandRow>
          </HeroCopy>
          <CtaRow data-reveal-item>
            <Join href="/login">지금 가입하기</Join>
            <Consult href="/login">운영 문의하기</Consult>
          </CtaRow>
        </Hero>
      </RevealOnScroll>
      <Intro>
        <IntroBackdrop data-scroll data-scroll-speed="-0.22" aria-hidden>
          <DriftWall items={marketingWallItems} />
        </IntroBackdrop>
        <IntroReveal>
          <div data-reveal-item style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <IntroLabel>서비스 소개</IntroLabel>
            <IntroTitle>등록부터 홍보, 성과 확인, 운영대행까지 연결됩니다</IntroTitle>
          </div>
          <Cards>
            {serviceCards.map((card, index) => (
              <StoryCard data-scroll data-scroll-speed={`${0.04 + index * 0.025}`} key={card.title}>
                <Card data-reveal-item>
                  <CardTitle>{card.title}</CardTitle>
                  <CardDesc>{card.desc}</CardDesc>
                </Card>
              </StoryCard>
            ))}
          </Cards>
        </IntroReveal>
      </Intro>
      <Ops>
        <OpsReveal>
          <div data-reveal-item style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <FlowLabel>운영대행 서비스</FlowLabel>
            <OpsTitle>기획부터 결과 보고까지 필요한 단계만 말길 수 있습니다</OpsTitle>
          </div>
          <OpsGrid>
            {operationSteps.map((step, index) => (
              <OpsTile data-reveal-item key={step}>
                {step}
                <OpsTileIcon src={operationIcons[index]} alt="" aria-hidden />
              </OpsTile>
            ))}
          </OpsGrid>
        </OpsReveal>
      </Ops>
      <BizFooter />
    </>
  );
}
