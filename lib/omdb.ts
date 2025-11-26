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

export interface OMDbSearchResponse {
  Search?: Array<{
    Title: string
    Year: string
    imdbID: string
    Type: string
    Poster: string
  }>
  totalResults?: string
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

export async function searchMoviesByTitle(query: string, page: number = 1): Promise<string[]> {
  if (!OMDB_API_KEY) {
    console.warn('OMDB_API_KEY is not set')
    return []
  }

  if (!query || query.trim().length < 1) {
    return []
  }

  try {
    const response = await fetch(
      `${OMDB_BASE_URL}/?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(query)}&type=movie&page=${page}`,
      {
        cache: 'no-store', // Don't cache in API routes
      }
    )

    if (!response.ok) {
      throw new Error(`OMDb API error: ${response.statusText}`)
    }

    const data: OMDbSearchResponse = await response.json()
    if (data.Response === 'False' || !data.Search) {
      return []
    }

    // Extract unique titles
    const titles = data.Search.map(movie => movie.Title)
    return Array.from(new Set(titles)) // Remove duplicates
  } catch (error) {
    console.error(`Error searching movies by title "${query}":`, error)
    return []
  }
}

export async function getMoviesByFirstLetter(letter: string, limit: number = 10): Promise<string[]> {
  if (!letter || letter.length !== 1) {
    return []
  }

  // Search for movies starting with the letter
  // OMDb doesn't have a direct "starts with" search, so we'll search for common patterns
  const searchTerms = [
    `${letter}`,
    `the ${letter}`,
    `a ${letter}`,
    `an ${letter}`,
  ]

  const allTitles: string[] = []
  const seenTitles = new Set<string>()

  for (const term of searchTerms) {
    if (allTitles.length >= limit) break

    // Search multiple pages for each term to get more results
    for (let page = 1; page <= 3; page++) {
      if (allTitles.length >= limit) break

      const titles = await searchMoviesByTitle(term, page)
      if (titles.length === 0) break

      for (const title of titles) {
        // Check if title starts with the letter (case insensitive)
        if (title.charAt(0).toUpperCase() === letter.toUpperCase() && !seenTitles.has(title.toLowerCase())) {
          allTitles.push(title)
          seenTitles.add(title.toLowerCase())
          if (allTitles.length >= limit) break
        }
      }

      // Small delay to avoid rate limiting
      if (page < 3 && allTitles.length < limit) {
        await new Promise(resolve => setTimeout(resolve, 150))
      }
    }

    // Small delay between different search terms
    if (searchTerms.indexOf(term) < searchTerms.length - 1 && allTitles.length < limit) {
      await new Promise(resolve => setTimeout(resolve, 150))
    }
  }

  return allTitles.slice(0, limit)
}

