"use client"

import { useAppContext } from "@/context/AppContext"
import { Button } from "@/components/ui/button"
import { ExternalLink, Music } from "lucide-react"
import Image from "next/image"

export default function PlaylistDisplay() {
  const { playlistInfo } = useAppContext()

  if (!playlistInfo) {
    return null
  }

  return (
    <div className="bg-[#282828] rounded-lg p-4 shadow-lg hover:bg-[#404040] transition-colors duration-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-[#1DB954]">Generated Playlist</h2>
        <a href={playlistInfo.external_url} target="_blank" rel="noopener noreferrer" className="inline-flex">
          <Button className="bg-[#1DB954] hover:bg-[#1ed760] text-white border-none">
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in Spotify
          </Button>
        </a>
      </div>

      <div className="space-y-4">
        {playlistInfo.tracks.map((track, index) => (
          <div
            key={index}
            className="flex items-center p-2 rounded-md hover:bg-[#404040] transition-colors duration-200"
          >
            {track.image ? (
              <Image
                src={track.image || "/placeholder.svg"}
                alt={track.album}
                width={48}
                height={48}
                className="rounded-md mr-3"
              />
            ) : (
              <div className="w-12 h-12 bg-[#404040] rounded-md mr-3 flex items-center justify-center">
                <Music className="w-6 h-6 text-[#B3B3B3]" />
              </div>
            )}
            <div className="flex-grow min-w-0">
              <p className="font-medium text-white truncate">{track.name}</p>
              <p className="text-sm text-[#B3B3B3] truncate">{track.artist}</p>
              <p className="text-xs text-[#B3B3B3] truncate">{track.album}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

