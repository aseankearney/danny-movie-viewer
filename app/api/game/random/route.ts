import { NextResponse } from 'next/server'
import { getRandomMovieFromLikedOrHated } from '@/lib/db'
import { getMovieByIMDbId } from '@/lib/omdb'

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL is not set. Please configure the database connection.' },
        { status: 500 }
      )
    }

    const movieStatus = await getRandomMovieFromLikedOrHated()
    
    if (!movieStatus) {
      return NextResponse.json(
        { 
          error: 'No movies available. Danny needs to review some movies in the tracker app first! The game needs movies marked as "Seen-Liked" or "Seen-Hated".' 
        },
        { status: 404 }
      )
    }

    // Try to fetch movie details from OMDb
    const movieId = String(movieStatus.movieId)
    let movieDetails = null
    
    if (movieId.startsWith('tt')) {
      movieDetails = await getMovieByIMDbId(movieId)
    }

    return NextResponse.json({
      movieId: movieStatus.movieId,
      status: movieStatus.status,
      year: movieDetails?.Year || null,
      title: movieDetails?.Title || null,
      poster: movieDetails?.Poster || null,
      plot: movieDetails?.Plot || null,
    })
  } catch (error: any) {
    console.error('Error fetching random movie:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch random movie. Please check your database connection.' 
      },
      { status: 500 }
    )
  }
}

