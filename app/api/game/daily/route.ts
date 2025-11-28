import { NextResponse } from 'next/server'
import { getTMDbMovieDetailsByIMDbId } from '@/lib/tmdb'
import { removeNamesFromPlot, replaceProperNounsWithRedacted } from '@/lib/plotUtils'
import { transformPlotToDannyVoice } from '@/lib/dannyPlotTransform'

// Mark this route as dynamic since it uses database and external APIs
export const dynamic = 'force-dynamic'
// Vercel free tier timeout is 10s, so we need to work within that limit
export const maxDuration = 10

export async function GET() {
  const startTime = Date.now()
  console.log('[Daily Movie API] Starting request...')
  
  try {
    if (!process.env.DATABASE_URL) {
      console.error('[Daily Movie API] DATABASE_URL not set')
      return NextResponse.json(
        { error: 'DATABASE_URL is not set. Please configure the database connection.' },
        { status: 500 }
      )
    }

    if (!process.env.TMDB_API_KEY) {
      console.error('[Daily Movie API] TMDB_API_KEY not set')
      return NextResponse.json(
        { error: 'TMDB_API_KEY is not set. Please configure the TMDb API key.' },
        { status: 500 }
      )
    }

    // For demo: fetch the most recent movies marked as Seen-Liked or Seen-Hated and pick the first one with TMDb data
    console.log('[Daily Movie API] Connecting to database...')
    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(process.env.DATABASE_URL!)
    
    console.log('[Daily Movie API] Querying database...')
    
    // Simplified query - just get the movies we need, no extra queries
    // Add retry logic for database connection
    let movies
    try {
      movies = await sql`
        SELECT movie_id, status, updated_at
        FROM movie_statuses
        WHERE status IN ('Seen-Liked', 'Seen-Hated')
        ORDER BY updated_at DESC
        LIMIT 3
      `
      console.log(`[Daily Movie API] Found ${movies.length} movies with Seen-Liked or Seen-Hated status`)
    } catch (dbError: any) {
      console.error('[Daily Movie API] Database query failed, retrying once...', dbError)
      // Retry once after a short delay
      await new Promise(resolve => setTimeout(resolve, 500))
      try {
        movies = await sql`
          SELECT movie_id, status, updated_at
          FROM movie_statuses
          WHERE status IN ('Seen-Liked', 'Seen-Hated')
          ORDER BY updated_at DESC
          LIMIT 3
        `
        console.log(`[Daily Movie API] Retry successful - Found ${movies.length} movies`)
      } catch (retryError: any) {
        console.error('[Daily Movie API] Database retry also failed:', retryError)
        throw new Error(`Database connection failed: ${retryError.message}`)
      }
    }
    
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
    let lastError: string | null = null
    
    // Try up to 3 movies (reduced for faster response), but with timeout protection
    console.log('[Daily Movie API] Trying to fetch movie details from TMDb...')
    const moviesToTry = movies // Already limited to 3
    
    for (let i = 0; i < moviesToTry.length; i++) {
      const movie = moviesToTry[i]
      const movieId = String(movie.movie_id)
      const elapsed = Date.now() - startTime
      
      // If we've been running for more than 8 seconds, give up (Vercel free tier is 10s)
      if (elapsed > 8000) {
        console.warn(`[Daily Movie API] Timeout after ${elapsed}ms, stopping`)
        lastError = 'Request took too long. TMDb API may be slow or rate-limited.'
        break
      }
      
      console.log(`[Daily Movie API] Trying movie ${i + 1}/${moviesToTry.length}: ${movieId} (${elapsed}ms elapsed)`)
      
      if (!movieId.startsWith('tt')) {
        lastError = `Movie ID ${movieId} is not a valid IMDb ID`
        console.warn(`[Daily Movie API] ${lastError}`)
        continue
      }
      
      try {
        const tmdbDetails = await getTMDbMovieDetailsByIMDbId(movieId)
        if (tmdbDetails && tmdbDetails.title) {
          console.log(`[Daily Movie API] Successfully fetched: ${tmdbDetails.title}`)
          movieStatus = {
            movieId: movie.movie_id,
            status: movie.status as 'Seen-Liked' | 'Seen-Hated',
            updatedAt: movie.updated_at instanceof Date 
              ? movie.updated_at.toISOString() 
              : new Date(movie.updated_at).toISOString(),
          }
          movieDetails = tmdbDetails
          break
        } else {
          lastError = `Failed to fetch details for ${movieId} from TMDb (no title returned)`
          console.warn(`[Daily Movie API] ${lastError}`)
        }
      } catch (error: any) {
        lastError = error.message || `Error fetching ${movieId} from TMDb`
        console.error(`[Daily Movie API] Error fetching movie ${movieId}:`, error)
        // Continue to next movie
        continue
      }
    }
    
    if (!movieStatus || !movieDetails) {
      return NextResponse.json(
        { 
          error: `Failed to fetch movie details from TMDb. ${lastError || 'Please ensure the tracker has entries with valid IMDb IDs.'}` 
        },
        { status: 404 }
      )
    }
    
    const today = new Date().toISOString().split('T')[0]

    // Transform plot to Danny's voice first
    const dannyPlot = movieDetails.plot
      ? await transformPlotToDannyVoice(
          String(movieStatus.movieId),
          movieDetails.plot,
          movieStatus.status === 'Seen-Liked'
        )
      : null

    const plotWithoutNames = dannyPlot
      ? removeNamesFromPlot(
          dannyPlot,
          movieDetails.actorsText,
          movieDetails.director
        )
      : null
    
    const plotWithRedacted = plotWithoutNames
      ? replaceProperNounsWithRedacted(plotWithoutNames)
      : null

    const elapsed = Date.now() - startTime
    console.log(`[Daily Movie API] Success! Returning movie in ${elapsed}ms`)
    
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
    const elapsed = Date.now() - startTime
    console.error(`[Daily Movie API] Error after ${elapsed}ms:`, error)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch daily movie. Please check your database connection.' 
      },
      { status: 500 }
    )
  }
}

