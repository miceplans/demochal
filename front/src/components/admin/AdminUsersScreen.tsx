'use client';

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { useQueryClient } from '@tanstack/react-query';
import { generated } from '@semochal/api-client';
import { maskEmail } from '@/lib/mask';
import { MaskedText } from '@/components/ui/MaskedText';
import { useToast } from '@/components/common/Toast';
import type { UserRow } from '@/data/admin-design';
import { colors as c } from '@/styles/design';
import { textStyle } from '@/styles/typography';
import {
  AdminInlineNotice,
  AdminPageTitle,
  AdminTable,
  Badge,
  FilterBar,
  SearchFilter,
  SelectFilter,
  type AdminColumn,
} from './parts';

const statusOptionToParam: Record<string, 'active' | 'suspended'> = {
  활성: 'active',
  정지: 'suspended',
};

const joinedWithinOptionToParam: Record<string, '7d' | '30d' | '1y'> = {
  '최근 7일': '7d',
  '최근 30일': '30d',
  '최근 1년': '1y',
};

const ALL = '전체';

export function AdminUsersScreen() {
  const [query, setQuery] = useState('');
  const [statusLabel, setStatusLabel] = useState('');
  const [joinedWithinLabel, setJoinedWithinLabel] = useState('');
  const [position, setPosition] = useState('');
  const [suspendTarget, setSuspendTarget] = useState<UserRow | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const toast = useToast();
  const queryClient = useQueryClient();

  const usersQuery = generated.useListAdminUsers({
    q: query || undefined,
    status: statusOptionToParam[statusLabel],
    joinedWithin: joinedWithinOptionToParam[joinedWithinLabel],
    position: position && position !== ALL ? position : undefined,
  });

  const closeSuspend = () => {
    setSuspendTarget(null);
    setSuspendReason('');
  };

  const suspendMutation = generated.useSuspendUser({
    mutation: {
      onSuccess: (_response, variables) => {
        toast.success(variables.data.suspended ? '사용자를 정지했어요' : '정지를 해제했어요');
        closeSuspend();
        // 활동 상태 필터에 따라 행이 빠질 수 있으므로 사용자 목록 쿼리 전체를 다시 받는다.
        void queryClient.invalidateQueries({ queryKey: generated.getListAdminUsersQueryKey() });
      },
      onError: () => toast.error('사용자 상태 변경에 실패했어요', '잠시 후 다시 시도해주세요'),
    },
  });

  const rows = useMemo<UserRow[]>(
    () =>
      (usersQuery.data?.data ?? []).map((user, index) => ({
        id: user.id ?? String(index),
        name: user.name ?? '',
        email: user.email ?? '',
        position: user.position ?? '',
        reports: user.reports ?? 0,
        status: user.status === 'suspended' ? '정지' : '활성',
      })),
    [usersQuery.data],
  );

  const columns: AdminColumn<UserRow>[] = [
    { key: 'name', header: '이름', width: 100 },
    {
      key: 'email',
      header: '이메일',
      width: 200,
      render: (row) => <MaskedText value={row.email} masked={maskEmail(row.email)} />,
    },
    { key: 'position', header: '포지션', width: 100 },
    { key: 'reports', header: '신고 누적', width: 80 },
    {
      key: 'status',
      header: '상태',
      width: 80,
      render: (row) => <Badge tone={row.status === '활성' ? 'blue' : 'red'}>{row.status}</Badge>,
    },
    {
      key: 'action',
      header: '관리',
      width: 80,
      render: (row) =>
        row.status === '활성' ? (
          <RowButton type="button" danger onClick={() => setSuspendTarget(row)}>
            정지
          </RowButton>
        ) : (
          <RowButton
            type="button"
            disabled={suspendMutation.isPending}
            onClick={() => suspendMutation.mutate({ id: row.id, data: { suspended: false } })}
          >
            해제
          </RowButton>
        ),
    },
  ];

  return (
    <>
      <AdminPageTitle>사용자 관리</AdminPageTitle>
      <FilterBar>
        <SearchFilter
          placeholder="이름/이메일 검색"
          label="이름/이메일 검색"
          value={query}
          onChange={setQuery}
        />
        <SelectFilter
          label="가입일 범위"
          options={['최근 7일', '최근 30일', '최근 1년', ALL]}
          value={joinedWithinLabel}
          onChange={setJoinedWithinLabel}
        />
        <SelectFilter
          label="포지션 뱃지"
          options={[ALL, '기획', '프론트엔드', '백엔드', '디자이너']}
          value={position}
          onChange={setPosition}
        />
        <SelectFilter
          label="활동 상태"
          options={['활성', '정지']}
          value={statusLabel}
          onChange={setStatusLabel}
        />
      </FilterBar>
      {usersQuery.isPending ? (
        <AdminInlineNotice>불러오는 중...</AdminInlineNotice>
      ) : (
        <AdminTable columns={columns} rows={rows} />
      )}
      {suspendTarget &&
        typeof document !== 'undefined' &&
        createPortal(
          <Backdrop role="presentation" onMouseDown={closeSuspend}>
            <Modal
              role="dialog"
              aria-modal="true"
              aria-labelledby="user-suspend-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <ModalTitle id="user-suspend-title">{suspendTarget.name} 님을 정지할까요?</ModalTitle>
              <ModalText>정지된 사용자는 서비스를 이용할 수 없어요.</ModalText>
              <ReasonLabel htmlFor="user-suspend-reason">정지 사유</ReasonLabel>
              <ReasonTextarea
                id="user-suspend-reason"
                value={suspendReason}
                onChange={(event) => setSuspendReason(event.target.value)}
                placeholder="정지 사유를 입력해주세요"
                rows={3}
              />
              <ModalActions>
                <RowButton type="button" onClick={closeSuspend}>
                  취소
                </RowButton>
                <RowButton
                  type="button"
                  danger
                  disabled={suspendMutation.isPending || !suspendReason.trim()}
                  onClick={() =>
                    suspendMutation.mutate({
                      id: suspendTarget.id,
                      data: { suspended: true, reason: suspendReason.trim() },
                    })
                  }
                >
                  {suspendMutation.isPending ? '처리 중…' : '정지'}
                </RowButton>
              </ModalActions>
            </Modal>
          </Backdrop>,
          document.body,
        )}
    </>
  );
}

const RowButton = styled('button', { shouldForwardProp: (prop) => prop !== 'danger' })<{
  danger?: boolean;
}>(({ danger }) => ({
  height: 32,
  padding: '0 12px',
  border: `1px solid ${danger ? c.red : c.gray300}`,
  borderRadius: 6,
  background: c.white,
  color: danger ? c.red : c.gray700,
  cursor: 'pointer',
  ...textStyle.buttonLabel,
  '&:hover:not(:disabled)': { background: c.gray50 },
  '&:disabled': { opacity: 0.5, cursor: 'not-allowed' },
}));

const Backdrop = styled.div({
  position: 'fixed',
  zIndex: 100,
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  background: 'rgba(17, 24, 39, .46)',
});
const Modal = styled.div({
  display: 'flex',
  flexDirection: 'column',
  width: 'min(100%, 416px)',
  padding: 28,
  borderRadius: 12,
  background: c.white,
  boxShadow: '0 20px 48px rgba(17, 24, 39, .22)',
});
const ModalTitle = styled.h2({ margin: 0, ...textStyle.h2_2, color: c.gray900 });
const ModalText = styled.p({ margin: '8px 0 0', color: c.gray500, ...textStyle.body });
const ReasonLabel = styled.label({ marginTop: 20, ...textStyle.metaText, color: c.gray500 });
const ReasonTextarea = styled.textarea({
  marginTop: 8,
  resize: 'vertical',
  padding: '10px 12px',
  border: `1px solid ${c.gray300}`,
  borderRadius: 8,
  color: c.gray900,
  ...textStyle.bodySmall,
  '&:focus': { outline: 'none', borderColor: c.primary },
});
const ModalActions = styled.div({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  marginTop: 24,
});
