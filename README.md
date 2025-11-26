# Danny's Movie Viewer

A web application to view and analyze the movies that Danny has reviewed in the movie tracker app.

## Features

- View statistics: See how many movies Danny has liked, hated, or not seen
- Browse by category: Filter movies by their status
- Real-time data: Connects to the same Neon database as the tracker app

## Setup

### Prerequisites

- Node.js 18+ installed
- Access to the same Neon Postgres database as the tracker app

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file in the root directory:
```
DATABASE_URL=postgresql://username:password@hostname/database?sslmode=require
```
(Use the same DATABASE_URL as your tracker app)

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment to Vercel

1. Push your code to GitHub
2. Import your repository in Vercel
3. Add the `DATABASE_URL` environment variable (same as tracker app)
4. Deploy!

## Usage

- Click on any of the stat cards (Liked, Hated, Not Seen) to view movies in that category
- The app shows movie IDs and when they were tagged
- Click again to deselect and hide the list

