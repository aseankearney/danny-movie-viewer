import { NextResponse } from 'next/server'
import { getAllMovieIds } from '@/lib/db'
import { getMovieByIMDbId } from '@/lib/omdb'

// Cache for movie titles to avoid repeated API calls
const movieTitleCache = new Map<string, string>()

export async function GET(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL is not set' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.toLowerCase().trim() || ''

    if (query.length < 2) {
      return NextResponse.json({ suggestions: [] })
    }

    // Get all movie IDs from database
    const movieIds = await getAllMovieIds()
    
    const suggestions: string[] = []
    const maxSuggestions = 10
    const moviesToCheck = movieIds.slice(0, 50) // Limit for performance
    
    // Check cache first, then fetch missing ones
    const uncachedIds: string[] = []
    const cachedTitles: string[] = []
    
    for (const movieId of moviesToCheck) {
      if (movieTitleCache.has(movieId)) {
        const title = movieTitleCache.get(movieId)!
        if (title.toLowerCase().includes(query)) {
          cachedTitles.push(title)
        }
      } else if (movieId.startsWith('tt')) {
        uncachedIds.push(movieId)
      }
    }
    
    // Fetch uncached movies (limit to 10 at a time for performance)
    for (const movieId of uncachedIds.slice(0, 10)) {
      if (suggestions.length + cachedTitles.length >= maxSuggestions) break
      
      try {
        const movie = await getMovieByIMDbId(movieId)
        if (movie && movie.Title) {
          movieTitleCache.set(movieId, movie.Title)
          if (movie.Title.toLowerCase().includes(query)) {
            suggestions.push(movie.Title)
          }
        }
      } catch (error) {
        // Skip if error
      }
    }

    // Combine cached and new suggestions
    const allSuggestions = [...cachedTitles, ...suggestions]
    
    // Remove duplicates and sort
    const uniqueSuggestions = Array.from(new Set(allSuggestions))
      .sort()
      .slice(0, maxSuggestions)

    return NextResponse.json({ suggestions: uniqueSuggestions })
  } catch (error) {
    console.error('Error in autocomplete:', error)
    return NextResponse.json({ suggestions: [] })
  }
}

