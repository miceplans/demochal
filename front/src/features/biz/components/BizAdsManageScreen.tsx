'use client';

import { useRouter } from 'next/navigation';
import styled from '@emotion/styled';
import { LoadingState } from '@/components/common/LoadingState';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import { BizContent, OutlineButton, PrimaryButton, useBizHref } from '@/components/biz/BizShell';
import { Button } from '@/components/common/Primitives';
import { HeaderRow } from './BizAdsPage.styles';
import type { BizAdsController } from './useBizAdsController';

// 광고 관리(목록) 화면: 현재 광고 배너와 광고 관리 테이블, 행 단위 액션을 렌더링한다.
export function BizAdsManageScreen({ controller }: { controller: BizAdsController }) {
  const {
    priceNotices,
    currentAd,
    contracts,
    contractsLoading,
    contractsError,
    refetchContracts,
    pausingId,
    deletingId,
    pauseAd,
    deleteAd,
    isEnded,
    needsContent,
    statusLabel,
    openProducts,
    startContent,
  } = controller;
  const router = useRouter();
  const hrefOf = useBizHref();
  return (
    <ManageBody>
      {priceNotices.map((notice) => (
        <p role="status" key={notice.id}>
          {String(
            notice.payload.message ??
              '광고 단가가 변경되었습니다. 기존 계약의 금액과 기간은 유지됩니다.',
          )}
        </p>
      ))}
      <section
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        aria-labelledby="current-ad-title"
      >
        <HeaderRow>
          <h1 id="current-ad-title" style={{ margin: 0, ...textStyle.display }}>
            현재 나의 광고
          </h1>
          <span style={{ display: 'flex', gap: 8 }}>
            <OutlineButton type="button" onClick={openProducts}>
              수정하기
            </OutlineButton>
            <PrimaryButton type="button" onClick={() => router.push(hrefOf('/reports'))}>
              리포트 보기
            </PrimaryButton>
          </span>
        </HeaderRow>
        <CurrentBanner>
          {currentAd?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentAd.imageUrl} alt={currentAd.title} />
          ) : (
            <CurrentBannerEmpty>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/empty-contents.png" alt="" />
              <p>광고가 없어요</p>
            </CurrentBannerEmpty>
          )}
        </CurrentBanner>
      </section>
      <ManageSection aria-labelledby="ad-management-title">
        <HeaderRow>
          <h2 id="ad-management-title" style={{ margin: 0, ...textStyle.h1_2 }}>
            광고 관리
          </h2>
          <PrimaryButton type="button" onClick={openProducts}>
            광고 추가
          </PrimaryButton>
        </HeaderRow>
        <AdsTable role="table" aria-label="광고 관리 목록">
          <TableHead role="row">
            <span role="columnheader">제목 / 계약 기간</span>
            <span role="columnheader">계약 금액</span>
            <span role="columnheader" style={{ justifySelf: 'end', width: 80 }}>
              상태
            </span>
            <span role="columnheader" style={{ justifySelf: 'end' }}>
              관리
            </span>
          </TableHead>
          {contractsLoading && (
            <TableRow role="row">
              <FullSpan>
                <LoadingState compact label="광고 목록을 불러오는 중이에요." />
              </FullSpan>
            </TableRow>
          )}
          {!contractsLoading && contractsError && (
            <TableRow role="row">
              <span>
                광고 목록을 불러오지 못했어요.{' '}
                <button type="button" onClick={() => void refetchContracts()}>
                  다시 시도
                </button>
              </span>
            </TableRow>
          )}
          {!contractsLoading && !contractsError && contracts.length === 0 && (
            <TableRow role="row">
              <span>등록된 광고가 없어요. 광고를 추가해보세요.</span>
            </TableRow>
          )}
          {!contractsLoading &&
            !contractsError &&
            contracts.map((ad) => (
              <TableRow key={ad.id} role="row">
                <span role="cell">
                  {ad.title}
                  <small style={{ display: 'block' }}>
                    {ad.startDate.slice(0, 10)} ~ {ad.endDate.slice(0, 10)}
                  </small>
                </span>
                <span role="cell">{ad.paidAmount.toLocaleString()}원</span>
                <StatusCell role="cell" ended={isEnded(ad)}>
                  {statusLabel(ad)}
                </StatusCell>
                <span role="cell" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  {needsContent(ad) && (
                    <Button type="button" tone="outline" small onClick={() => startContent(ad)}>
                      이미지 등록
                    </Button>
                  )}
                  <Button
                    type="button"
                    tone="outline"
                    small
                    onClick={() =>
                      router.push(hrefOf(`/reports?adId=${encodeURIComponent(ad.id)}`))
                    }
                  >
                    리포트
                  </Button>
                  {ad.status === 'preparing' ? (
                    <Button
                      type="button"
                      tone="plain"
                      small
                      disabled={deletingId === ad.id}
                      onClick={() => void deleteAd(ad)}
                    >
                      {deletingId === ad.id ? '처리 중…' : '삭제'}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      tone="plain"
                      small
                      disabled={ad.status !== 'active' || needsContent(ad) || pausingId === ad.id}
                      onClick={() => void pauseAd(ad)}
                    >
                      {pausingId === ad.id ? '처리 중…' : '중단'}
                    </Button>
                  )}
                </span>
              </TableRow>
            ))}
        </AdsTable>
        <Footnote>
          기존 계약의 결제 금액과 기간은 단가가 변경되어도 유지됩니다. 새 계약에는 신청 시점의 최신
          단가가 적용됩니다.
        </Footnote>
      </ManageSection>
    </ManageBody>
  );
}

const ManageBody = styled(BizContent)({ maxWidth: 1100, gap: 48 });
const ManageSection = styled.section({ display: 'flex', flexDirection: 'column', gap: 16 });
const AdsTable = styled.div({
  overflow: 'hidden',
  border: `0.5px solid ${c.gray200}`,
  borderRadius: 12,
});
const TableRow = styled.div({
  display: 'grid',
  gridTemplateColumns: 'minmax(180px, 1fr) 180px 100px 140px',
  alignItems: 'center',
  minHeight: 56,
  padding: '0 16px',
  borderTop: `0.5px solid ${c.gray200}`,
  ...textStyle.body,
});
const FullSpan = styled.div({ gridColumn: '1 / -1' });
const TableHead = styled(TableRow)({
  minHeight: 48,
  borderTop: 0,
  background: c.gray100,
  ...textStyle.h1,
});
const CurrentBanner = styled.div({
  height: 236,
  borderRadius: 12,
  overflow: 'hidden',
  '& > img': { width: '100%', height: '100%', objectFit: 'cover' },
});
const CurrentBannerEmpty = styled.div({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  '& img': { width: 140, height: 'auto', objectFit: 'contain' },
  '& p': { margin: 0, color: c.gray500, ...textStyle.body },
});
const StatusCell = styled.span<{ ended: boolean }>(({ ended }) => ({
  justifySelf: 'end',
  width: 80,
  color: ended ? c.red : c.primary,
}));
const Footnote = styled.p({ margin: 0, ...textStyle.metaText, color: c.gray500 });
