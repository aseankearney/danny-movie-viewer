import { NextResponse } from 'next/server'
import { getTMDbMovieDetailsByIMDbId } from '@/lib/tmdb'
import { removeNamesFromPlot, replaceProperNounsWithRedacted } from '@/lib/plotUtils'

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL is not set. Please configure the database connection.' },
        { status: 500 }
      )
    }

    // For demo: fetch the most recent movies marked as Seen-Liked or Seen-Hated and pick the first one with TMDb data
    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(process.env.DATABASE_URL!)
    
    const movies = await sql`
      SELECT movie_id, status, updated_at
      FROM movie_statuses
      WHERE status IN ('Seen-Liked', 'Seen-Hated')
      ORDER BY updated_at DESC
      LIMIT 15
    `
    
    if (movies.length === 0) {
      return NextResponse.json(
        { 
          error: 'No movies available. Danny needs to review some movies in the tracker app first! The game needs movies marked as "Seen-Liked" or "Seen-Hated".' 
        },
        { status: 404 }
      )
    }
    
    let movieStatus = null
    let movieDetails = null
    
    for (const movie of movies) {
      const movieId = String(movie.movie_id)
      if (!movieId.startsWith('tt')) continue
      
      const tmdbDetails = await getTMDbMovieDetailsByIMDbId(movieId)
      if (tmdbDetails) {
        movieStatus = {
          movieId: movie.movie_id,
          status: movie.status as 'Seen-Liked' | 'Seen-Hated',
          updatedAt: movie.updated_at instanceof Date 
            ? movie.updated_at.toISOString() 
            : new Date(movie.updated_at).toISOString(),
        }
        movieDetails = tmdbDetails
        break
      }
    }
    
    if (!movieStatus || !movieDetails) {
      return NextResponse.json(
        { 
          error: 'Failed to fetch movie details from TMDb. Please ensure the tracker has entries with valid IMDb IDs.' 
        },
        { status: 404 }
      )
    }
    
    const today = new Date().toISOString().split('T')[0]

    const plotWithoutNames = movieDetails.plot
      ? removeNamesFromPlot(
          movieDetails.plot,
          movieDetails.actorsText,
          movieDetails.director
        )
      : null
    
    const plotWithRedacted = plotWithoutNames
      ? replaceProperNounsWithRedacted(plotWithoutNames)
      : null

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
      plotWithoutNames: plotWithoutNames,
      plotWithRedacted: plotWithRedacted,
      academyAwards: movieDetails.academyAwards,
      puzzleDate: today,
    })
  } catch (error: any) {
    console.error('Error fetching daily movie:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch daily movie. Please check your database connection.' 
      },
      { status: 500 }
    )
  }
}

