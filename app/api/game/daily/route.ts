import { NextResponse } from 'next/server'
import { getDailyMovie } from '@/lib/db'
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

    const movieStatus = await getDailyMovie(today)
    
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

