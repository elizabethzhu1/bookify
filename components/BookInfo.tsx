"use client"

import { useAppContext } from "@/context/AppContext"
import Image from "next/image"

export default function BookInfo() {
  const { bookInfo } = useAppContext()

  if (!bookInfo) {
    return null
  }

  return (
    <div className="bg-[#282828] rounded-lg p-4 shadow-lg hover:bg-[#404040] transition-colors duration-200">
      <h2 className="text-2xl font-semibold mb-4 text-[#1DB954]">Book Information</h2>
      <div className="flex items-start">
        {bookInfo.thumbnail && (
          <Image
            src={bookInfo.thumbnail || "/placeholder.svg"}
            alt={bookInfo.title}
            width={128}
            height={192}
            className="mr-4 rounded-md shadow-lg"
          />
        )}
        <div>
          <h3 className="text-xl font-medium text-white">{bookInfo.title}</h3>
          <p className="text-[#B3B3B3] mb-2">by {bookInfo.author}</p>
          <p className="text-sm text-[#B3B3B3] mb-2">{bookInfo.description}</p>
          {bookInfo.categories && (
            <div className="text-sm text-[#1DB954]">Categories: {bookInfo.categories.join(", ")}</div>
          )}
        </div>
      </div>
    </div>
  )
}

