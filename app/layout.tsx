import type React from "react"
import type { Metadata, Viewport } from "next"
import { Orbitron, Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Web3Provider } from "./providers/web3-provider"
import "@rainbow-me/rainbowkit/styles.css"
import "./globals.css"

// Font Optimization (Phase 6)
const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "500", "600", "700", "800", "900"],
  display: 'swap',
  preload: true,
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: 'swap',
  preload: true,
})

// Viewport Configuration (Phase 4)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

// Enhanced Metadata (Phase 4)
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: {
    default: 'RoboLaunch - The Future of Robotics AI Tokens',
    template: '%s | RoboLaunch',
  },
  description: 'Launch and trade robotics AI memecoins on the most advanced launchpad in the metaverse. Where silicon meets speculation.',
  keywords: ['robotics', 'AI', 'crypto', 'memecoins', 'launchpad', 'blockchain', 'DeFi', 'tokens', 'trading'],
  authors: [{ name: 'RoboLaunch Team' }],
  creator: 'RoboLaunch',
  publisher: 'RoboLaunch',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'RoboLaunch - The Future of Robotics AI Tokens',
    description: 'Launch and trade robotics AI memecoins on the most advanced launchpad in the metaverse',
    siteName: 'RoboLaunch',
    images: [{
      url: '/og-image.png',
      width: 1200,
      height: 630,
      alt: 'RoboLaunch Platform - Robotics AI Token Launchpad',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RoboLaunch - The Future of Robotics AI Tokens',
    description: 'Launch and trade robotics AI memecoins on the most advanced launchpad',
    images: ['/og-image.png'],
    creator: '@robolaunch',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${orbitron.variable} ${inter.variable} font-sans antialiased`}>
        <Web3Provider>
          {children}
        </Web3Provider>
        <Analytics />
      </body>
    </html>
  )
}
