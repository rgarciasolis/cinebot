import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

function normalize(s: string) {
  return s.toLowerCase().trim()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');
}

export async function POST(req: NextRequest) {
  try {
    const { films, platforms, mode, specificFilm, username, feedback } = await req.json();
    const watchedNormalized = new Set(films.map((f: any) => normalize(f.title)));
    const previousNormalized = new Set((feedback?.previouslyRecommended || []).map(normalize));
    const allExcludedNormalized = new Set([...watchedNormalized, ...previousNormalized]);
    const watchedTitles = films.map((f: any) => f.title);
    const previousTitles = feedback?.previouslyRecommended || [];
    const allExcludedTitles = [...new Set([...watchedTitles, ...previousTitles])];
    const topRated = [...films].filter((f: any) => f.rating).sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0)).slice(0, 30);
    const platformNames = platforms.join(', ');
    const likedSection = feedback?.liked?.length ? `\nRECOMENDACIONES QUE LE GUSTARON:\n${feedback.liked.map((r: any) => `- "${r.title}" (Dir: ${r.director}, Géneros: ${r.genres?.join(', ')})`).join('\n')}` : '';
    const dislikedSection = feedback?.disliked?.length ? `\nRECOMENDACIONES QUE NO LE GUSTARON:\n${feedback.disliked.map((r: any) => `- "${r.title}" (Dir: ${r.director}, Géneros: ${r.genres?.join(', ')})`).join('\n')}` : '';
    const rejectedGenres = feedback?.rejectedGenres?.length ? `\nGÉNEROS A EVITAR: ${feedback.rejectedGenres.join(', ')}` : '';
    const rejectedDirectors = feedback?.rejectedDirectors?.length ? `\nDIRECTORES A EVITAR: ${feedback.rejectedDirectors.join(', ')}` : '';

    const system = `Eres un experto cinematógrafo y curador de contenido. Generas recomendaciones ultra-personalizadas.

REGLAS ABSOLUTAS:
1. NUNCA recomiendes ningún título que aparezca en la lista de excluidos, ni siquiera con título en otro idioma
2. Comprueba cada recomendación contra la lista de excluidos antes de incluirla
3. NUNCA repitas géneros o directores marcados como no deseados
4. El campo "englishTitle" debe ser siempre el título original en inglés para construir URLs
5. RESPONDE ÚNICAMENTE con JSON puro válido, sin texto extra ni bloques de código

Estructura exacta:
{"userProfile":"análisis del gusto cinematográfico en 2 frases","recommendations":[{"title":"título en español o idioma original","englishTitle":"título en inglés para URL","year":"año","director":"director","genres":["género"],"reason":"por qué le gustará referenciando títulos concretos de su historial","connection":"título concreto de su historial que conecta","platform":"plataforma donde verla"}]}`;

    const exclusionList = allExcludedTitles.slice(0, 600).join(' | ');
    const userMsg = mode === 'history'
      ? `Historial de @${username} (${films.length} películas):\n\nMEJOR VALORADAS:\n${topRated.map((f: any) => `- "${f.title}"${f.year ? ' (' + f.year + ')' : ''}${f.rating ? ' ★' + f.rating + '/5' : ''}`).join('\n')}\n\nOTRAS VISTAS:\n${films.filter((f: any) => !topRated.find((t: any) => t.title === f.title)).slice(0, 40).map((f: any) => `- "${f.title}"`).join('\n')}${likedSection}${dislikedSection}${rejectedGenres}${rejectedDirectors}\n\nEXCLUIDOS — NO RECOMENDAR (${allExcludedTitles.length} títulos):\n${exclusionList}\n\nPlataformas: ${platformNames}\n\nDame exactamente 8 recomendaciones que NO estén en la lista de excluidos.`
      : `Me encantó: "${specificFilm}"\n\nHistorial (${films.length} películas):\n${topRated.slice(0, 20).map((f: any) => `- "${f.title}"${f.rating ? ' ★' + f.rating + '/5' : ''}`).join('\n')}${likedSection}${dislikedSection}${rejectedGenres}${rejectedDirectors}\n\nEXCLUIDOS — NO RECOMENDAR (${allExcludedTitles.length} títulos):\n${exclusionList}\n\nPlataformas: ${platformNames}\n\nDame exactamente 6 recomendaciones similares a "${specificFilm}" que NO estén en la lista de excluidos.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      system,
      messages: [{ role: 'user', content: userMsg }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    parsed.recommendations = (parsed.recommendations || []).filter((r: any) => {
      const n = normalize(r.title);
      const ne = normalize(r.englishTitle || '');
      return !allExcludedNormalized.has(n) && !allExcludedNormalized.has(ne);
    });
    return NextResponse.json(parsed);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
