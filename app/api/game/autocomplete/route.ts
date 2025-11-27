import { NextResponse } from 'next/server'
import { searchTMDbMovies, getTMDbMoviesByLetter } from '@/lib/tmdb'

// Mark this route as dynamic since it uses request.url
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    if (!process.env.TMDB_API_KEY) {
      return NextResponse.json({ suggestions: [] })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim() || ''
    const letter = searchParams.get('letter')

    if (letter && letter.length === 1) {
      const titles = await getTMDbMoviesByLetter(letter.toUpperCase(), 20)
      return NextResponse.json({ suggestions: titles })
    }

    if (query.length < 1) {
      return NextResponse.json({ suggestions: [] })
    }

    const suggestions: string[] = []
    const seenTitles = new Set<string>()
    const queryLower = query.toLowerCase().trim()
    const queryIsNumber = /^\d/.test(query)

    for (let page = 1; page <= 3; page++) {
      if (suggestions.length >= 50) break

      const titles = await searchTMDbMovies(query, page)
      if (titles.length === 0) break

      for (const title of titles) {
        const lower = title.toLowerCase()
        if (seenTitles.has(lower)) continue
        if (!lower.includes(queryLower)) continue

        const startsWithNumber = /^\d/.test(title)
        if (startsWithNumber && !queryIsNumber) continue

        suggestions.push(title)
        seenTitles.add(lower)
        if (suggestions.length >= 50) break
      }
    }

    const sorted = suggestions.sort((a, b) => {
      const aLower = a.toLowerCase()
      const bLower = b.toLowerCase()

      const aStarts = aLower.startsWith(queryLower)
      const bStarts = bLower.startsWith(queryLower)
      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1

      const aIndex = aLower.indexOf(queryLower)
      const bIndex = bLower.indexOf(queryLower)
      if (aIndex !== bIndex) return aIndex - bIndex

      return a.length - b.length
    })

    return NextResponse.json({ suggestions: sorted.slice(0, 50) })
  } catch (error) {
    console.error('Error in autocomplete:', error)
    return NextResponse.json({ suggestions: [] })
  }
}
