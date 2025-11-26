'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

interface GameMovie {
  movieId: string | number
  status: 'Seen-Liked' | 'Seen-Hated'
  year: string | null
  title: string | null
  poster: string | null
  plot: string | null
}

export default function Home() {
  const [movie, setMovie] = useState<GameMovie | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [loadingAutocomplete, setLoadingAutocomplete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadNewMovie()
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

  const loadNewMovie = async () => {
    setLoading(true)
    setError(null)
    setSubmitted(false)
    setUserAnswer('')
    setSuggestions([])
    setShowSuggestions(false)
    
    try {
      const response = await fetch('/api/game/random')
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
    
    if (value.length >= 2) {
      setLoadingAutocomplete(true)
      setShowSuggestions(true)
      
      try {
        const response = await fetch(`/api/game/autocomplete?q=${encodeURIComponent(value)}`)
        const data = await response.json()
        setSuggestions(data.suggestions || [])
      } catch (error) {
        console.error('Error fetching autocomplete:', error)
        setSuggestions([])
      } finally {
        setLoadingAutocomplete(false)
      }
    } else {
      setSuggestions([])
      setShowSuggestions(false)
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!movie || !userAnswer.trim()) return
    
    // Normalize both answers for comparison
    const normalizedUserAnswer = normalizeTitle(userAnswer)
    const normalizedCorrectAnswer = movie.title ? normalizeTitle(movie.title) : ''
    
    // Check if answer is correct (flexible matching)
    const correct = normalizedUserAnswer === normalizedCorrectAnswer
    
    setIsCorrect(correct)
    setSubmitted(true)
    setShowSuggestions(false)
  }

  const handleNewGame = () => {
    loadNewMovie()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-xl text-gray-900 dark:text-white">Loading game...</div>
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
            onClick={loadNewMovie}
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

        {!submitted ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 sm:p-8">
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
                        <div className="px-4 py-2 text-gray-500 dark:text-gray-400">Loading...</div>
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
                disabled={!userAnswer.trim()}
                className="w-full px-6 py-4 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-lg transition-colors touch-manipulation"
              >
                Submit Answer
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 sm:p-8">
            {/* Result Message */}
            <div className="text-center mb-6">
              <div className={`text-4xl sm:text-5xl font-bold mb-2 ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                {isCorrect ? '🎉 You Got It Right! 🎉' : '❌ You got it wrong!'}
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

            {/* Your Answer */}
            <div className="text-center mb-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Your answer:</div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {userAnswer || '(No answer)'}
              </div>
            </div>

            {/* New Game Button */}
            <button
              onClick={handleNewGame}
              className="w-full px-6 py-4 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white rounded-lg font-semibold text-lg transition-colors touch-manipulation"
            >
              Play Again
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
