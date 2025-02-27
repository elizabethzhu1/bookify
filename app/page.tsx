import BookForm from "@/components/BookForm"
import BookInfo from "@/components/BookInfo"
import PlaylistDisplay from "@/components/PlaylistDisplay"
import SpotifyAuth from "@/components/SpotifyAuth"
import { AlertCircle } from "lucide-react"

export default function Home({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const error = searchParams.error as string | undefined

  return (
    <main className="container mx-auto px-4 py-10">
      <h1 className="text-8xl font-bold mt-20 mb-5 text-center text-white drop-shadow-lg">Bookify</h1>
      <h2 className="text-xl mb-8 text-center text-green-100 drop-shadow-lg">
        The perfect playlist for your next read.
      </h2>
      <div className="flex flex-col items-center gap-4 mb-8">
        <SpotifyAuth />
        {error && (
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-4 h-4" />
            <p>
              {error === "state_mismatch"
                ? "Authentication failed. Please try again."
                : error === "no_code"
                  ? "No authorization code received. Please try again."
                  : error === "token_error"
                    ? "Failed to retrieve access token. Please try again."
                    : "An error occurred. Please try again."}
            </p>
          </div>
        )}
      </div>
      <div className="p-5">
        <BookForm />
        <div className="mt-8 grid md:grid-cols-2 gap-8">
          <BookInfo />
          <PlaylistDisplay />
        </div>
      </div>
    </main>
  )
}

