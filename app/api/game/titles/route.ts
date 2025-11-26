import { NextResponse } from 'next/server'
import { getAllMovieIds } from '@/lib/db'
import { getMovieByIMDbId } from '@/lib/omdb'

// Cache for movie titles (in-memory, resets on server restart)
const movieTitleCache = new Map<string, string>()
let allTitlesCache: string[] | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL is not set' },
        { status: 500 }
      )
    }

    if (!process.env.OMDB_API_KEY) {
      return NextResponse.json(
        { error: 'OMDB_API_KEY is not set' },
        { status: 500 }
      )
    }

    // Return cached titles if still valid
    if (allTitlesCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
      return NextResponse.json({ titles: allTitlesCache })
    }

    // Get all movie IDs from database
    const movieIds = await getAllMovieIds()
    
    if (movieIds.length === 0) {
      return NextResponse.json({ titles: [] })
    }

    const titles: string[] = []
    const uncachedIds: string[] = []
    
    // Check cache first
    for (const movieId of movieIds) {
      if (movieTitleCache.has(movieId)) {
        const title = movieTitleCache.get(movieId)!
        if (title && !titles.includes(title)) {
          titles.push(title)
        }
      } else if (movieId.startsWith('tt')) {
        uncachedIds.push(movieId)
      }
    }

    // Fetch uncached movies in batches (to avoid rate limiting)
    const batchSize = 10
    for (let i = 0; i < uncachedIds.length; i += batchSize) {
      const batch = uncachedIds.slice(i, i + batchSize)
      
      await Promise.all(
        batch.map(async (movieId) => {
          try {
            const movie = await getMovieByIMDbId(movieId)
            if (movie && movie.Title) {
              movieTitleCache.set(movieId, movie.Title)
              if (!titles.includes(movie.Title)) {
                titles.push(movie.Title)
              }
            }
          } catch (error) {
            console.error(`Error fetching movie ${movieId}:`, error)
          }
        })
      )
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < uncachedIds.length) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    // Sort titles alphabetically
    const sortedTitles = titles.sort()
    
    // Cache the results
    allTitlesCache = sortedTitles
    cacheTimestamp = Date.now()

    return NextResponse.json({ titles: sortedTitles })
  } catch (error) {
    console.error('Error fetching movie titles:', error)
    return NextResponse.json({ titles: allTitlesCache || [] })
  }
}

