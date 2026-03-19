import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { csv } = await req.json();
    const lines = csv.split('\n').filter((l: string) => l.trim());
    if (lines.length === 0) return NextResponse.json({ error: 'CSV vacío' }, { status: 400 });
    const header = lines[0].toLowerCase();
    const cols = header.split(',');
    const nameIdx = cols.findIndex((c: string) => c.includes('name') || c.includes('title'));
    const yearIdx = cols.findIndex((c: string) => c.includes('year'));
    const ratingIdx = cols.findIndex((c: string) => c.includes('rating'));
    if (nameIdx === -1) return NextResponse.json({ error: 'No se encontró columna de títulos' }, { status: 400 });
    const films = lines.slice(1).map((line: string) => {
      const parts = line.match(/(".*?"|[^,]+)(?=,|$)/g) || line.split(',');
      const clean = (s: string) => s?.replace(/^"|"$/g, '').trim() || '';
      return {
        title: clean(parts[nameIdx]),
        year: yearIdx >= 0 ? clean(parts[yearIdx]) : '',
        rating: ratingIdx >= 0 ? parseFloat(clean(parts[ratingIdx])) || null : null,
      };
    }).filter((f: {title: string, year: string, rating: number | null}) => f.title && f.title.length > 1);
    return NextResponse.json({ films, total: films.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
