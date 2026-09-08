import type { Metadata } from 'next';
import { Providers } from './providers';
import '../styles/tokens.css';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '세모챌',
    template: '%s | 세모챌',
  },
  description: '나에게 맞는 챌린지를 발견하고 함께 도전할 팀을 만나보세요.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
