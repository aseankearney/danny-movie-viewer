import { NextResponse } from 'next/server'
import { searchMoviesByTitle } from '@/lib/omdb'

// Cache for movie titles (in-memory, resets on server restart)
let allTitlesCache: string[] | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

export async function GET() {
  try {
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

    console.log('Building comprehensive movie list from OMDb...')
    const titles = new Set<string>()
    
    // Search by year ranges (1989-2024, the range from the tracker app)
    const currentYear = new Date().getFullYear()
    const startYear = 1989
    const endYear = currentYear
    
    // Search by common single letters and common words
    const searchTerms = [
      // Single letters
      ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
      // Common words
      'the', 'a', 'an', 'in', 'on', 'at', 'of', 'to', 'for', 'with',
      // Common movie terms
      'movie', 'film', 'story', 'love', 'man', 'woman', 'life', 'time', 'day', 'night',
      'war', 'city', 'world', 'king', 'queen', 'star', 'dark', 'light', 'new', 'old',
      // Numbers (for sequels)
      '2', '3', '4', '5', 'II', 'III', 'IV', 'V'
    ]

    // Search by years (sample years to get diverse results)
    const yearSamples = []
    for (let year = startYear; year <= endYear; year += 5) {
      yearSamples.push(year)
    }
    // Also include recent years more densely
    for (let year = currentYear - 3; year <= currentYear; year++) {
      if (!yearSamples.includes(year)) {
        yearSamples.push(year)
      }
    }

    // Search by year + common terms
    for (const year of yearSamples) {
      for (const term of ['the', 'a', 'movie', 'film'].slice(0, 2)) { // Limit to avoid too many requests
        try {
          const yearTitles = await searchMoviesByTitle(`${term} ${year}`, 1)
          yearTitles.forEach(title => titles.add(title))
          await new Promise(resolve => setTimeout(resolve, 200)) // Rate limiting
        } catch (error) {
          console.error(`Error searching for ${term} ${year}:`, error)
        }
      }
    }

    // Search by common terms (multiple pages)
    for (const term of searchTerms.slice(0, 20)) { // Limit to first 20 to avoid too many requests
      try {
        // Get multiple pages for each term
        for (let page = 1; page <= 3; page++) {
          const termTitles = await searchMoviesByTitle(term, page)
          termTitles.forEach(title => titles.add(title))
          
          if (termTitles.length < 10) break // No more results
          await new Promise(resolve => setTimeout(resolve, 200)) // Rate limiting
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

