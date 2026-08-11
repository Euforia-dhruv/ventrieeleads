import { Inter } from 'next/font/google';
import AppShellProvider from '@/components/AppShell';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AppShellProvider>{children}</AppShellProvider>
      </body>
    </html>
  );
}
