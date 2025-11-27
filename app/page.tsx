'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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
  const [loading, setLoading] = useState(false) // Start as false, will be set to true when loading starts
  const [error, setError] = useState<string | null>(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [gameState, setGameState] = useState<GameState>('playing')
  const MAX_HINT_LEVEL = 6

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
    console.log('[Component] Component mounted, initializing...')
    // Load top-grossing movie titles from TMDb in the background
    // This starts immediately when the page loads (even on landing page)
    const loadTopGrossingTitles = async () => {
      setLoadingTitles(true)
      try {
        // Get top 10 highest-grossing movies per year (1989-2025) from TMDb (cached, loads in background)
        const response = await fetch('/api/game/top-grossing')
        const data = await response.json()
        if (data.titles && Array.isArray(data.titles)) {
          setAllMovieTitles(data.titles)
          console.log(`Loaded ${data.titles.length} top-grossing movie titles`)
        }
      } catch (error) {
        console.error('Error loading top-grossing movie titles:', error)
      } finally {
        setLoadingTitles(false)
      }
    }
    
    // Start loading top-grossing movies immediately in the background
    loadTopGrossingTitles()
    
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

  const loadDailyMovie = useCallback(async (retryCount = 0) => {
    console.log(`[loadDailyMovie] Function called (attempt ${retryCount + 1})`)
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
      console.log('[loadDailyMovie] Starting fetch to /api/game/daily...')
      
      // Use AbortController for more reliable timeout (10 seconds - Vercel free tier limit)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.warn('[loadDailyMovie] Request timeout after 10s - aborting fetch')
        controller.abort()
      }, 10000)
      
      console.log('[loadDailyMovie] Fetch initiated, waiting for response...')
      const fetchStartTime = Date.now()
      const response = await fetch('/api/game/daily', {
        signal: controller.signal
      })
      const fetchTime = Date.now() - fetchStartTime
      
      clearTimeout(timeoutId)
      console.log(`[loadDailyMovie] Got response after ${fetchTime}ms:`, response.status, response.statusText)
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error(`[loadDailyMovie] API error (${response.status}):`, errorData)
        
        // Don't retry on 404 (no movies) - that's a real error
        if (response.status === 404) {
          setError(errorData.error || 'No movies available')
          setMovie(null)
          setLoading(false)
          return
        }
        
        // For other errors, might be transient - allow retry
        setError(errorData.error || 'Failed to load movie')
        setMovie(null)
        setLoading(false)
        return
      }
      
      const data = await response.json()
      console.log('Got movie data:', data.title || 'No title')
      
      if (data.error) {
        console.error('Data error:', data.error)
        setError(data.error)
        setMovie(null)
        setLoading(false)
        return
      }
      
      setMovie(data)
      setError(null)
      setLoading(false)
      console.log('Movie loaded successfully')
    } catch (error: any) {
      console.error(`[loadDailyMovie] Error on attempt ${retryCount + 1}:`, error)
      
      // Auto-retry once if it's the first attempt and not a timeout or 404 (404 means no movies, don't retry)
      const is404 = error.message?.includes('404') || error.message?.includes('No movies')
      if (retryCount === 0 && error.name !== 'AbortError' && !error.message?.includes('timeout') && !is404) {
        console.log('[loadDailyMovie] Retrying after 1000ms...')
        setTimeout(() => {
          loadDailyMovie(1)
        }, 1000)
        return
      }
      
      if (error.name === 'AbortError' || error.message?.includes('timeout') || error.message?.includes('abort')) {
        setError('Request timed out after 10 seconds. The TMDb API may be slow or rate-limited. Please try refreshing the page.')
      } else {
        setError(`Failed to fetch movies: ${error.message || 'Please check your connection and try again.'}`)
      }
      setMovie(null)
      setLoading(false)
    }
  }, [])

  // Don't auto-load - only load when Start Game button is clicked

  // Fallback timeout: if loading takes more than 12 seconds, show error
  useEffect(() => {
    if (loading && gameStarted) {
      const timeoutId = setTimeout(() => {
        console.error('Loading timeout - taking too long (fallback)')
        setError('The puzzle is taking too long to load. This might be due to TMDb API rate limits or network issues. Please try refreshing the page.')
        setLoading(false)
      }, 12000)
      
      return () => clearTimeout(timeoutId)
    }
  }, [loading, gameStarted])

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

        // If the correct movie title matches the query, include it in suggestions
        if (movie?.title && movie.title.toLowerCase().includes(valueLower)) {
          const correctTitle = movie.title
          // Only add if it's not already in the list
          if (!suggestions.some(t => t.toLowerCase() === correctTitle.toLowerCase())) {
            suggestions.push(correctTitle)
          }
        }

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
          // Then sort alphabetically
          return aLower.localeCompare(bLower)
        })

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
    
    // Remove punctuation
    normalized = normalized.replace(/[^\w\s]/g, '')
    
    // Normalize whitespace
    normalized = normalized.replace(/\s+/g, ' ')
    
    // Remove spaces between words and numbers (so "ghostbusters 2" and "ghostbusters2" both become "ghostbusters2")
    // This handles: "word 2" -> "word2" and "2 word" -> "2word"
    normalized = normalized.replace(/(\w)\s+(\d+)/g, '$1$2') // Remove space before number
    normalized = normalized.replace(/(\d+)\s+(\w)/g, '$1$2') // Remove space after number
    
    // Final whitespace normalization
    normalized = normalized.replace(/\s+/g, ' ').trim()
    
    return normalized
  }

  const getHintText = (level: number): string | null => {
    if (!movie) return null

    switch (level) {
      case 1:
        return movie.genre ? `This movie's genre is: ${movie.genre}` : null
      case 2:
        return movie.rated ? `This movie is rated: ${movie.rated}` : null
      case 3:
        if (movie.fourthAndFifthActors) {
          return `Danny probably doesn't know these actors that were in this movie: ${movie.fourthAndFifthActors}`
        }
        // Fallback: try to get any actors from the movie data
        return null
      case 4:
        return movie.director ? `Danny probably doesn't know that ${movie.director} directed this movie.` : null
      case 5:
        return movie.firstActor ? `Danny definitely knows that ${movie.firstActor} starred in this movie.` : null
      case 6:
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

    // Increment guess count for any action (no clue, wrong, or correct)
    const nextGuessCount = guessCount + 1
    setGuessCount(nextGuessCount)

    // If "No Clue" was pressed (empty answer)
    if (!hasAnswer) {
      if (hintsUsed >= 6) {
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
      if (hintsUsed >= 6) {
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
        <div className="text-center">
          <div className="text-xl text-gray-900 dark:text-white mb-4">Loading today's puzzle...</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">This may take a few seconds</div>
        </div>
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
          <div className="space-y-2">
            <button
              onClick={() => {
                setError(null)
                setLoading(true)
                loadDailyMovie()
              }}
              className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold touch-manipulation"
            >
              Try Again
            </button>
            {error && (
              <button
                onClick={() => {
                  setError(null)
                  setGameStarted(false)
                }}
                className="w-full px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold touch-manipulation"
              >
                Back to Landing Page
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Landing page
  if (!gameStarted) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="max-w-2xl w-full bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg shadow-lg p-8 sm:p-12 text-center">
          {/* Title */}
          <h1 className="text-4xl sm:text-5xl font-bold mb-8 text-blue-600 dark:text-blue-400">
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
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-gray-900 dark:text-white">
              How To Play
            </h2>
            <ol className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed space-y-2 text-left max-w-md mx-auto">
              <li>1. You have 6 chances to guess the title of a movie that Danny has seen.</li>
              <li>2. Do it in the least amount of guesses to make the top of the leaderboard.</li>
              <li>3. Come back tomorrow for a brand new puzzle!</li>
            </ol>
          </div>

          {/* Start Game Button */}
          <button
            onClick={() => {
              setGameStarted(true)
              // Load the movie when Start Game is clicked
              setTimeout(() => {
                loadDailyMovie()
              }, 100)
            }}
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
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-8 text-blue-600 dark:text-blue-400">
          The Daily Danny Movie Game
        </h1>

        {gameState === 'playing' && movie && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 sm:p-8 relative">
            {/* Guesses Counter - Top Center */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-300 dark:border-blue-700 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 shadow-md z-10">
              <div className="text-base sm:text-lg md:text-xl font-bold text-blue-800 dark:text-blue-200">
                Guesses: {guessCount}
              </div>
            </div>

            {/* Danny's Age - with top padding to avoid overlap on mobile */}
            <div className="text-center mb-6 pt-12 sm:pt-6">
              {movie.year ? (() => {
                const movieYear = parseInt(movie.year)
                const dannyAge = movieYear - 1983
                return (
                  <div className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                    Danny was {dannyAge} years old when this movie was released.
                  </div>
                )
              })() : (
                <div className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                  Year unknown
                </div>
              )}
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
                  
                  // Special handling for plot hint (hint 7)
                  if (hintText === '__PLOT_HINT__' && movie.plotWithRedacted) {
                    const plotPrefix = movie.status === 'Seen-Liked' 
                      ? "Hey fools, just saw a great movie! "
                      : "Hey fools, this movie was stupid. It was about "
                    
                    return (
                      <div
                        key={hintLevel}
                        className="text-center"
                      >
                        <div className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                          Danny would describe this movie like this: {plotPrefix}
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
                  
                  // Check if hint contains actor names that need to be styled
                  const actorHints = [
                    'Danny probably doesn\'t know these actors that were in this movie:',
                    'Danny probably doesn\'t know that',
                    'Danny definitely knows that'
                  ]
                  const isActorHint = actorHints.some(prefix => hintText.includes(prefix))
                  
                  if (isActorHint) {
                    // Extract actor names and make them bold and blue
                    let formattedText = hintText
                    
                    // For fourthAndFifthActors hint
                    if (hintText.includes('Danny probably doesn\'t know these actors')) {
                      const match = hintText.match(/Danny probably doesn't know these actors that were in this movie: (.+)/)
                      if (match && match[1]) {
                        const actors = match[1].split(' and ').map(a => a.trim())
                        formattedText = (
                          <>
                            Danny probably doesn't know these actors that were in this movie:{' '}
                            {actors.map((actor, idx) => (
                              <span key={idx}>
                                <span className="font-bold text-blue-600 dark:text-blue-400">{actor}</span>
                                {idx < actors.length - 1 ? ' and ' : ''}
                              </span>
                            ))}
                          </>
                        )
                      }
                    }
                    // For director hint
                    else if (hintText.includes('Danny probably doesn\'t know that') && movie.director) {
                      const parts = hintText.split(movie.director)
                      formattedText = (
                        <>
                          {parts[0]}
                          <span className="font-bold text-blue-600 dark:text-blue-400">{movie.director}</span>
                          {parts[1]}
                        </>
                      )
                    }
                    // For first actor hint
                    else if (hintText.includes('Danny definitely knows that') && movie.firstActor) {
                      const parts = hintText.split(movie.firstActor)
                      formattedText = (
                        <>
                          {parts[0]}
                          <span className="font-bold text-blue-600 dark:text-blue-400">{movie.firstActor}</span>
                          {parts[1]}
                        </>
                      )
                    }
                    
                    return (
                      <div
                        key={hintLevel}
                        className="text-center"
                      >
                        <div className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                          {formattedText}
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
