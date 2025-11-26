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

    // Search OMDb directly with the user's query
    // Search multiple pages to get comprehensive results
    for (let page = 1; page <= 3; page++) {
      if (suggestions.length >= 50) break

      try {
        const titles = await searchMoviesByTitle(query, page)
        
        if (titles.length === 0) break

        const queryLower = query.toLowerCase().trim()
        
        for (const title of titles) {
          if (!seenTitles.has(title.toLowerCase())) {
            const titleLower = title.toLowerCase()
            
            // Only include titles that actually contain the query
            // Prioritize titles that start with the query
            if (titleLower.includes(queryLower)) {
              // Filter out titles that start with numbers unless the query is a number
              const startsWithNumber = /^\d/.test(title)
              const queryIsNumber = /^\d/.test(query)
              
              if (!startsWithNumber || queryIsNumber) {
                suggestions.push(title)
                seenTitles.add(title.toLowerCase())
                if (suggestions.length >= 50) break
              }
            }
          }
        }

        // If we got fewer results than expected, we've probably reached the end
        if (titles.length < 10) break
      } catch (error) {
        console.error(`Error searching page ${page} for "${query}":`, error)
        // Continue to next page or break if first page fails
        if (page === 1) break
      }

      // Small delay between pages to avoid rate limiting
      if (page < 3 && suggestions.length < 50) {
        await new Promise(resolve => setTimeout(resolve, 200))
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

    return NextResponse.json({ suggestions: sorted.slice(0, 50) })
  } catch (error) {
    console.error('Error in autocomplete:', error)
    return NextResponse.json({ suggestions: [] })
  }
}
