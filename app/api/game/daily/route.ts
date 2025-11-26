import { NextResponse } from 'next/server'
import { getDailyMovie, getValidMoviesForDaily } from '@/lib/db'
import { getMovieByIMDbId } from '@/lib/omdb'
import { removeNamesFromPlot, extractAcademyAwards, replaceProperNounsWithRedacted } from '@/lib/plotUtils'

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL is not set. Please configure the database connection.' },
        { status: 500 }
      )
    }

    // Get today's date in YYYY-MM-DD format (UTC)
    // This ensures consistent puzzle selection across all timezones
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    
    console.log(`Fetching daily puzzle for date: ${today}`)

    // Get all valid movies and the starting index
    const validMovies = await getValidMoviesForDaily()
    
    if (validMovies.length === 0) {
      return NextResponse.json(
        { 
          error: 'No movies available. Danny needs to review some movies in the tracker app first! The game needs movies marked as "Seen-Liked" or "Seen-Hated".' 
        },
        { status: 404 }
      )
    }

    // Calculate starting index based on date hash
    let hash = 0
    for (let i = 0; i < today.length; i++) {
      const char = today.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    const startIndex = Math.abs(hash) % validMovies.length

    // Try movies starting from the hash index, with fallback to next movies
    let movieStatus = null
    let movieDetails = null
    let attempts = 0
    const maxAttempts = Math.min(validMovies.length, 10) // Try up to 10 movies

    for (let i = 0; i < maxAttempts; i++) {
      const index = (startIndex + i) % validMovies.length
      const movie = validMovies[index]
      const movieId = String(movie.movie_id)
      
      console.log(`Attempting movie ${i + 1}/${maxAttempts}: ${movieId} (index ${index})`)
      
      if (!movieId.startsWith('tt')) {
        console.log(`Skipping ${movieId} - not a valid IMDb ID`)
        continue
      }
      
      // Try to fetch movie details from OMDb
      movieDetails = await getMovieByIMDbId(movieId)
      
      if (movieDetails && movieDetails.Title) {
        // Success! We found a valid movie
        const updatedAt = movie.updated_at instanceof Date 
          ? movie.updated_at.toISOString() 
          : new Date(movie.updated_at).toISOString()
        
        movieStatus = {
          movieId: movie.movie_id,
          status: movie.status as 'Seen-Liked' | 'Seen-Hated',
          updatedAt: updatedAt,
        }
        console.log(`Successfully found movie: ${movieDetails.Title} (${movieId})`)
        break
      } else {
        console.log(`Failed to fetch movie details for ${movieId}, trying next movie...`)
        movieDetails = null // Reset for next attempt
      }
    }

    if (!movieStatus || !movieDetails) {
      return NextResponse.json(
        { 
          error: `Could not find a valid movie with complete data. Tried ${maxAttempts} movies. Please ensure movies in the database have valid IMDb IDs and exist in OMDb.` 
        },
        { status: 404 }
      )
    }

    // Parse actors to get first, fourth, and fifth billed
    const actors = movieDetails?.Actors ? movieDetails.Actors.split(',').map(a => a.trim()) : []
    const firstActor = actors[0] || null
    const fourthActor = actors[3] || null
    const fifthActor = actors[4] || null
    // For hint 5, we want fourth and fifth billed actors
    // If we have both, show both. If only one, show that one. If neither, show a message.
    let fourthAndFifth: string | null = null
    if (fourthActor && fifthActor) {
      fourthAndFifth = `${fourthActor} and ${fifthActor}`
    } else if (fourthActor) {
      fourthAndFifth = fourthActor
    } else if (fifthActor) {
      fourthAndFifth = fifthActor
    } else if (actors.length >= 4) {
      // If we have at least 4 actors but not the 4th/5th, use the last two
      const lastTwo = actors.slice(-2)
      if (lastTwo.length === 2) {
        fourthAndFifth = `${lastTwo[0]} and ${lastTwo[1]}`
      } else if (lastTwo.length === 1) {
        fourthAndFifth = lastTwo[0]
      }
    }

    // Process plot to remove names and replace proper nouns with REDACTED
    const plotWithoutNames = movieDetails?.Plot
      ? removeNamesFromPlot(movieDetails.Plot, movieDetails.Actors || null, movieDetails.Director || null)
      : null
    
    // Create plot with proper nouns replaced (for hint display)
    const plotWithRedacted = plotWithoutNames
      ? replaceProperNounsWithRedacted(plotWithoutNames)
      : null

    // Extract Academy Awards
    const academyAwards = extractAcademyAwards(movieDetails?.Awards || null)

    return NextResponse.json({
      movieId: movieStatus.movieId,
      status: movieStatus.status,
      year: movieDetails?.Year || null,
      title: movieDetails?.Title || null,
      poster: movieDetails?.Poster || null,
      plot: movieDetails?.Plot || null,
      genre: movieDetails?.Genre || null,
      rated: movieDetails?.Rated || null,
      runtime: movieDetails?.Runtime || null,
      director: movieDetails?.Director || null,
      firstActor: firstActor,
      fourthAndFifthActors: fourthAndFifth,
      plotWithoutNames: plotWithoutNames,
      plotWithRedacted: plotWithRedacted,
      academyAwards: academyAwards,
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

