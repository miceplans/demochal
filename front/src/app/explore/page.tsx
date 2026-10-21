import { ExplorePage } from '@/components/contests/ExplorePage';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  return <ExplorePage key={category ?? ''} initialCategory={category} />;
}
