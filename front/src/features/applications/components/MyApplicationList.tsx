'use client';

import styled from '@emotion/styled';
import { colors as c } from '@/styles/design';
import { useMyApplications } from '../api/queries';

const List = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
`;

const Item = styled.li`
  padding: 16px;
  border: 1px solid ${(p) => p.theme.colors.gray[200]};
  border-radius: 12px;
  background: ${c.white};
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
`;

const statusLabel = {
  pending: '대기중',
  approved: '승인',
  rejected: '반려',
  cancelled: '취소',
} as const;

export function MyApplicationList() {
  const { data, isPending, isError, error } = useMyApplications();

  if (isPending) return <p style={{ color: c.gray500 }}>불러오는 중...</p>;
  if (isError)
    return <p style={{ color: c.red }}>신청 내역을 불러오지 못했습니다. ({error.message})</p>;
  if (!data || data.length === 0) return <p style={{ color: c.gray500 }}>신청 내역이 없습니다.</p>;

  return (
    <List>
      {data.map((application) => (
        <Item key={application.id}>
          <span>챌린지 {application.challengeId}</span>
          <span>{statusLabel[application.status]}</span>
        </Item>
      ))}
    </List>
  );
}
