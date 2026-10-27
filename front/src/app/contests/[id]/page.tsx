import type { Metadata } from 'next';
import { ContestDetailPage } from '@/components/contests/ContestDetailPage';
import { DEFAULT_SITE_ORIGIN, SITE_ORIGIN } from '@/lib/biz';
import { JsonLd } from '@/lib/JsonLd';
import { pageMetadata } from '@/lib/seo';
import { loadPublishedChallenge } from './load-challenge';

type Props = { params: Promise<{ id: string }> };

const ORIGIN = SITE_ORIGIN || DEFAULT_SITE_ORIGIN;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const challenge = await loadPublishedChallenge(id);
  if (!challenge) return { robots: { index: false, follow: false } };
  const summary = (challenge.summary ?? challenge.description ?? '').replace(/\s+/g, ' ').trim();
  const description = `${challenge.title} - ${summary || '공모전 일정·자격·시상 정보'}`.slice(
    0,
    150,
  );
  const base = pageMetadata({
    title: `${challenge.title} - 공모전 정보`,
    description,
    path: `/contests/${id}`,
    keywords: [challenge.title, ...(challenge.hashtags ?? [])],
  });
  return {
    ...base,
    openGraph: {
      ...base.openGraph,
      type: 'article',
      images: challenge.posterUrl ? [{ url: challenge.posterUrl }] : undefined,
    },
  };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const challenge = await loadPublishedChallenge(id);
  return (
    <>
      {challenge?.eventStartDate && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'Event',
            name: challenge.title,
            description: (challenge.summary ?? challenge.description ?? '').slice(0, 300),
            url: `${ORIGIN}/contests/${id}`,
            image: challenge.posterUrl ?? undefined,
            // 행사 일정이 없으면 접수 기간으로 대체하지 않고 Event 마크업을 생략한다. 온/오프라인 구분 필드가 없어 개최 방식·장소도 쓰지 않는다.
            startDate: challenge.eventStartDate,
            endDate: challenge.eventEndDate ?? undefined,
            eventStatus: 'https://schema.org/EventScheduled',
            organizer: challenge.organizer
              ? { '@type': 'Organization', name: challenge.organizer }
              : undefined,
            offers: {
              '@type': 'Offer',
              url: `${ORIGIN}/contests/${id}`,
              price: challenge.price ?? 0,
              priceCurrency: 'KRW',
              availability: 'https://schema.org/InStock',
              validThrough: challenge.endDate,
            },
          }}
        />
      )}
      <ContestDetailPage challengeId={id} />
    </>
  );
}
