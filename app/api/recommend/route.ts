import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const { films, platforms, mode, specificFilm, username, feedback } = await req.json();

    const topRated = [...films]
      .filter((f: any) => f.rating)
      .sort((a: any, b: any) => b.rating - a.rating)
      .slice(0, 25);

    const watchedTitles = films.map((f: any) => f.title.toLowerCase());
    const platformNames = platforms.join(', ');

    const likedSection = feedback?.liked?.length
      ? `\nRECOMENDACIONES QUE LE GUSTARON EN SESIONES ANTERIORES:\n${feedback.liked.map((r: any) => `- "${r.title}" (Dir: ${r.director}, Géneros: ${r.genres?.join(', ')})`).join('\n')}`
      : '';

    const dislikedSection = feedback?.disliked?.length
      ? `\nRECOMENDACIONES QUE NO LE GUSTARON:\n${feedback.disliked.map((r: any) => `- "${r.title}" (Dir: ${r.director}, Géneros: ${r.genres?.join(', ')})`).join('\n')}`
      : '';

    const rejectedGenres = feedback?.rejectedGenres?.length
      ? `\nGÉNEROS QUE DEBES EVITAR: ${feedback.rejectedGenres.join(', ')}`
      : '';

    const rejectedDirectors = feedback?.rejectedDirectors?.length
      ? `\nDIRECTORES QUE DEBES EVITAR: ${feedback.rejectedDirectors.join(', ')}`
      : '';

    const system = `Eres un experto cinematógrafo y curador de contenido. Generas recomendaciones ultra-personalizadas basadas en el historial real del usuario. Analiza patrones de géneros, directores, temáticas, épocas y estilos.

REGLAS ESTRICTAS:
- NUNCA recomiendes películas que el usuario ya ha visto (lista de excluidos provista)
- NUNCA recomiendes géneros o directores marcados como no deseados
- Ten MUY en cuenta las recomendaciones anteriores que le gustaron para afinar el perfil
- RESPONDE ÚNICAMENTE con JSON válido puro, sin texto extra ni bloques de código

Estructura exacta:
{"userProfile":"análisis del gusto cinematográfico en 2 frases","recommendations":[{"title":"título en español","originalTitle":"título original si difiere","year":"año","director":"director","genres":["género"],"reason":"por qué le gustará basándote en su historial concreto","connection":"película concreta de su historial que conecta","platform":"plataforma donde verla"}]}`;

    const userMsg = mode === 'history'
      ? `Mi historial (@${username}):

MEJOR VALORADAS:
${topRated.map((f: any) => `- "${f.title}"${f.year ? ' (' + f.year + ')' : ''} ★${f.rating}/5`).join('\n')}

OTRAS VISTAS:
${films.filter((f: any) => !f.rating).slice(0, 10).map((f: any) => `- "${f.title}"`).join('\n')}

PELÍCULAS YA VISTAS (NO RECOMENDAR NINGUNA DE ESTAS):
${watchedTitles.slice(0, 80).join(', ')}
${likedSection}${dislikedSection}${rejectedGenres}${rejectedDirectors}

Plataformas disponibles: ${platformNames}

Dame exactamente 8 recomendaciones que NO haya visto, disponibles en mis plataformas. Menciona películas concretas de mi historial en las razones.`
      : `Me encantó: "${specificFilm}"

Mi historial para contexto:
${topRated.slice(0, 15).map((f: any) => `- "${f.title}" ★${f.rating}/5`).join('\n')}

PELÍCULAS YA VISTAS (NO RECOMENDAR NINGUNA DE ESTAS):
${watchedTitles.slice(0, 80).join(', ')}
${likedSection}${dislikedSection}${rejectedGenres}${rejectedDirectors}

Plataformas disponibles: ${platformNames}

Dame exactamente 6 recomendaciones similares a "${specificFilm}" que NO haya visto, disponibles en mis plataformas.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content: userMsg }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const clean = text.replace(/```json|```/g, '').trim();
    return NextResponse.json(JSON.parse(clean));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
