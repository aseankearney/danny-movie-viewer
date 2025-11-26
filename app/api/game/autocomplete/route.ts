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
      const titles = await getMoviesByFirstLetter(letter.toUpperCase(), 10)
      return NextResponse.json({ suggestions: titles })
    }

    // If query is too short, return empty
    if (query.length < 1) {
      return NextResponse.json({ suggestions: [] })
    }

    // Search OMDb for movies matching the query
    const suggestions: string[] = []
    const seenTitles = new Set<string>()

    // Search multiple pages to get more results
    for (let page = 1; page <= 3; page++) {
      if (suggestions.length >= 50) break

      try {
        const titles = await searchMoviesByTitle(query, page)
        
        for (const title of titles) {
          if (!seenTitles.has(title)) {
            // Check if title matches query (case insensitive, partial match)
            const titleLower = title.toLowerCase()
            const queryLower = query.toLowerCase()
            if (titleLower.includes(queryLower)) {
              suggestions.push(title)
              seenTitles.add(title)
              if (suggestions.length >= 50) break
            }
          }
        }

        // If we got fewer results than expected, we've probably reached the end
        if (titles.length < 10) break
      } catch (error) {
        console.error(`Error searching page ${page}:`, error)
        // Continue to next page or break if first page fails
        if (page === 1) break
      }

      // Small delay between pages to avoid rate limiting
      if (page < 3 && suggestions.length < 50) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    return NextResponse.json({ suggestions: suggestions.slice(0, 50) })
  } catch (error) {
    console.error('Error in autocomplete:', error)
    return NextResponse.json({ suggestions: [] })
  }
}
