export interface MovieStatus {
  movieId: string | number
  status: 'Seen-Liked' | 'Seen-Hated' | 'Not Seen' | null
  updatedAt: string
}

export interface MovieWithStatus {
  id: string | number
  title: string
  release_date: string
  poster_path: string | null
  backdrop_path: string | null
  overview: string
  revenue: number
  year: number
  status: 'Seen-Liked' | 'Seen-Hated' | 'Not Seen' | null
}

