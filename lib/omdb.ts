// OMDb API helper functions
const OMDB_API_KEY = process.env.OMDB_API_KEY || ''
const OMDB_BASE_URL = 'https://www.omdbapi.com'

export interface OMDbMovieResponse {
  imdbID: string
  Title: string
  Year: string
  Poster: string
  Type: string
  Plot?: string
  Genre?: string
  Rated?: string
  Runtime?: string
  Director?: string
  Actors?: string
  Awards?: string
  Response: string
  Error?: string
}

export async function getMovieByIMDbId(imdbId: string): Promise<OMDbMovieResponse | null> {
  if (!OMDB_API_KEY) {
    console.warn('OMDB_API_KEY is not set')
    return null
  }

  try {
    const response = await fetch(
      `${OMDB_BASE_URL}/?apikey=${OMDB_API_KEY}&i=${imdbId}&type=movie`,
      {
        next: { revalidate: 86400 }, // Cache for 24 hours
      }
    )

    if (!response.ok) {
      throw new Error(`OMDb API error: ${response.statusText}`)
    }

    const data: OMDbMovieResponse = await response.json()
    if (data.Response === 'False') {
      return null
    }
    return data
  } catch (error) {
    console.error(`Error fetching movie by IMDb ID ${imdbId}:`, error)
    return null
  }
}

