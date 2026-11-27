'use client';
import { useMemo, useState } from 'react';
import styled from '@emotion/styled';
import { useQueryClient } from '@tanstack/react-query';
import { MyShell } from '@/components/common/UserShell';
import {
  Button,
  Chip,
  DesktopOnly,
  Stack,
  Wrap,
  Title,
  Heading,
  Muted,
} from '@/components/common/Primitives';
import { preferenceGroups } from '@/data/user-design';
import { useToast } from '@/components/common/Toast';
import { generated } from '@semochal/api-client';

export function InterestsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  // 관심분야는 서버 값이 기준이다. 브라우저에 남은 기본값이나 다른 계정의 값으로 덮어쓰지
  // 않도록, 서버 값을 받은 뒤에만 편집/저장할 수 있게 한다.
  // (선호 역할/참가 대상 칩은 서버 저장 필드가 없는 죽은 UI라 제거했다 — #278)
  const interestsQuery = generated.useGetInterests();
  const [editedInterests, setEditedInterests] = useState<string[] | null>(null);
  const interests = editedInterests ?? interestsQuery.data?.data.categories ?? [];
  const interestsReady = interestsQuery.isSuccess;
  const saveInterests = generated.useSaveInterests();
  const isSelected = (value: string) => interests.includes(value);
  // 온볼딩에서 선택한 관심분야는 칩 기본 옵션 어휘와 다를 수 있다('IT/SW', '취업' 등 —
  // design-copy.json fields). 서버가 내준 값 중 옵션에 없는 것도 칩으로 표시해
  // 해제/재선택이 가능하게 한다. 이 화면에서 본 서버 값을 누적해 두어, 해제·저장 후
  // 재조회돼 서버 목록에서 빠져도 칩이 사라지지 않고 다시 선택할 수 있게 한다.
  const optionSet = useMemo(() => new Set(preferenceGroups.flatMap((g) => g.options)), []);
  const serverCategories = interestsQuery.data?.data.categories;
  // 파생 상태 조정 패턴: 서버 목록이 바뀌는 렌더에서만 누적 값을 갱신한다.
  const [seen, setSeen] = useState<{ server: typeof serverCategories; extras: string[] }>(() => ({
    server: serverCategories,
    extras: serverCategories ? [...new Set(serverCategories)].filter((x) => !optionSet.has(x)) : [],
  }));
  if (serverCategories !== seen.server) {
    setSeen({
      server: serverCategories,
      extras: serverCategories
        ? [...new Set([...seen.extras, ...serverCategories])].filter((x) => !optionSet.has(x))
        : seen.extras,
    });
  }
  const extraOptions = seen.extras;
  const toggle = (value: string) => {
    if (!interestsReady) return;
    setEditedInterests(
      interests.includes(value) ? interests.filter((x) => x !== value) : [...interests, value],
    );
  };
  // 빈 관심분야는 저장하지 않는다. 빈 배열이 저장되면 GET /interests의 온볼딩 설문
  // 평백이 다시 발동해, 사용자가 비우려던 관심분야가 되살아난다(서버도 1개 이상 요구).
  const save = () => {
    if (!interestsReady || interests.length === 0) return;
    saveInterests.mutate(
      { data: { categories: interests } },
      {
        onSuccess: () => {
          toast.success('관심분야를 저장했어요');
          void queryClient.invalidateQueries({ queryKey: generated.getGetInterestsQueryKey() });
          void queryClient.invalidateQueries({
            queryKey: generated.getListRecommendedChallengesQueryKey(),
          });
        },
        onError: () => toast.error('관심분야를 저장하지 못했어요. 다시 시도해주세요.'),
      },
    );
  };
  return (
    <MyShell title="관심분야 설정">
      <Stack gap={24}>
        <DesktopOnly>
          <Title>관심분야 설정</Title>
        </DesktopOnly>
        <IntroText>관심 있는 분야를 선택하면 맞춤 챌린지와 팀 모집을 추천해드려요</IntroText>
        {preferenceGroups.map((g) => {
          const options = g.key === 'interests' ? [...g.options, ...extraOptions] : g.options;
          return (
            <Stack key={g.key} gap={12}>
              <Heading>{g.title}</Heading>
              <InterestOptions>
                {options.map((x) => (
                  <Chip
                    key={x}
                    selected={isSelected(x)}
                    aria-pressed={isSelected(x)}
                    disabled={!interestsReady}
                    onClick={() => toggle(x)}
                  >
                    {x}
                  </Chip>
                ))}
              </InterestOptions>
            </Stack>
          );
        })}
        {interestsQuery.isError && <Muted>관심분야를 불러오지 못했어요. 새로고침해주세요.</Muted>}
        <WideButton
          onClick={save}
          disabled={!interestsReady || interests.length === 0 || saveInterests.isPending}
        >
          저장하기
        </WideButton>
      </Stack>
    </MyShell>
  );
}

// Styles are kept together at the bottom so page behavior and layout definitions remain separate.
const IntroText = styled.p({ fontSize: 15 });
const InterestOptions = styled(Wrap)({ maxWidth: 550 });
const WideButton = styled(Button)({ width: 160 });
