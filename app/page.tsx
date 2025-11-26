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
  const [movie, setMovie] = useState<GameMovie | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [gameState, setGameState] = useState<GameState>('playing')
  const [hintsUsed, setHintsUsed] = useState(0)
  const [hintsShown, setHintsShown] = useState<number[]>([])
  const [wrongMessage, setWrongMessage] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [submittingLeaderboard, setSubmittingLeaderboard] = useState(false)
  const [leaderboardSubmitted, setLeaderboardSubmitted] = useState(false)
  const [allMovieTitles, setAllMovieTitles] = useState<string[]>([])
  const [loadingTitles, setLoadingTitles] = useState(false)
  const [loadingAutocomplete, setLoadingAutocomplete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Pre-load movie titles for each letter of the alphabet
    const loadInitialTitles = async () => {
      setLoadingTitles(true)
      const titles: string[] = []
      const seenTitles = new Set<string>()

      // Load 10 movies for each letter
      for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
        try {
          const response = await fetch(`/api/game/autocomplete?letter=${letter}`)
          const data = await response.json()
          if (data.suggestions && Array.isArray(data.suggestions)) {
            for (const title of data.suggestions) {
              if (!seenTitles.has(title)) {
                titles.push(title)
                seenTitles.add(title)
              }
            }
          }
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (error) {
          console.error(`Error loading titles for letter ${letter}:`, error)
        }
      }

      setAllMovieTitles(titles)
      setLoadingTitles(false)
    }
    
    loadInitialTitles()
    loadDailyMovie()
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

  const loadDailyMovie = async () => {
    setLoading(true)
    setError(null)
    setGameState('playing')
    setUserAnswer('')
    setSuggestions([])
    setShowSuggestions(false)
    setHintsUsed(0)
    setHintsShown([])
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
    
    if (value.length >= 1) {
      setLoadingAutocomplete(true)
      setShowSuggestions(true)
      
      try {
        // Search OMDb for movies matching the query
        const response = await fetch(`/api/game/autocomplete?q=${encodeURIComponent(value)}`)
        const data = await response.json()
        
        let suggestions = data.suggestions || []
        
        // Ensure the correct movie is included if it matches
        if (movie?.title && 
            movie.title.toLowerCase().includes(value.toLowerCase()) && 
            !suggestions.includes(movie.title)) {
          suggestions = [movie.title, ...suggestions]
        }
        
        setSuggestions(suggestions.slice(0, 50))
        setShowSuggestions(suggestions.length > 0)
      } catch (error) {
        console.error('Error fetching autocomplete:', error)
        setSuggestions([])
      } finally {
        setLoadingAutocomplete(false)
      }
    } else if (value.length === 0) {
      // Show initial suggestions from pre-loaded titles
      if (allMovieTitles.length > 0) {
        setSuggestions(allMovieTitles.slice(0, 50))
        setShowSuggestions(true)
      } else {
        setSuggestions([])
        setShowSuggestions(false)
      }
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setUserAnswer(suggestion)
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const normalizeTitle = (title: string): string => {
    return title
      .toLowerCase()
      .trim()
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
        return movie.academyAwards || null
      case 5:
        return movie.fourthAndFifthActors ? `This movie features ${movie.fourthAndFifthActors}` : null
      case 6:
        return movie.director ? `This movie was directed by ${movie.director}` : null
      case 7:
        return movie.firstActor ? `This movie stars ${movie.firstActor}` : null
      case 8:
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
        if (hintsUsed >= 8) {
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
      if (hintsUsed >= 8) {
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
          hintsUsed: hintsUsed,
          puzzleDate: movie.puzzleDate,
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setLeaderboardSubmitted(true)
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

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-8 text-gray-900 dark:text-white">
          The Daily Danny Movie Game
        </h1>

        {gameState === 'playing' && movie && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 sm:p-8 relative">
            {/* Hints Used Counter - Top Right */}
            <div className="absolute top-4 right-4 text-sm font-semibold text-gray-600 dark:text-gray-400">
              Hints Used: {hintsUsed}
            </div>

            {/* Year */}
            <div className="text-center mb-6">
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
                  {showSuggestions && suggestions.length > 0 && (
                    <div
                      ref={suggestionsRef}
                      className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                    >
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600 last:border-b-0"
                        >
                          {suggestion}
                        </button>
                      ))}
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

        {gameState === 'won' && movie && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 sm:p-8">
            {/* Result Message */}
            <div className="text-center mb-6">
              <div className="text-4xl sm:text-5xl font-bold mb-2 text-green-600">
                🎉 You Got It Right! 🎉
              </div>
              <div className="text-2xl sm:text-3xl font-semibold text-gray-700 dark:text-gray-300 mt-2">
                In {hintsUsed} {hintsUsed === 1 ? 'Hint' : 'Hints'}!
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
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-green-800 dark:text-green-200 font-semibold">
                  ✓ Submitted to leaderboard!
                </p>
              </div>
            )}
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
