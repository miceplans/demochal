'use client';
import { useRouter } from 'next/navigation';
import {
  BizContent,
  SectionHeader,
  SectionTitle,
  PrimaryButton,
  useBizHref,
} from '@/components/biz/BizShell';
import { BizChallengesTable } from '@/features/challenges/components/BizChallengesTable';

export function BizPostingsPage() {
  const router = useRouter();
  const hrefOf = useBizHref();
  return (
    <BizContent>
      <SectionHeader>
        <SectionTitle>공고 관리</SectionTitle>
        <PrimaryButton onClick={() => router.push(hrefOf('/postings/new'))}>
          새 공고 등록
        </PrimaryButton>
      </SectionHeader>
      <BizChallengesTable />
    </BizContent>
  );
}
