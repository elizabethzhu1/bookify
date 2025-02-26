"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

interface BookInfo {
  id: string
  title: string
  author: string
  description: string
  categories: string[]
  thumbnail: string
}

interface TrackInfo {
  name: string
  artist: string
  album: string
  image?: string
  uri: string
}

interface PlaylistInfo {
  id: string
  name: string
  external_url: string
  uri: string
  tracks: TrackInfo[]
}

interface AppContextType {
  bookInfo: BookInfo | null
  setBookInfo: (info: BookInfo | null) => void
  playlistInfo: PlaylistInfo | null
  setPlaylistInfo: (info: PlaylistInfo | null) => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const [bookInfo, setBookInfo] = useState<BookInfo | null>(null)
  const [playlistInfo, setPlaylistInfo] = useState<PlaylistInfo | null>(null)

  return (
    <AppContext.Provider value={{ bookInfo, setBookInfo, playlistInfo, setPlaylistInfo }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider")
  }
  return context
}

