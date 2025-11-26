import { NextResponse } from 'next/server'
import { searchMoviesByTitle, getMoviesByFirstLetter } from '@/lib/omdb'

export async function GET(request: Request) {
  try {
    if (!process.env.OMDB_API_KEY) {
      return NextResponse.json({ suggestions: [] })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim() || ''
    const letter = searchParams.get('letter') // For pre-populating by letter

    // If requesting by letter (for initial load)
    if (letter && letter.length === 1) {
      const titles = await getMoviesByFirstLetter(letter.toUpperCase(), 20)
      return NextResponse.json({ suggestions: titles })
    }

    // If query is too short, return empty
    if (query.length < 1) {
      return NextResponse.json({ suggestions: [] })
    }

    // Search OMDb for movies matching the query
    const suggestions: string[] = []
    const seenTitles = new Set<string>()

    // For short queries (1-2 chars), search multiple variations
    const searchQueries: string[] = [query]
    
    if (query.length <= 2) {
      // Add variations for short queries to get more results
      searchQueries.push(`the ${query}`, `a ${query}`, `an ${query}`)
    }

    // Search each query variation
    for (const searchQuery of searchQueries) {
      if (suggestions.length >= 100) break

      // Search multiple pages to get comprehensive results
      for (let page = 1; page <= 5; page++) {
        if (suggestions.length >= 100) break

        try {
          const titles = await searchMoviesByTitle(searchQuery, page)
          
          if (titles.length === 0) break

          for (const title of titles) {
            if (!seenTitles.has(title.toLowerCase())) {
              // Check if title matches query (case insensitive, partial match)
              const titleLower = title.toLowerCase()
              const queryLower = query.toLowerCase()
              if (titleLower.includes(queryLower)) {
                suggestions.push(title)
                seenTitles.add(title.toLowerCase())
                if (suggestions.length >= 100) break
              }
            }
          }

          // If we got fewer results than expected, we've probably reached the end
          if (titles.length < 10) break
        } catch (error) {
          console.error(`Error searching page ${page} for "${searchQuery}":`, error)
          // Continue to next page or break if first page fails
          if (page === 1) break
        }

        // Small delay between pages to avoid rate limiting
        if (page < 5 && suggestions.length < 100) {
          await new Promise(resolve => setTimeout(resolve, 150))
        }
      }

      // Small delay between different search queries
      if (searchQueries.indexOf(searchQuery) < searchQueries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 150))
      }
    }

    // Sort by relevance (exact matches first, then by length)
    const queryLower = query.toLowerCase()
    const sorted = suggestions.sort((a, b) => {
      const aLower = a.toLowerCase()
      const bLower = b.toLowerCase()
      
      // Exact match at start gets highest priority
      if (aLower.startsWith(queryLower) && !bLower.startsWith(queryLower)) return -1
      if (!aLower.startsWith(queryLower) && bLower.startsWith(queryLower)) return 1
      
      // Then by how early the match appears
      const aIndex = aLower.indexOf(queryLower)
      const bIndex = bLower.indexOf(queryLower)
      if (aIndex !== bIndex) return aIndex - bIndex
      
      // Then by length (shorter titles first)
      return a.length - b.length
    })

    return NextResponse.json({ suggestions: sorted.slice(0, 100) })
  } catch (error) {
    console.error('Error in autocomplete:', error)
    return NextResponse.json({ suggestions: [] })
  }
}
