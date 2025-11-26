import { NextResponse } from 'next/server'
import { getMoviesByStatus } from '@/lib/db'
import { getMovieByIMDbId } from '@/lib/omdb'

export async function GET(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL is not set' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as 'Seen-Liked' | 'Seen-Hated' | 'Not Seen' | null

    if (!status || (status !== 'Seen-Liked' && status !== 'Seen-Hated' && status !== 'Not Seen')) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "Seen-Liked", "Seen-Hated", or "Not Seen"' },
        { status: 400 }
      )
    }

    const movies = await getMoviesByStatus(status)
    
    // Try to fetch movie details from OMDb for each movie
    const moviesWithDetails = await Promise.all(
      movies.map(async (movie) => {
        // Try to extract IMDb ID from movie_id (it might be an IMDb ID or a generated ID)
        const movieId = String(movie.movieId)
        let omdbData = null
        
        // If it looks like an IMDb ID (starts with tt), fetch from OMDb
        if (movieId.startsWith('tt')) {
          omdbData = await getMovieByIMDbId(movieId)
        }
        
        return {
          ...movie,
          title: omdbData?.Title || `Movie ID: ${movieId}`,
          year: omdbData?.Year || null,
          poster: omdbData?.Poster || null,
          plot: omdbData?.Plot || null,
        }
      })
    )
    
    return NextResponse.json({ movies: moviesWithDetails, count: moviesWithDetails.length })
  } catch (error) {
    console.error('Error fetching movies:', error)
    return NextResponse.json(
      { error: 'Failed to fetch movies' },
      { status: 500 }
    )
  }
}

