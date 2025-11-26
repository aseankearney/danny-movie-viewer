import { NextResponse } from 'next/server'
import { getAllMovieIds } from '@/lib/db'
import { getMovieByIMDbId } from '@/lib/omdb'

// Cache for movie titles
const movieTitleCache = new Map<string, string>()

// This endpoint is a fallback for when client-side autocomplete hasn't loaded titles yet
export async function GET(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ suggestions: [] })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.toLowerCase().trim() || ''

    if (query.length < 2) {
      return NextResponse.json({ suggestions: [] })
    }

    // Get movie IDs and check cache
    const movieIds = await getAllMovieIds()
    const matchingTitles: string[] = []
    
    // Check cache first
    for (const movieId of movieIds.slice(0, 100)) {
      if (movieTitleCache.has(movieId)) {
        const title = movieTitleCache.get(movieId)!
        if (title.toLowerCase().includes(query) && !matchingTitles.includes(title)) {
          matchingTitles.push(title)
          if (matchingTitles.length >= 20) break
        }
      }
    }

    // If we need more, fetch some uncached ones
    if (matchingTitles.length < 20) {
      const uncachedIds = movieIds.filter(id => !movieTitleCache.has(id) && id.startsWith('tt')).slice(0, 20)
      
      for (const movieId of uncachedIds) {
        if (matchingTitles.length >= 20) break
        
        try {
          const movie = await getMovieByIMDbId(movieId)
          if (movie && movie.Title) {
            movieTitleCache.set(movieId, movie.Title)
            if (movie.Title.toLowerCase().includes(query) && !matchingTitles.includes(movie.Title)) {
              matchingTitles.push(movie.Title)
            }
          }
        } catch (error) {
          // Skip on error
        }
      }
    }

    return NextResponse.json({ suggestions: matchingTitles.slice(0, 20) })
  } catch (error) {
    console.error('Error in autocomplete:', error)
    return NextResponse.json({ suggestions: [] })
  }
}

