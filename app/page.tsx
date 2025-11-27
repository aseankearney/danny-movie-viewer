'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

interface PlotSegment {
  text: string
  isRedacted: boolean
}

interface GameMovie {
  movieId: string | number
  status: 'Seen-Liked' | 'Seen-Hated'
  year: string | null
  title: string | null
  poster: string | null
  plot: string | null
  genre: string | null
  rated: string | null
  runtime: string | null
  director: string | null
  firstActor: string | null
  fourthAndFifthActors: string | null
  plotWithoutNames: string | null
  plotWithRedacted: PlotSegment[] | null
  academyAwards: string | null
  puzzleDate: string
}

type GameState = 'playing' | 'won' | 'lost'

export default function Home() {
  const [gameStarted, setGameStarted] = useState(false)
  const [movie, setMovie] = useState<GameMovie | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [gameState, setGameState] = useState<GameState>('playing')
  const MAX_HINT_LEVEL = 7

  const [hintsUsed, setHintsUsed] = useState(0)
  const [guessCount, setGuessCount] = useState(0)
  const [hintsShown, setHintsShown] = useState<number[]>([])
  const [wrongMessage, setWrongMessage] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [submittingLeaderboard, setSubmittingLeaderboard] = useState(false)
  const [leaderboardSubmitted, setLeaderboardSubmitted] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboard, setLeaderboard] = useState<Array<{ playerName: string; hintsUsed: number; submittedAt: string }>>([])
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)
  const [allMovieTitles, setAllMovieTitles] = useState<string[]>([])
  const [loadingTitles, setLoadingTitles] = useState(false)
  const [loadingAutocomplete, setLoadingAutocomplete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const autocompleteTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Load all movie titles from TMDb (as fallback)
    const loadAllTitles = async () => {
      setLoadingTitles(true)
      try {
        // Get comprehensive list from TMDb (cached)
        const response = await fetch('/api/game/titles')
        const data = await response.json()
        if (data.titles && Array.isArray(data.titles)) {
          setAllMovieTitles(data.titles)
        }
      } catch (error) {
        console.error('Error loading movie titles:', error)
      } finally {
        setLoadingTitles(false)
      }
    }
    
    loadAllTitles()
    loadDailyMovie()
    
    // Cleanup timeout on unmount
    return () => {
      if (autocompleteTimeoutRef.current) {
        clearTimeout(autocompleteTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    // Close suggestions when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Don't show suggestions when input is focused and empty - only show when user types

  const loadDailyMovie = async () => {
    setLoading(true)
    setError(null)
    setGameState('playing')
    setUserAnswer('')
    setSuggestions([])
    setShowSuggestions(false)
    setHintsUsed(0)
    setHintsShown([])
    setGuessCount(0)
    setWrongMessage(null)
    setPlayerName('')
    setLeaderboardSubmitted(false)
    
    try {
      const response = await fetch('/api/game/daily')
      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || 'Failed to load movie')
        setMovie(null)
        setLoading(false)
        return
      }
      
      if (data.error) {
        setError(data.error)
        setMovie(null)
        setLoading(false)
        return
      }
      
      setMovie(data)
      setError(null)
      setLoading(false)
    } catch (error: any) {
      console.error('Error loading movie:', error)
      setError('Failed to fetch movies. Please check your connection and try again.')
      setMovie(null)
      setLoading(false)
    }
  }

  const handleInputChange = async (value: string) => {
    setUserAnswer(value)
    setWrongMessage(null) // Clear wrong message when typing
    
    // Clear any pending autocomplete requests
    if (autocompleteTimeoutRef.current) {
      clearTimeout(autocompleteTimeoutRef.current)
    }
    
    if (value.length >= 1) {
      setShowSuggestions(true)
      setLoadingAutocomplete(true)
      
      autocompleteTimeoutRef.current = setTimeout(() => {
        const valueLower = value.toLowerCase()
        
        if (allMovieTitles.length === 0) {
          setSuggestions([])
          setShowSuggestions(false)
          setLoadingAutocomplete(false)
          return
        }

        let suggestions = allMovieTitles.filter(title =>
          title.toLowerCase().includes(valueLower)
        )

        suggestions = suggestions.sort((a, b) => {
          const aLower = a.toLowerCase()
          const bLower = b.toLowerCase()
          const aStarts = aLower.startsWith(valueLower)
          const bStarts = bLower.startsWith(valueLower)
          if (aStarts && !bStarts) return -1
          if (!aStarts && bStarts) return 1
          const aIndex = aLower.indexOf(valueLower)
          const bIndex = bLower.indexOf(valueLower)
          if (aIndex !== bIndex) return aIndex - bIndex
          return a.length - b.length
        })

        if (
          movie?.title &&
          movie.title.toLowerCase().includes(valueLower) &&
          !suggestions.some(t => t.toLowerCase() === movie.title!.toLowerCase())
        ) {
          suggestions = [movie.title, ...suggestions]
        }

        const uniqueSuggestions = Array.from(new Set(suggestions))
        setSuggestions(uniqueSuggestions.slice(0, 50))
        setShowSuggestions(uniqueSuggestions.length > 0)
        setLoadingAutocomplete(false)
      }, 200)
    } else if (value.length === 0) {
      setShowSuggestions(false)
      setSuggestions([])
      setLoadingAutocomplete(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setUserAnswer(suggestion)
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  // Convert Roman numerals to Arabic numerals
  const romanToArabic = (text: string): string => {
    const romanMap: Record<string, number> = {
      'i': 1, 'v': 5, 'x': 10, 'l': 50, 'c': 100, 'd': 500, 'm': 1000
    }
    
    // Replace common Roman numeral patterns
    const patterns = [
      { roman: /(\b)([ivxlcdm]+)(\b)/gi, convert: (match: string, p1: string, roman: string, p2: string) => {
        const upper = roman.toUpperCase()
        let num = 0
        for (let i = 0; i < upper.length; i++) {
          const current = romanMap[upper[i].toLowerCase()] || 0
          const next = romanMap[upper[i + 1]?.toLowerCase()] || 0
          if (current < next) {
            num -= current
          } else {
            num += current
          }
        }
        return num > 0 ? `${p1}${num}${p2}` : match
      }}
    ]
    
    let result = text
    // Simple conversion for common cases
    const commonRomans: Record<string, string> = {
      ' i ': ' 1 ', ' ii ': ' 2 ', ' iii ': ' 3 ', ' iv ': ' 4 ', ' v ': ' 5 ',
      ' vi ': ' 6 ', ' vii ': ' 7 ', ' viii ': ' 8 ', ' ix ': ' 9 ', ' x ': ' 10 ',
      ' xi ': ' 11 ', ' xii ': ' 12 ', ' xiii ': ' 13 ', ' xiv ': ' 14 ', ' xv ': ' 15 ',
      ' xvi ': ' 16 ', ' xvii ': ' 17 ', ' xviii ': ' 18 ', ' xix ': ' 19 ', ' xx ': ' 20 '
    }
    
    for (const [roman, arabic] of Object.entries(commonRomans)) {
      result = result.replace(new RegExp(roman, 'gi'), arabic)
    }
    
    return result
  }

  const normalizeTitle = (title: string): string => {
    let normalized = title
      .toLowerCase()
      .trim()
    
    // Convert Roman numerals to Arabic
    normalized = romanToArabic(normalized)
    
    return normalized
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
  }

  const getHintText = (level: number): string | null => {
    if (!movie) return null

    switch (level) {
      case 1:
        return movie.genre ? `This movie's genre is: ${movie.genre}` : null
      case 2:
        return movie.runtime ? `This movie's runtime is: ${movie.runtime}` : null
      case 3:
        return movie.rated ? `This movie is rated: ${movie.rated}` : null
      case 4:
        if (movie.fourthAndFifthActors) {
          return `This movie features ${movie.fourthAndFifthActors}`
        }
        // Fallback: try to get any actors from the movie data
        return null
      case 5:
        return movie.director ? `This movie was directed by ${movie.director}` : null
      case 6:
        return movie.firstActor ? `This movie stars ${movie.firstActor}` : null
      case 7:
        // Return special marker for plot hint (needs special rendering)
        return movie.plotWithRedacted ? '__PLOT_HINT__' : null
      default:
        return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!movie) return

    const hasAnswer = userAnswer.trim().length > 0

    // If "No Clue" was pressed (empty answer)
    if (!hasAnswer) {
      if (hintsUsed >= MAX_HINT_LEVEL) {
        // Show loss screen
        setGameState('lost')
        return
      }
    
      // Increment hint and show it
      const nextHintLevel = hintsUsed + 1
      setHintsUsed(nextHintLevel)
      setHintsShown([...hintsShown, nextHintLevel])
      setWrongMessage(null) // Remove the "No clue used" message
      return
    }

    const nextGuessCount = guessCount + 1
    setGuessCount(nextGuessCount)

    // Check if answer is correct
    const normalizedUserAnswer = normalizeTitle(userAnswer)
    const normalizedCorrectAnswer = movie.title ? normalizeTitle(movie.title) : ''
    const correct = normalizedUserAnswer === normalizedCorrectAnswer

    if (correct) {
      // Show win screen
      setGameState('won')
      setShowSuggestions(false)
    } else {
      // Wrong answer
      if (hintsUsed >= MAX_HINT_LEVEL) {
        // Show loss screen
        setGameState('lost')
        return
      }
      
      // Increment hint and show it
      const nextHintLevel = hintsUsed + 1
      setHintsUsed(nextHintLevel)
      setHintsShown([...hintsShown, nextHintLevel])
      setWrongMessage('Wrong answer! Here\'s a hint:')
      setUserAnswer('') // Clear input for next guess
    }
  }

  const handleSubmitLeaderboard = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!movie || !playerName.trim() || leaderboardSubmitted) return

    setSubmittingLeaderboard(true)
    
    try {
      const response = await fetch('/api/leaderboard/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerName: playerName.trim(),
          hintsUsed: guessCount,
          puzzleDate: movie.puzzleDate,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setLeaderboardSubmitted(true)
        // Automatically load leaderboard after submission
        loadLeaderboard()
      } else {
        console.error('Failed to submit to leaderboard:', data.error)
        alert('Failed to submit to leaderboard. Please try again.')
      }
    } catch (error) {
      console.error('Error submitting to leaderboard:', error)
      alert('Failed to submit to leaderboard. Please try again.')
    } finally {
      setSubmittingLeaderboard(false)
    }
  }

  const loadLeaderboard = async () => {
    if (!movie) return

    setLoadingLeaderboard(true)
    try {
      const response = await fetch(`/api/leaderboard/get?date=${movie.puzzleDate}`)
      const data = await response.json()

      if (response.ok && data.leaderboard) {
        // Sort by hints used ascending (0 to max)
        const sorted = [...data.leaderboard].sort((a, b) => a.hintsUsed - b.hintsUsed)
        setLeaderboard(sorted)
      } else {
        console.error('Failed to load leaderboard:', data.error)
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error)
    } finally {
      setLoadingLeaderboard(false)
    }
  }

  const handleShowLeaderboard = () => {
    if (leaderboard.length === 0) {
      loadLeaderboard()
    }
    setShowLeaderboard(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-xl text-gray-900 dark:text-white">Loading today's puzzle...</div>
      </div>
    )
  }

  if (error || (!movie && !loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="text-center p-8 max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <h1 className="text-2xl font-bold mb-4 text-red-600 dark:text-red-400">
            {error ? 'Error Loading Game' : 'No Movies Available'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error || 'Danny needs to review some movies first in the tracker app!'}
          </p>
          {!error && (
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
              The game needs movies that Danny has marked as "Seen-Liked" or "Seen-Hated" to work.
            </p>
          )}
          <button
            onClick={loadDailyMovie}
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold touch-manipulation"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Landing page
  if (!gameStarted) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 sm:p-12 text-center">
          {/* Title */}
          <h1 className="text-4xl sm:text-5xl font-bold mb-8 text-gray-900 dark:text-white">
            Daily Danny Movie Trivia
          </h1>

          {/* Danny's Photo */}
          <div className="flex justify-center mb-8">
            <div className="relative w-48 h-48 sm:w-64 sm:h-64">
              <Image
                src="/danny-head.png"
                alt="Danny"
                fill
                className="object-contain animate-rotate-head"
                priority
              />
            </div>
          </div>

          {/* Rules */}
          <div className="mb-8">
            <p className="text-lg sm:text-xl text-gray-700 dark:text-gray-300 leading-relaxed">
              Danny has seen all of these movies, but he hasn't liked them all. Try to guess which movie he's talking about in the least amount of guesses!
            </p>
          </div>

          {/* Start Game Button */}
          <button
            onClick={() => setGameStarted(true)}
            className="px-8 py-4 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-lg font-semibold text-xl transition-colors touch-manipulation shadow-lg"
          >
            Start Game
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-8 text-gray-900 dark:text-white">
          The Daily Danny Movie Game
        </h1>

        {gameState === 'playing' && movie && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 sm:p-8 relative">
            {/* Guesses Used Counter - Top Right */}
            <div className="absolute top-4 right-4 bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-700 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 shadow-md z-10">
              <div className="text-base sm:text-lg md:text-xl font-bold text-blue-800 dark:text-blue-200">
                Guesses Used: {guessCount}
              </div>
            </div>

            {/* Year - with top padding to avoid overlap on mobile */}
            <div className="text-center mb-6 pt-12 sm:pt-6">
              <div className="text-6xl sm:text-7xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                {movie.year || '?'}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Year Released</div>
            </div>

            {/* Like/Dislike */}
            <div className="text-center mb-8">
              <div className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white mb-2">
                {movie.status === 'Seen-Liked' ? (
                  <>
                    <span className="text-3xl">👍</span> Danny liked this movie.
                  </>
                ) : (
                  <>
                    <span className="text-3xl">👎</span> Danny didn't like this movie.
                  </>
                )}
              </div>
            </div>

            {/* Wrong Message */}
            {wrongMessage && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-800 dark:text-red-200 font-semibold">{wrongMessage}</p>
              </div>
            )}

            {/* Hints Display */}
            {hintsShown.length > 0 && (
              <div className="mb-8 space-y-4">
                {hintsShown.map((hintLevel) => {
                  const hintText = getHintText(hintLevel)
                  if (!hintText) return null
                  
                  // Special handling for plot hint (hint 5)
                  if (hintText === '__PLOT_HINT__' && movie.plotWithRedacted) {
                    return (
                      <div
                        key={hintLevel}
                        className="text-center"
                      >
                        <div className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                          {movie.plotWithRedacted.map((segment, idx) => (
                            <span
                              key={idx}
                              className={segment.isRedacted ? 'text-red-600 dark:text-red-400' : ''}
                            >
                              {segment.text}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  }
                  
                  return (
                    <div
                      key={hintLevel}
                      className="text-center"
                    >
                      <div className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                        {hintText}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="relative">
              <div className="mb-4">
                <label htmlFor="movie-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  What movie is this?
                </label>
                <div className="relative">
                  <input
                    ref={inputRef}
                    id="movie-title"
                    type="text"
                    value={userAnswer}
                    onChange={(e) => handleInputChange(e.target.value)}
                    placeholder="Enter movie title..."
                    className="w-full px-4 py-3 sm:py-4 text-lg border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    autoComplete="off"
                    autoCapitalize="words"
                    autoFocus
                  />
                  
                  {/* Autocomplete Suggestions */}
                  {showSuggestions && (suggestions.length > 0 || loadingAutocomplete) && (
                    <div
                      ref={suggestionsRef}
                      className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                    >
                      {loadingAutocomplete ? (
                        <div className="px-4 py-2 text-gray-500 dark:text-gray-400 text-center">
                          Loading suggestions...
                        </div>
                      ) : (
                        suggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600 last:border-b-0"
                          >
                            {suggestion}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="w-full px-6 py-4 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-lg font-semibold text-lg transition-colors touch-manipulation"
              >
                {userAnswer.trim() ? 'Submit Answer' : 'No Clue'}
              </button>
            </form>
          </div>
        )}

        {gameState === 'won' && movie && !showLeaderboard && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 sm:p-8">
            {/* Result Message */}
            <div className="text-center mb-6">
              <div className="text-4xl sm:text-5xl font-bold mb-2 text-green-600">
                🎉 You Got It Right! 🎉
              </div>
              <div className="text-2xl sm:text-3xl font-semibold text-gray-700 dark:text-gray-300 mt-2">
                In {guessCount} {guessCount === 1 ? 'Guess' : 'Guesses'}!
              </div>
            </div>

            {/* Movie Poster */}
            {movie.poster && movie.poster !== 'N/A' ? (
              <div className="flex justify-center mb-6">
                <div className="relative w-48 sm:w-64 h-72 sm:h-96">
                  <Image
                    src={movie.poster}
                    alt={movie.title || 'Movie poster'}
                    fill
                    className="object-cover rounded-lg shadow-lg"
                  />
                </div>
              </div>
            ) : (
              <div className="flex justify-center mb-6">
                <div className="w-48 sm:w-64 h-72 sm:h-96 bg-gray-300 dark:bg-gray-600 rounded-lg flex items-center justify-center">
                  <span className="text-gray-500 dark:text-gray-400">No Image</span>
                </div>
              </div>
            )}

            {/* Movie Title and Year */}
            <div className="text-center mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {movie.title || 'Unknown Movie'}
              </h2>
              {movie.year && (
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  {movie.year}
                </p>
              )}
            </div>

            {/* Leaderboard Submission */}
            {!leaderboardSubmitted ? (
              <form onSubmit={handleSubmitLeaderboard} className="space-y-4">
                <div>
                  <label htmlFor="player-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Enter your name for the leaderboard:
                  </label>
                  <input
                    id="player-name"
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Your name..."
                    className="w-full px-4 py-3 text-lg border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                    maxLength={50}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!playerName.trim() || submittingLeaderboard}
                  className="w-full px-6 py-4 bg-green-500 hover:bg-green-600 active:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-lg transition-colors touch-manipulation"
                >
                  {submittingLeaderboard ? 'Submitting...' : 'Submit to Leaderboard'}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-green-800 dark:text-green-200 font-semibold">
                    ✓ Submitted to leaderboard!
                  </p>
                </div>
                <button
                  onClick={handleShowLeaderboard}
                  className="w-full px-6 py-4 bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white rounded-lg font-semibold text-lg transition-colors touch-manipulation"
                >
                  Show Leaderboard
                </button>
              </div>
            )}
          </div>
        )}

        {/* Leaderboard Display - Takes over win screen */}
        {gameState === 'won' && movie && showLeaderboard && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 sm:p-8">
            <h3 className="text-3xl sm:text-4xl font-bold text-center mb-6 text-gray-900 dark:text-white">
              Today's Leaderboard
            </h3>
            {loadingLeaderboard ? (
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                Loading leaderboard...
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="text-center py-8 text-gray-600 dark:text-gray-400">
                No entries yet. Be the first!
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto mb-6">
                {leaderboard.map((entry, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-xl font-bold text-gray-500 dark:text-gray-400 w-10 text-center">
                        {index + 1}
                      </span>
                      <span className="text-xl font-semibold text-gray-900 dark:text-white">
                        {entry.playerName}
                      </span>
                    </div>
                    <span className="text-xl font-semibold text-blue-600 dark:text-blue-400">
                      {entry.hintsUsed} {entry.hintsUsed === 1 ? 'Guess' : 'Guesses'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setShowLeaderboard(false)}
              className="w-full px-6 py-4 bg-gray-500 hover:bg-gray-600 active:bg-gray-700 text-white rounded-lg font-semibold text-lg transition-colors touch-manipulation"
            >
              Back to Win Screen
            </button>
          </div>
        )}

        {gameState === 'lost' && movie && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 sm:p-8">
            {/* Result Message */}
            <div className="text-center mb-6">
              <div className="text-4xl sm:text-5xl font-bold mb-2 text-red-600">
                ❌ You got it wrong!
              </div>
            </div>

            {/* Movie Poster */}
            {movie.poster && movie.poster !== 'N/A' ? (
              <div className="flex justify-center mb-6">
                <div className="relative w-48 sm:w-64 h-72 sm:h-96">
                  <Image
                    src={movie.poster}
                    alt={movie.title || 'Movie poster'}
                    fill
                    className="object-cover rounded-lg shadow-lg"
                  />
                </div>
              </div>
            ) : (
              <div className="flex justify-center mb-6">
                <div className="w-48 sm:w-64 h-72 sm:h-96 bg-gray-300 dark:bg-gray-600 rounded-lg flex items-center justify-center">
                  <span className="text-gray-500 dark:text-gray-400">No Image</span>
                </div>
              </div>
            )}

            {/* Movie Title and Year */}
            <div className="text-center mb-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {movie.title || 'Unknown Movie'}
              </h2>
              {movie.year && (
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  {movie.year}
                </p>
              )}
            </div>

            <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
              Better luck tomorrow! Come back for a new daily puzzle.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
