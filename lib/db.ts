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

