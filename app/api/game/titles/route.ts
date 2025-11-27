import { NextResponse } from 'next/server'
import { getTMDbMoviesByLetter, searchTMDbMovies } from '@/lib/tmdb'

// Cache for movie titles (in-memory, resets on server restart)
let allTitlesCache: string[] | null = null
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
    if (allTitlesCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
      return NextResponse.json({ titles: allTitlesCache })
    }

    console.log('Building comprehensive movie list from TMDb...')
    const titles = new Set<string>()
    
    // Fetch titles alphabetically (A-Z and digits)
    const letters = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789']
    for (const letter of letters) {
      try {
        const letterTitles = await getTMDbMoviesByLetter(letter, 150)
        letterTitles.forEach(title => titles.add(title))
        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 150))
      } catch (error) {
        console.error(`Error fetching titles for letter ${letter}:`, error)
      }
    }

    // Supplement with common search terms for diversity
    const searchTerms = ['love', 'war', 'night', 'day', 'time', 'man', 'woman', 'story', 'dark', 'light']
    for (const term of searchTerms) {
      try {
        for (let page = 1; page <= 2; page++) {
          const termTitles = await searchTMDbMovies(term, page)
          termTitles.forEach(title => titles.add(title))
          if (termTitles.length < 10) break
          await new Promise(resolve => setTimeout(resolve, 150))
        }
      } catch (error) {
        console.error(`Error searching for term ${term}:`, error)
      }
    }

    // Convert to sorted array
    const sortedTitles = Array.from(titles).sort()
    
    console.log(`Built movie list with ${sortedTitles.length} titles`)
    
    // Cache the results
    allTitlesCache = sortedTitles
    cacheTimestamp = Date.now()

    return NextResponse.json({ titles: sortedTitles })
  } catch (error) {
    console.error('Error fetching movie titles:', error)
    return NextResponse.json({ titles: allTitlesCache || [] })
  }
}

