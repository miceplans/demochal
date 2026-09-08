'use client';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { BizGlobalStyles, BizFooter, BizLink, Logo } from '@/components/biz/BizShell';
import { flowSteps, operationSteps, serviceCards } from '@/data/biz-design';

const Hero = styled.section({
  background:
    'radial-gradient(circle at 50% 89%, rgba(255,255,255,0) 65%, rgba(254,255,220,1) 77%, rgba(0,111,255,1) 91%, rgba(25,31,40,1) 100%)',
  padding: '120px 80px',
  display: 'flex',
  flexDirection: 'column',
  gap: 80,
});
const HeroCopy = styled.div({ display: 'flex', flexDirection: 'column', gap: 18 });
const HeroTitle = styled.h1({ ...textStyle.display, fontWeight: 400 });
const BrandRow = styled.div({ display: 'flex', alignItems: 'center', gap: 18 });
const CtaRow = styled.div({ display: 'flex', gap: 8 });
const Join = styled(BizLink)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 130,
  height: 37,
  borderRadius: 6,
  background: c.primary,
  color: c.white,
  ...textStyle.subtitle,
});
const Consult = styled(BizLink)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 130,
  height: 37,
  borderRadius: 6,
  background: c.white,
  border: `1px solid ${c.gray200}`,
  ...textStyle.overline,
});
const Flow = styled.div({
  margin: '0 80px',
  border: `1px solid ${c.gray500}`,
  borderRadius: 12,
  padding: 18,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
});
const FlowLabel = styled.span({ ...textStyle.overline, color: c.gray700 });
const FlowRow = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  ...textStyle.overline,
});
const Intro = styled.section({
  background: 'linear-gradient(180deg, #000 74%, rgba(0,0,0,0) 97%)',
  padding: '200px 80px',
  display: 'flex',
  flexDirection: 'column',
  gap: 64,
});
const IntroLabel = styled.span({ ...textStyle.overline, color: c.gray700 });
const IntroTitle = styled.h2({ ...textStyle.display, color: c.white });
const Cards = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 28,
});
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
const OpsTileMark = styled.span({
  position: 'absolute',
  right: 16,
  bottom: 14,
  width: 44,
  height: 44,
  borderRadius: '50%',
  background: 'radial-gradient(circle at 30% 30%, rgba(254,255,220,0.9), rgba(0,111,255,0.85))',
  opacity: 0.8,
});

export function BizLanding() {
  return (
    <>
      {BizGlobalStyles}
      <Hero>
        <HeroCopy>
          <HeroTitle>쉬운 행사 관리</HeroTitle>
          <BrandRow>
            <Logo size={40} />
            <span style={{ ...textStyle.display }}>에서 시작해보세요!</span>
          </BrandRow>
        </HeroCopy>
        <CtaRow>
          <Join href="/login">지금 가입하기</Join>
          <Consult href="/login">상담받기</Consult>
        </CtaRow>
        <Flow>
          <FlowLabel>이용 과정</FlowLabel>
          <FlowRow>
            {flowSteps.map((step, i) => (
              <span key={step}>
                {i > 0 && (
                  <span aria-hidden style={{ color: c.gray300, margin: '0 6px' }}>
                    →
                  </span>
                )}
                {step}
              </span>
            ))}
          </FlowRow>
        </Flow>
      </Hero>
      <Intro>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <IntroLabel>서비스 소개</IntroLabel>
          <IntroTitle>등록부터 홍보, 성과 확인, 운영대행까지 연결됩니다</IntroTitle>
        </div>
        <Cards>
          {serviceCards.map((card) => (
            <Card key={card.title}>
              <CardTitle>{card.title}</CardTitle>
              <CardDesc>{card.desc}</CardDesc>
            </Card>
          ))}
        </Cards>
      </Intro>
      <Ops>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <FlowLabel>운영대행 서비스</FlowLabel>
          <OpsTitle>기획부터 결과 보고까지 필요한 단계만 말길 수 있습니다</OpsTitle>
        </div>
        <OpsGrid>
          {operationSteps.map((step) => (
            <OpsTile key={step}>
              {step}
              <OpsTileMark aria-hidden />
            </OpsTile>
          ))}
        </OpsGrid>
      </Ops>
      <BizFooter />
    </>
  );
}
