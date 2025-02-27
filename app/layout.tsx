import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Poppins } from "next/font/google"
import { AppProvider } from "@/context/AppContext"
import { Inter } from 'next/font/google'

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-poppins",
})

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: "Bookify - Book-Inspired Spotify Playlists",
  description: "Generate Spotify playlists based on your favorite books",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${poppins.variable} ${inter.className}`}>
      <head>
        <link 
          rel="preconnect" 
          href="https://open.spotify.com" 
          crossOrigin="anonymous" 
        />
        <link 
          rel="preconnect" 
          href="https://i.scdn.co" 
          crossOrigin="anonymous" 
        />
      </head>
      <body className={`${poppins.className} antialiased`}>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  )
}

import './globals.css'