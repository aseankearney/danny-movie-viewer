const TMDB_API_KEY = process.env.TMDB_API_KEY || ''
const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'

interface TMDbMovieResult {
  title: string
  release_date?: string
  id: number
}

interface TMDbSearchResponse {
  page: number
  total_pages: number
  total_results: number
  results: TMDbMovieResult[]
}

interface TMDbFindResponse {
  movie_results?: Array<{ id: number }>
}

interface TMDbGenre {
  id: number
  name: string
}

interface TMDbCastMember {
  name: string
  order: number
}

interface TMDbCrewMember {
  name: string
  job: string
}

interface TMDbReleaseDateEntry {
  certification: string
  release_date: string
}

interface TMDbReleaseDatesResult {
  iso_3166_1: string
  release_dates: TMDbReleaseDateEntry[]
}

interface TMDbMovieDetailsResponse {
  id: number
  imdb_id?: string
  title: string
  overview?: string
  runtime?: number
  release_date?: string
  poster_path?: string
  genres?: TMDbGenre[]
  credits?: {
    cast?: TMDbCastMember[]
    crew?: TMDbCrewMember[]
  }
  release_dates?: {
    results?: TMDbReleaseDatesResult[]
  }
}

export interface TMDbMovieDetails {
  tmdbId: number
  imdbId?: string
  title: string | null
  year: string | null
  poster: string | null
  plot: string | null
  genre: string | null
  rated: string | null
  runtime: string | null
  director: string | null
  firstActor: string | null
  fourthAndFifthActors: string | null
  academyAwards: string | null
  actorsText: string | null
}

async function fetchTMDb<T>(endpoint: string, params: Record<string, string | number>) {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY is not set')
  }

  const url = new URL(`${TMDB_BASE_URL}${endpoint}`)
  url.searchParams.set('api_key', TMDB_API_KEY)
  url.searchParams.set('language', 'en-US')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value))
  }

  const response = await fetch(url.toString(), { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`TMDb API error: ${response.statusText}`)
  }
  const data: T = await response.json()
  return data
}

export async function searchTMDbMovies(query: string, page: number = 1): Promise<string[]> {
  if (!query.trim()) return []

  try {
    const data = await fetchTMDb<TMDbSearchResponse>('/search/movie', {
      query,
      page,
      include_adult: 'false',
    })

    if (!data.results || data.results.length === 0) {
      return []
    }

    const titles = data.results
      .filter(result => result && result.title)
      .map(result => result.title.trim())

    return Array.from(new Set(titles))
  } catch (error) {
    console.error(`Error searching TMDb for "${query}"`, error)
    return []
  }
}

export async function getTMDbMoviesByLetter(letter: string, limit: number = 10): Promise<string[]> {
  if (!letter || letter.length !== 1) return []

  const upperLetter = letter.toUpperCase()
  const titles: string[] = []
  const seen = new Set<string>()

  for (let page = 1; page <= 5; page++) {
    if (titles.length >= limit) break

    const results = await searchTMDbMovies(upperLetter, page)
    for (const title of results) {
      if (
        title.toUpperCase().startsWith(upperLetter) &&
        !seen.has(title.toLowerCase())
      ) {
        titles.push(title)
        seen.add(title.toLowerCase())
        if (titles.length >= limit) break
      }
    }
  }

  return titles.slice(0, limit)
}

function formatPoster(path?: string | null) {
  if (!path) return null
  return `${TMDB_IMAGE_BASE_URL}${path}`
}

function formatGenres(genres?: TMDbGenre[]) {
  if (!genres || genres.length === 0) return null
  return genres.map(g => g.name).join(', ')
}

function formatRuntime(runtime?: number | null) {
  if (!runtime || runtime <= 0) return null
  return `${runtime} min`
}

function getUSCertification(results?: TMDbReleaseDatesResult[]) {
  if (!results) return null
  const usRelease = results.find(result => result.iso_3166_1 === 'US')
  const certification =
    usRelease?.release_dates?.find(date => date.certification)?.certification ||
    results
      .flatMap(result => result.release_dates || [])
      .find(date => date.certification)?.certification

  return certification || null
}

function getDirector(crew?: TMDbCrewMember[]) {
  if (!crew) return null
  const director = crew.find(member => member.job === 'Director')
  return director?.name || null
}

function getCastInfo(cast?: TMDbCastMember[]) {
  if (!cast || cast.length === 0) {
    return {
      firstActor: null,
      fourthAndFifthActors: null,
      actorsText: null,
    }
  }

  const sortedCast = [...cast].sort((a, b) => a.order - b.order)
  const firstActor = sortedCast[0]?.name || null
  const fourthActor = sortedCast[3]?.name || null
  const fifthActor = sortedCast[4]?.name || null

  let fourthAndFifthActors: string | null = null
  if (fourthActor && fifthActor) {
    fourthAndFifthActors = `${fourthActor} and ${fifthActor}`
  } else if (fourthActor) {
    fourthAndFifthActors = fourthActor
  } else if (fifthActor) {
    fourthAndFifthActors = fifthActor
  }

  return {
    firstActor,
    fourthAndFifthActors,
    actorsText: sortedCast.slice(0, 10).map(actor => actor.name).join(', ') || null,
  }
}

export async function getTopGrossingMoviesByYear(year: number, limit: number = 25): Promise<string[]> {
  if (!TMDB_API_KEY) {
    return []
  }

  try {
    const titles: string[] = []
    const seen = new Set<string>()
    
    // Use discover endpoint to get top-grossing movies by revenue for the year
    // We'll fetch multiple pages to get at least 25 movies
    for (let page = 1; page <= 3; page++) {
      if (titles.length >= limit) break
      
      const data = await fetchTMDb<TMDbSearchResponse>('/discover/movie', {
        'primary_release_year': year,
        'sort_by': 'revenue.desc',
        page,
        'include_adult': 'false',
      })

      if (!data.results || data.results.length === 0) {
        break
      }

      for (const movie of data.results) {
        if (movie.title && !seen.has(movie.title.toLowerCase())) {
          titles.push(movie.title.trim())
          seen.add(movie.title.toLowerCase())
          if (titles.length >= limit) break
        }
      }

      // Small delay to avoid rate limiting
      if (page < 3 && titles.length < limit) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    return titles.slice(0, limit)
  } catch (error) {
    console.error(`Error fetching top-grossing movies for year ${year}:`, error)
    return []
  }
}

export async function getTMDbMovieDetailsByIMDbId(imdbId: string): Promise<TMDbMovieDetails | null> {
  if (!imdbId || !imdbId.startsWith('tt')) {
    return null
  }

  try {
    const findResponse = await fetchTMDb<TMDbFindResponse>(`/find/${imdbId}`, {
      external_source: 'imdb_id',
    })

    const tmdbId = findResponse.movie_results?.[0]?.id
    if (!tmdbId) {
      return null
    }

    const movie = await fetchTMDb<TMDbMovieDetailsResponse>(`/movie/${tmdbId}`, {
      append_to_response: 'credits,release_dates',
    })

    const { firstActor, fourthAndFifthActors, actorsText } = getCastInfo(movie.credits?.cast)

    return {
      tmdbId,
      imdbId: movie.imdb_id || imdbId,
      title: movie.title || null,
      year: movie.release_date ? movie.release_date.slice(0, 4) : null,
      poster: formatPoster(movie.poster_path),
      plot: movie.overview || null,
      genre: formatGenres(movie.genres),
      rated: getUSCertification(movie.release_dates?.results),
      runtime: formatRuntime(movie.runtime),
      director: getDirector(movie.credits?.crew),
      firstActor,
      fourthAndFifthActors,
      academyAwards: 'Academy Awards data is not available via TMDb',
      actorsText: actorsText || null,
    }
  } catch (error) {
    console.error(`Error fetching TMDb details for ${imdbId}`, error)
    return null
  }
}

