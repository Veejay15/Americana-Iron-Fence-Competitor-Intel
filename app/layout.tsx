import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Nav } from './components/nav';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Americana Iron Works Competitor Intelligence',
  description: 'Weekly competitor intelligence reports for Americana Iron Works',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <Nav />
        <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">{children}</main>
        <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
          AI tool powered by{' '}
          <a
            href="https://makariosmarketing.com"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-slate-700 hover:text-slate-900"
          >
            Makarios Marketing
          </a>
        </footer>
      </body>
    </html>
  );
}
