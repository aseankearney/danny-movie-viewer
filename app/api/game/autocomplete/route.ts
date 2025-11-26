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

    // Search OMDb directly with the user's query - only first page for speed
    try {
      const response = await fetch(
        `${OMDB_BASE_URL}/?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(query)}&type=movie&page=1`,
        {
          cache: 'no-store',
        }
      )

      if (!response.ok) {
        throw new Error(`OMDb API error: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.Response === 'True' && data.Search && Array.isArray(data.Search)) {
        for (const movie of data.Search) {
          const title = movie.Title
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
          
          // For short queries (1-2 chars), only show titles that start with the query
          if (query.length <= 2 && !titleLower.startsWith(queryLower)) continue
          
          suggestions.push(title)
          seenTitles.add(titleKey)
          
          if (suggestions.length >= 30) break
        }
      }
    } catch (error) {
      console.error(`Error searching OMDb for "${query}":`, error)
      return NextResponse.json({ suggestions: [] })
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

    return NextResponse.json({ suggestions: sorted.slice(0, 30) })
  } catch (error) {
    console.error('Error in autocomplete:', error)
    return NextResponse.json({ suggestions: [] })
  }
}
