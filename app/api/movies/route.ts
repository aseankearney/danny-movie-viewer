import { NextResponse } from 'next/server'
import { getMoviesByStatus } from '@/lib/db'
import { getTMDbMovieDetailsByIMDbId } from '@/lib/tmdb'

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
    
    // Fetch movie details from TMDb for each movie
    const moviesWithDetails = await Promise.all(
      movies.map(async (movie) => {
        // Try to extract IMDb ID from movie_id (it might be an IMDb ID or a generated ID)
        const movieId = String(movie.movieId)
        const tmdbData =
          movieId.startsWith('tt') ? await getTMDbMovieDetailsByIMDbId(movieId) : null
        
        return {
          ...movie,
          title: tmdbData?.title || `Movie ID: ${movieId}`,
          year: tmdbData?.year || null,
          poster: tmdbData?.poster || null,
          plot: tmdbData?.plot || null,
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

