import { Inter } from 'next/font/google';
import './globals.css';
import AppShellProvider from '@/components/AppShell';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  title: 'Ventriee',
  description: 'AI-powered lead generation platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="stylesheet" href="/tailwind.css" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <AppShellProvider>{children}</AppShellProvider>
      </body>
    </html>
  );
}
