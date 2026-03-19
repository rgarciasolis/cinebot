import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const user = req.nextUrl.searchParams.get('user');
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 400 });
  try {
    const res = await fetch(`https://letterboxd.com/${user}/rss/`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    const xml = await res.text();
    return new NextResponse(xml, { headers: { 'Content-Type': 'application/xml' } });
  } catch {
    return NextResponse.json({ error: 'Error al conectar' }, { status: 500 });
  }
}
