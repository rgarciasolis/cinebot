import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const user = req.nextUrl.searchParams.get('user');
  if (!user) return NextResponse.json({ error: 'No user' }, { status: 400 });
  try {
    const res = await fetch(`https://letterboxd.com/${user}/rss/`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Charset': 'utf-8' },
    });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const buffer = await res.arrayBuffer();
    const xml = new TextDecoder('utf-8').decode(buffer);
    const titles: string[] = [];
    const r1 = /<letterboxd:filmTitle><!\[CDATA\[([^\]]+)\]\]><\/letterboxd:filmTitle>/g;
    const r2 = /<letterboxd:filmTitle>([^<]+)<\/letterboxd:filmTitle>/g;
    let m;
    while ((m = r1.exec(xml)) !== null) titles.push(m[1]);
    if (titles.length === 0) while ((m = r2.exec(xml)) !== null) titles.push(m[1]);
    return NextResponse.json({ films: titles, total: titles.length, source: 'rss' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
