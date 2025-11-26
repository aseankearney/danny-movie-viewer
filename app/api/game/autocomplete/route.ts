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

      const titles = await searchMoviesByTitle(query, page)
      
      for (const title of titles) {
        if (!seenTitles.has(title) && title.toLowerCase().includes(query.toLowerCase())) {
          suggestions.push(title)
          seenTitles.add(title)
          if (suggestions.length >= 50) break
        }
      }

      // If we got fewer results than expected, we've probably reached the end
      if (titles.length < 10) break

      // Small delay between pages to avoid rate limiting
      if (page < 3) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    return NextResponse.json({ suggestions: suggestions.slice(0, 50) })
  } catch (error) {
    console.error('Error in autocomplete:', error)
    return NextResponse.json({ suggestions: [] })
  }
}
