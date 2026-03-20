import { NextRequest, NextResponse } from 'next/server';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const KEY = process.env.TMDB_API_KEY;

export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get('title');
  const year = req.nextUrl.searchParams.get('year') || '';
  if (!title) return NextResponse.json({ error: 'No title' }, { status: 400 });

  try {
    const searchUrl = `${TMDB_BASE}/search/movie?query=${encodeURIComponent(title)}&year=${year}&api_key=${KEY}&language=es-ES`;
    const res = await fetch(searchUrl);
    const data = await res.json();
    const movie = data.results?.[0];
    if (!movie?.poster_path) {
      const searchEn = await fetch(`${TMDB_BASE}/search/movie?query=${encodeURIComponent(title)}&api_key=${KEY}`);
      const dataEn = await searchEn.json();
      const movieEn = dataEn.results?.[0];
      if (!movieEn?.poster_path) return NextResponse.json({ poster: null });
      return NextResponse.json({ poster: `https://image.tmdb.org/t/p/w500${movieEn.poster_path}`, id: movieEn.id });
    }
    return NextResponse.json({ poster: `https://image.tmdb.org/t/p/w500${movie.poster_path}`, id: movie.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
