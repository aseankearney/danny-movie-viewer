import { NextRequest, NextResponse } from 'next/server'
import { submitToLeaderboard } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'DATABASE_URL is not set' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { playerName, hintsUsed, puzzleDate } = body

    if (!playerName || typeof playerName !== 'string' || playerName.trim().length === 0) {
      return NextResponse.json(
        { error: 'Player name is required' },
        { status: 400 }
      )
    }

    if (typeof hintsUsed !== 'number' || hintsUsed < 0 || hintsUsed > 6) {
      return NextResponse.json(
        { error: 'Invalid hints used value' },
        { status: 400 }
      )
    }

    if (!puzzleDate || typeof puzzleDate !== 'string') {
      return NextResponse.json(
        { error: 'Puzzle date is required' },
        { status: 400 }
      )
    }

    const result = await submitToLeaderboard(
      playerName.trim(),
      hintsUsed,
      puzzleDate
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to submit to leaderboard' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error submitting to leaderboard:', error)
    return NextResponse.json(
      { error: 'Failed to submit to leaderboard' },
      { status: 500 }
    )
  }
}

