import { NextResponse } from 'next/server'
import { getTopGrossingMoviesByYear } from '@/lib/tmdb'

// Cache for top-grossing movie titles (in-memory, resets on server restart)
let topGrossingTitlesCache: string[] | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

export async function GET() {
  try {
    if (!process.env.TMDB_API_KEY) {
      return NextResponse.json(
        { error: 'TMDB_API_KEY is not set' },
        { status: 500 }
      )
    }

    // Return cached titles if still valid
    if (topGrossingTitlesCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
      return NextResponse.json({ titles: topGrossingTitlesCache })
    }

    console.log('Building top-grossing movie list from TMDb (1989-2025)...')
    const titles = new Set<string>()
    
    // Fetch top 10 movies for each year (reduced for faster loading)
    // Prioritize recent years first for better UX
    const years = Array.from({ length: 2025 - 1989 + 1 }, (_, i) => 2025 - i) // Reverse order (recent first)
    
    // Process years in parallel batches for faster loading
    const batchSize = 10
    for (let i = 0; i < years.length; i += batchSize) {
      const batch = years.slice(i, i + batchSize)
      await Promise.all(
        batch.map(async (year) => {
          try {
            const yearTitles = await getTopGrossingMoviesByYear(year, 10)
            yearTitles.forEach(title => titles.add(title))
          } catch (error) {
            console.error(`Error fetching movies for year ${year}:`, error)
          }
        })
      )
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < years.length) {
        await new Promise(resolve => setTimeout(resolve, 150))
      }
    }

    // Convert to sorted array
    const sortedTitles = Array.from(titles).sort()
    
    console.log(`Built top-grossing movie list with ${sortedTitles.length} titles`)
    
    // Cache the results
    topGrossingTitlesCache = sortedTitles
    cacheTimestamp = Date.now()

    return NextResponse.json({ titles: sortedTitles })
  } catch (error) {
    console.error('Error fetching top-grossing movie titles:', error)
    return NextResponse.json({ titles: topGrossingTitlesCache || [] })
  }
}

