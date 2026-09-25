import './globals.css';
import Link from 'next/link';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'TOEFL 단어장',
  description: '개인용 TOEFL 단어 학습 서비스',
};

// The app is meant to be used on a phone as much as a laptop, so opt in to
// proper mobile scaling rather than the default desktop viewport.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const NAV = [
  { href: '/', label: '홈' },
  { href: '/words', label: '등록된 단어' },
  { href: '/words/new', label: '단어 등록' },
  { href: '/today', label: '오늘의 단어' },
  { href: '/exam', label: '시험' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <nav className="nav">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="main">{children}</main>
      </body>
    </html>
  );
}
