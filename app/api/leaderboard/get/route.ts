import { NextRequest, NextResponse } from 'next/server'
import { getLeaderboard } from '@/lib/db'

// Mark this route as dynamic since it uses request.url
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL is not set' },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    const puzzleDate = searchParams.get('date')

    if (!puzzleDate || typeof puzzleDate !== 'string') {
      return NextResponse.json(
        { error: 'Puzzle date is required' },
        { status: 400 }
      )
    }

    // Get all leaderboard entries (no limit, we want all of them)
    const leaderboard = await getLeaderboard(puzzleDate, 1000)

    return NextResponse.json({ leaderboard })
  } catch (error: any) {
    console.error('Error fetching leaderboard:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}

