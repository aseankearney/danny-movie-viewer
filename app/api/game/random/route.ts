import { NextResponse } from 'next/server'
import { getRandomMovieFromLikedOrHated } from '@/lib/db'
import { getTMDbMovieDetailsByIMDbId } from '@/lib/tmdb'

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

    const movieId = String(movieStatus.movieId)
    const movieDetails = movieId.startsWith('tt')
      ? await getTMDbMovieDetailsByIMDbId(movieId)
      : null

    if (!movieDetails) {
      return NextResponse.json(
        { error: `Failed to fetch movie details for ${movieId} from TMDb.` },
        { status: 404 }
      )
    }

    return NextResponse.json({
      movieId: movieStatus.movieId,
      status: movieStatus.status,
      year: movieDetails.year,
      title: movieDetails.title,
      poster: movieDetails.poster,
      plot: movieDetails.plot,
      genre: movieDetails.genre,
      rated: movieDetails.rated,
      runtime: movieDetails.runtime,
      director: movieDetails.director,
      firstActor: movieDetails.firstActor,
      fourthAndFifthActors: movieDetails.fourthAndFifthActors,
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

