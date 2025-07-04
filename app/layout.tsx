import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import LayoutWrapper from '@/components/LayoutWrapper'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Queensland Youth Justice Accountability | Evidence-Based Reform',
  description: 'Official government data exposing Queensland youth justice failures. Real-time tracking of $1.38B spending, Indigenous overrepresentation, and system accountability.',
  keywords: 'Queensland youth justice, Indigenous overrepresentation, government accountability, youth detention, justice reform',
  authors: [{ name: 'Queensland Youth Justice Accountability Platform' }],
  openGraph: {
    title: 'Queensland Youth Justice Accountability',
    description: 'Evidence-based platform tracking youth justice failures using official government data',
    type: 'website',
    locale: 'en_AU',
    siteName: 'QLD Youth Justice Tracker',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Queensland Youth Justice Accountability',
    description: 'Real-time tracking of youth justice failures with government data',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <LayoutWrapper>
          {children}
        </LayoutWrapper>
      </body>
    </html>
  )
}