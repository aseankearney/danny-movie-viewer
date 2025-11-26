import { NextResponse } from 'next/server'

const OMDB_API_KEY = process.env.OMDB_API_KEY || ''
const OMDB_BASE_URL = 'https://www.omdbapi.com'

export async function GET(request: Request) {
  try {
    if (!OMDB_API_KEY) {
      return NextResponse.json({ suggestions: [] })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim() || ''

    // If query is too short, return empty
    if (query.length < 1) {
      return NextResponse.json({ suggestions: [] })
    }

    const suggestions: string[] = []
    const seenTitles = new Set<string>()
    const queryLower = query.toLowerCase().trim()
    const queryIsNumber = /^\d/.test(query)

    // Search OMDb directly with the user's query - search multiple pages
    for (let page = 1; page <= 3; page++) {
      if (suggestions.length >= 50) break
      
      try {
        const response = await fetch(
          `${OMDB_BASE_URL}/?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(query)}&type=movie&page=${page}`,
          {
            cache: 'no-store',
          }
        )

        if (!response.ok) {
          throw new Error(`OMDb API error: ${response.statusText}`)
        }

        const data = await response.json()
        
        // Debug logging
        console.log(`OMDb search for "${query}" page ${page}:`, {
          response: data.Response,
          hasSearch: !!data.Search,
          searchLength: data.Search?.length,
          error: data.Error
        })
        
        // Check if response is successful
        if (data.Response === 'False' || data.Response === false) {
          // Check if it's an error or just no more results
          if (data.Error && page === 1) {
            console.error(`OMDb API error: ${data.Error}`)
          }
          break
        }
        
        if (!data.Search || !Array.isArray(data.Search)) {
          break
        }
        
        for (const movie of data.Search) {
          const title = movie?.Title
          if (!title) continue
          
          const titleLower = title.toLowerCase()
          const titleKey = titleLower
          
          // Only include if we haven't seen it
          if (seenTitles.has(titleKey)) continue
          
          // Must contain the query
          if (!titleLower.includes(queryLower)) continue
          
          // Filter out titles starting with numbers unless query is a number
          const startsWithNumber = /^\d/.test(title)
          if (startsWithNumber && !queryIsNumber) continue
          
          suggestions.push(title)
          seenTitles.add(titleKey)
          
          if (suggestions.length >= 50) break
        }
        
        // If we got fewer results than expected, we've probably reached the end
        if (data.Search.length < 10) break
        
        // Small delay between pages to avoid rate limiting
        if (page < 3 && suggestions.length < 50) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      } catch (error) {
        console.error(`Error searching OMDb page ${page} for "${query}":`, error)
        // Continue to next page or break if first page fails
        if (page === 1) break
      }
    }

    // Sort by relevance
    const sorted = suggestions.sort((a, b) => {
      const aLower = a.toLowerCase()
      const bLower = b.toLowerCase()
      
      // Exact match at start gets highest priority
      const aStarts = aLower.startsWith(queryLower)
      const bStarts = bLower.startsWith(queryLower)
      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1
      
      // Then by how early the match appears
      const aIndex = aLower.indexOf(queryLower)
      const bIndex = bLower.indexOf(queryLower)
      if (aIndex !== bIndex) return aIndex - bIndex
      
      // Then by length (shorter titles first)
      return a.length - b.length
    })

    console.log(`Autocomplete for "${query}": returning ${sorted.length} suggestions`)
    return NextResponse.json({ suggestions: sorted.slice(0, 50) })
  } catch (error) {
    console.error('Error in autocomplete:', error)
    return NextResponse.json({ suggestions: [] })
  }
}
