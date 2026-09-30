import type { generated } from '@semochal/api-client';

// GET /people 응답의 카드 한 장 — 생성 클라이언트 훅의 응답 타입에서 유도한다.
type ListPeopleResult = Awaited<ReturnType<typeof generated.listPeople>>;
export type PersonCardModel = Extract<ListPeopleResult, { status: 200 }>['data'][number];
