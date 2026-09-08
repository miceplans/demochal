'use client';
import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { BizContent, SectionTitle, PrimaryButton } from '@/components/biz/BizShell';
import { operationSteps } from '@/data/biz-design';

const Grid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 18,
});
const Tile = styled.div({
  height: 176,
  background: '#f8f8f8',
  borderRadius: 6,
  position: 'relative',
  fontSize: 24,
  fontWeight: 700,
  padding: '18px 16px',
});
const TileMark = styled.span({
  position: 'absolute',
  right: 16,
  bottom: 14,
  width: 44,
  height: 44,
  borderRadius: '50%',
  background: 'radial-gradient(circle at 30% 30%, rgba(254,255,220,0.9), rgba(0,111,255,0.85))',
  opacity: 0.8,
});
const Desc = styled.p({ color: c.gray700, marginTop: 8, maxWidth: 700 });

export function BizOperationsPage() {
  return (
    <BizContent>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        <span style={{ ...textStyle.overline, color: c.gray700 }}>운영대행 서비스</span>
        <SectionTitle>기획부터 결과 보고까지 필요한 단계만 맡길 수 있습니다</SectionTitle>
        <Desc>
          챌린지 기획, 모집 홍보, 참가자 접수, 심사 운영, 시상식 운영, 결과 보고 중 필요한 범위를
          선택해 문의해주세요. 담당자가 1영업일 내에 연락드립니다.
        </Desc>
      </div>
      <Grid>
        {operationSteps.map((step) => (
          <Tile key={step}>
            {step}
            <TileMark aria-hidden />
          </Tile>
        ))}
      </Grid>
      <div>
        <PrimaryButton>운영대행 문의하기</PrimaryButton>
      </div>
    </BizContent>
  );
}
