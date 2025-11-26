import { neon } from '@neondatabase/serverless'
import { MovieStatus } from '@/types/movie'

// Initialize Neon database client
const sql = neon(process.env.DATABASE_URL!)

export async function getMovieStatuses(): Promise<Record<string | number, MovieStatus>> {
  try {
    const rows = await sql`
      SELECT movie_id, status, updated_at
      FROM movie_statuses
      ORDER BY updated_at DESC
    `
    
    const statuses: Record<string | number, MovieStatus> = {}
    for (const row of rows) {
      statuses[row.movie_id] = {
        movieId: row.movie_id,
        status: row.status as 'Seen-Liked' | 'Seen-Hated' | 'Not Seen',
        updatedAt: row.updated_at.toISOString(),
      }
    }
    return statuses
  } catch (error) {
    console.error('Error fetching movie statuses:', error)
    return {}
  }
}

export async function getMoviesByStatus(status: 'Seen-Liked' | 'Seen-Hated' | 'Not Seen'): Promise<MovieStatus[]> {
  try {
    const rows = await sql`
      SELECT movie_id, status, updated_at
      FROM movie_statuses
      WHERE status = ${status}
      ORDER BY updated_at DESC
    `
    
    return rows.map(row => ({
      movieId: row.movie_id,
      status: row.status as 'Seen-Liked' | 'Seen-Hated' | 'Not Seen',
      updatedAt: row.updated_at.toISOString(),
    }))
  } catch (error) {
    console.error(`Error fetching movies with status ${status}:`, error)
    return []
  }
}

export async function getMovieStats() {
  try {
    const stats = await sql`
      SELECT 
        status,
        COUNT(*) as count
      FROM movie_statuses
      GROUP BY status
    `
    
    const result: Record<string, number> = {
      'Seen-Liked': 0,
      'Seen-Hated': 0,
      'Not Seen': 0,
    }
    
    for (const row of stats) {
      result[row.status] = parseInt(row.count)
    }
    
    return result
  } catch (error) {
    console.error('Error fetching movie stats:', error)
    return {
      'Seen-Liked': 0,
      'Seen-Hated': 0,
      'Not Seen': 0,
    }
  }
}

export async function getRandomMovieFromLikedOrHated(): Promise<MovieStatus | null> {
  try {
    const rows = await sql`
      SELECT movie_id, status, updated_at
      FROM movie_statuses
      WHERE status IN ('Seen-Liked', 'Seen-Hated')
      ORDER BY RANDOM()
      LIMIT 1
    `
    
    if (rows.length === 0) {
      return null
    }
    
    const row = rows[0]
    return {
      movieId: row.movie_id,
      status: row.status as 'Seen-Liked' | 'Seen-Hated',
      updatedAt: row.updated_at.toISOString(),
    }
  } catch (error) {
    console.error('Error fetching random movie:', error)
    return null
  }
}

// Get daily movie based on date (same for all players on same day)
export async function getDailyMovie(date: string): Promise<MovieStatus | null> {
  try {
    console.log(`Getting daily movie for date: ${date}`)
    
    // Use date as seed for consistent random selection
    // Get all movies with Seen-Liked or Seen-Hated status
    const allMovies = await sql`
      SELECT movie_id, status, updated_at
      FROM movie_statuses
      WHERE status IN ('Seen-Liked', 'Seen-Hated')
      ORDER BY movie_id
    `
    
    console.log(`Found ${allMovies.length} movies with Seen-Liked or Seen-Hated status`)
    
    if (allMovies.length === 0) {
      return null
    }
    
    // Use date string to generate consistent index
    // Simple hash of date string
    let hash = 0
    for (let i = 0; i < date.length; i++) {
      const char = date.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    
    // Use hash to select movie (deterministic based on date)
    const index = Math.abs(hash) % allMovies.length
    const row = allMovies[index]
    
    console.log(`Selected movie at index ${index} (hash: ${hash}): ${row.movie_id}`)
    
    return {
      movieId: row.movie_id,
      status: row.status as 'Seen-Liked' | 'Seen-Hated',
      updatedAt: row.updated_at.toISOString(),
    }
  } catch (error) {
    console.error('Error fetching daily movie:', error)
    return null
  }
}

export async function getAllMovieIds(): Promise<string[]> {
  try {
    const rows = await sql`
      SELECT DISTINCT movie_id
      FROM movie_statuses
      WHERE status IN ('Seen-Liked', 'Seen-Hated')
    `
    
    return rows.map(row => String(row.movie_id))
  } catch (error) {
    console.error('Error fetching all movie IDs:', error)
    return []
  }
}

// Leaderboard functions
export async function initLeaderboardTable() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS leaderboard (
        id SERIAL PRIMARY KEY,
        player_name VARCHAR(255) NOT NULL,
        hints_used INTEGER NOT NULL,
        puzzle_date DATE NOT NULL,
        submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(player_name, puzzle_date)
      );
    `
  } catch (error) {
    console.error('Error initializing leaderboard table:', error)
  }
}

export async function submitToLeaderboard(
  playerName: string,
  hintsUsed: number,
  puzzleDate: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await initLeaderboardTable()
    
    await sql`
      INSERT INTO leaderboard (player_name, hints_used, puzzle_date)
      VALUES (${playerName}, ${hintsUsed}, ${puzzleDate})
      ON CONFLICT (player_name, puzzle_date) DO UPDATE SET
        hints_used = EXCLUDED.hints_used,
        submitted_at = CURRENT_TIMESTAMP;
    `
    
    return { success: true }
  } catch (error: any) {
    console.error('Error submitting to leaderboard:', error)
    return { success: false, error: error.message }
  }
}

export async function getLeaderboard(puzzleDate: string, limit: number = 10) {
  try {
    await initLeaderboardTable()
    
    const rows = await sql`
      SELECT player_name, hints_used, submitted_at
      FROM leaderboard
      WHERE puzzle_date = ${puzzleDate}
      ORDER BY hints_used ASC, submitted_at ASC
      LIMIT ${limit}
    `
    
    return rows.map(row => ({
      playerName: row.player_name,
      hintsUsed: parseInt(row.hints_used),
      submittedAt: row.submitted_at.toISOString(),
    }))
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    return []
  }
}
