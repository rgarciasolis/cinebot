'use client';
import { useState, useEffect, useRef } from 'react';

const PLATFORMS = [
  { id: 'Netflix', label: 'Netflix' },
  { id: 'HBO Max', label: 'HBO Max' },
  { id: 'Prime Video', label: 'Prime Video' },
  { id: 'Disney+', label: 'Disney+' },
  { id: 'Apple TV+', label: 'Apple TV+' },
  { id: 'Movistar+', label: 'Movistar+' },
  { id: 'MUBI', label: 'MUBI' },
  { id: 'Filmin', label: 'Filmin' },
  { id: 'SkyShowtime', label: 'SkyShowtime' },
  { id: 'Rakuten TV', label: 'Rakuten TV' },
];

interface Film { title: string; year?: string; rating?: number | null; }
interface Rec { title: string; englishTitle?: string; originalTitle?: string; year: string; director: string; genres: string[]; reason: string; connection: string; platform: string; }
interface Feedback {
  liked: Rec[]; disliked: Rec[];
  rejectedGenres: string[]; rejectedDirectors: string[];
  previouslyRecommended: string[];
}

const EMPTY_FEEDBACK: Feedback = { liked: [], disliked: [], rejectedGenres: [], rejectedDirectors: [], previouslyRecommended: [] };

function normalizeFeedback(f: any): Feedback {
  return {
    liked: f?.liked || [], disliked: f?.disliked || [],
    rejectedGenres: f?.rejectedGenres || [], rejectedDirectors: f?.rejectedDirectors || [],
    previouslyRecommended: f?.previouslyRecommended || [],
  };
}

function letterboxdUrl(rec: Rec): string {
  const title = rec.englishTitle || rec.originalTitle || rec.title;
  const slug = title.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, '+');
  return `https://letterboxd.com/search/${slug}/`;
}

function loadStorage<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function saveStorage(key: string, value: any) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export default function Home() {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [films, setFilms] = useState<Film[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [mode, setMode] = useState<'history' | 'film'>('history');
  const [specificFilm, setSpecificFilm] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState('');
  const [recs, setRecs] = useState<Rec[]>([]);
  const [userProfile, setUserProfile] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(EMPTY_FEEDBACK);
  const [votes, setVotes] = useState<Record<number, 'liked' | 'disliked'>>({});
  const [inputMode, setInputMode] = useState<'rss' | 'csv' | 'manual'>('rss');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = loadStorage<string[]>('cinebot_platforms', []);
    if (saved.length) setPlatforms(saved);
    setFeedback(normalizeFeedback(loadStorage('cinebot_feedback', EMPTY_FEEDBACK)));
  }, []);

  function vote(i: number, rec: Rec, type: 'liked' | 'disliked') {
    const prev = votes[i];
    const newVotes = { ...votes };
    const newFeedback = normalizeFeedback({ ...feedback });
    if (prev === type) {
      delete newVotes[i];
      newFeedback[type] = newFeedback[type].filter(r => r.title !== rec.title);
    } else {
      if (prev) newFeedback[prev] = newFeedback[prev].filter(r => r.title !== rec.title);
      newVotes[i] = type;
      newFeedback[type] = [...newFeedback[type].filter(r => r.title !== rec.title), rec];
      if (type === 'disliked') {
        const genreCounts: Record<string, number> = {};
        [...newFeedback.disliked].forEach(r => (r.genres || []).forEach(g => { genreCounts[g] = (genreCounts[g] || 0) + 1; }));
        newFeedback.rejectedGenres = [...new Set([...newFeedback.rejectedGenres, ...Object.entries(genreCounts).filter(([, c]) => c >= 2).map(([g]) => g)])];
        const dirCount = newFeedback.disliked.filter(r => r.director === rec.director).length;
        if (dirCount >= 2 && rec.director) newFeedback.rejectedDirectors = [...new Set([...newFeedback.rejectedDirectors, rec.director])];
      }
    }
    setVotes(newVotes);
    setFeedback(newFeedback);
    saveStorage('cinebot_feedback', newFeedback);
  }

  function clearFeedback() {
    setFeedback(EMPTY_FEEDBACK);
    saveStorage('cinebot_feedback', EMPTY_FEEDBACK);
    setVotes({});
  }

  async function loadProfile() {
    if (!username) return;
    setLoading(true); setError(''); setLoadingMsg('Leyendo perfil de Letterboxd...');
    try {
      const res = await fetch(`/api/letterboxd?user=${username}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cargar');
      if (!data.films?.length) throw new Error('No se encontraron películas. ¿El perfil es público?');
      setFilms(data.films.map((t: string) => ({ title: t })));
      setStep(2);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); setLoadingMsg(''); }
  }

  async function loadCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true); setError(''); setLoadingMsg('Procesando CSV...');
    try {
      const text = await file.text();
      const res = await fetch('/api/parse-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar el CSV');
      setFilms(data.films);
      setUsername('csv');
      setStep(2);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); setLoadingMsg(''); }
  }

  function loadManual() {
    const parsed = manualInput.trim().split('\n').filter(l => l.trim()).map(line => {
      const p = line.split(',').map(s => s.trim());
      return { title: p[0] || '', year: p[1] || '', rating: parseFloat(p[2]) || null };
    }).filter(f => f.title);
    if (!parsed.length) { setError('No se pudieron leer las películas'); return; }
    setFilms(parsed); setUsername('manual'); setStep(2);
  }

  async function getRecommendations() {
    if (mode === 'film' && !specificFilm) { setError('Introduce el título de una película'); return; }
    setLoading(true); setError(''); setVotes({}); setLoadingMsg('Claude está analizando tu perfil...');
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ films, platforms, mode, specificFilm, username, feedback }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const newRecs: Rec[] = data.recommendations || [];
      const newFeedback = normalizeFeedback({
        ...feedback,
        previouslyRecommended: [...new Set([...feedback.previouslyRecommended, ...newRecs.map(r => r.title.toLowerCase())])],
      });
      setFeedback(newFeedback);
      saveStorage('cinebot_feedback', newFeedback);
      setRecs(newRecs); setUserProfile(data.userProfile || ''); setStep(4);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); setLoadingMsg(''); }
  }

  const hasFeedback = feedback.liked.length > 0 || feedback.disliked.length > 0 || feedback.previouslyRecommended.length > 0;

  return (
    <main className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-medium text-gray-900 mb-1">CineBot</h1>
            <p className="text-sm text-gray-500">Recomendaciones personalizadas desde tu historial de Letterboxd</p>
          </div>
          {hasFeedback && (
            <div className="text-right">
              <p className="text-xs text-gray-400 mb-1">
                {feedback.liked.length > 0 && `${feedback.liked.length} 👍 · `}
                {feedback.disliked.length > 0 && `${feedback.disliked.length} 👎 · `}
                {feedback.previouslyRecommended.length > 0 && `${feedback.previouslyRecommended.length} ya recomendadas`}
              </p>
              <button onClick={clearFeedback} className="text-xs text-red-400 hover:text-red-600">Borrar memoria</button>
            </div>
          )}
        </div>

        {step === 1 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
            <h2 className="text-base font-medium mb-3">1. Tu historial de películas</h2>
            <div className="flex gap-2 mb-5">
              {(['rss', 'csv', 'manual'] as const).map(m => (
                <button key={m} onClick={() => setInputMode(m)} className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${inputMode === m ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {m === 'rss' ? 'Letterboxd RSS' : m === 'csv' ? 'Exportar CSV' : 'Manual'}
                </button>
              ))}
            </div>

            {inputMode === 'rss' && (
              <div>
                <p className="text-sm text-gray-500 mb-3">Carga las últimas 50 películas de tu perfil público.</p>
                <div className="flex gap-2">
                  <span className="text-sm text-gray-400 self-center whitespace-nowrap">letterboxd.com/</span>
                  <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadProfile()} placeholder="tu_usuario" />
                  <button onClick={loadProfile} disabled={loading} className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50">{loading ? 'Leyendo...' : 'Cargar'}</button>
                </div>
              </div>
            )}

            {inputMode === 'csv' && (
              <div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-700">
                  <p className="font-medium mb-1">Cómo exportar todas tus películas</p>
                  <ol className="list-decimal list-inside text-xs space-y-1">
                    <li>Ve a <a href="https://letterboxd.com/settings/data" target="_blank" className="underline">letterboxd.com/settings/data</a></li>
                    <li>Click en <strong>Export Your Data</strong></li>
                    <li>Abre el ZIP y sube el archivo <strong>watched.csv</strong></li>
                  </ol>
                </div>
                <input ref={fileRef} type="file" accept=".csv" onChange={loadCSV} className="hidden" />
                <button onClick={() => fileRef.current?.click()} disabled={loading} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:bg-gray-50 transition-colors">
                  {loading ? loadingMsg : 'Haz click para subir watched.csv'}
                </button>
              </div>
            )}

            {inputMode === 'manual' && (
              <div>
                <p className="text-xs text-gray-400 mb-2">Una por línea: Título, año, valoración</p>
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs font-mono min-h-[100px] resize-y" value={manualInput} onChange={e => setManualInput(e.target.value)} placeholder={"Parasite, 2019, 5\nMulholland Drive, 2001, 5\nBlade Runner 2049, 2017, 4.5"} />
                <button onClick={loadManual} className="mt-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Usar estas películas</button>
              </div>
            )}

            {loadingMsg && <p className="text-sm text-blue-600 mt-3">{loadingMsg}</p>}
            {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
          </div>
        )}

        {step === 2 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
            <h2 className="text-base font-medium mb-1">2. Tus plataformas</h2>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm text-green-600 font-medium">{films.length} películas cargadas{username !== 'manual' && username !== 'csv' ? ` de @${username}` : username === 'csv' ? ' desde CSV' : ''}</span>
              {feedback.previouslyRecommended.length > 0 && <span className="text-xs text-gray-400">{feedback.previouslyRecommended.length} ya recomendadas excluidas</span>}
            </div>
            <div className="flex flex-wrap gap-2 mb-5">
              {PLATFORMS.map(p => (
                <button key={p.id} onClick={() => { const next = platforms.includes(p.id) ? platforms.filter(x => x !== p.id) : [...platforms, p.id]; setPlatforms(next); saveStorage('cinebot_platforms', next); }} className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${platforms.includes(p.id) ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>{p.label}</button>
              ))}
            </div>
            <button onClick={() => { setStep(3); setError(''); }} disabled={platforms.length === 0} className="px-5 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-40">Continuar</button>
          </div>
        )}

        {step === 3 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
            <h2 className="text-base font-medium mb-3">3. Tipo de recomendación</h2>
            {(films.length > 0 || feedback.previouslyRecommended.length > 0) && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-xs text-green-700">
                Excluyendo {films.length} películas vistas{feedback.previouslyRecommended.length > 0 ? ` + ${feedback.previouslyRecommended.length} ya recomendadas` : ''}{feedback.rejectedGenres.length > 0 ? ` · Evitando: ${feedback.rejectedGenres.join(', ')}` : ''}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {(['history', 'film'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)} className={`p-4 text-left rounded-xl border transition-colors ${mode === m ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}>
                  <p className={`text-sm font-medium ${mode === m ? 'text-blue-700' : 'text-gray-800'}`}>{m === 'history' ? 'Por mi historial' : 'Por una película'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{m === 'history' ? 'Analiza todas mis valoraciones' : 'Similar a un título concreto'}</p>
                </button>
              ))}
            </div>
            {mode === 'film' && <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4" value={specificFilm} onChange={e => setSpecificFilm(e.target.value)} placeholder="Ej: Mulholland Drive, Parasite..." />}
            {loadingMsg && <p className="text-sm text-blue-600 mb-3">{loadingMsg}</p>}
            <button onClick={getRecommendations} disabled={loading} className="w-full py-2.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50">{loading ? 'Analizando...' : 'Obtener recomendaciones'}</button>
            {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
          </div>
        )}

        {step === 4 && (
          <div>
            {userProfile && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
                <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">Tu perfil cinematográfico</p>
                <p className="text-sm text-gray-800 leading-relaxed">{userProfile}</p>
              </div>
            )}
            <p className="text-xs text-gray-400 mb-3">Valora para que el bot aprenda. Todas quedan guardadas como ya recomendadas.</p>
            {recs.map((r, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 mb-3 flex gap-4">
                <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-base font-medium flex-shrink-0">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <a href={letterboxdUrl(r)} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-900 hover:text-blue-600 hover:underline">
                        {r.title}
                      </a>
                      {r.originalTitle && r.originalTitle !== r.title && (
                        <span className="font-normal text-sm text-gray-500"> ({r.originalTitle})</span>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => vote(i, r, 'liked')} className={`w-8 h-8 rounded-lg border text-sm transition-colors ${votes[i] === 'liked' ? 'bg-green-100 border-green-300' : 'border-gray-200 hover:bg-gray-50'}`}>👍</button>
                      <button onClick={() => vote(i, r, 'disliked')} className={`w-8 h-8 rounded-lg border text-sm transition-colors ${votes[i] === 'disliked' ? 'bg-red-100 border-red-300' : 'border-gray-200 hover:bg-gray-50'}`}>👎</button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mb-2">{r.director ? `Dir. ${r.director}` : ''}{r.year ? ` · ${r.year}` : ''}</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {r.platform && <span className="text-xs px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-200">{r.platform}</span>}
                    {(r.genres || []).slice(0, 3).map(g => <span key={g} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{g}</span>)}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed mb-1">{r.reason}</p>
                  {r.connection && <p className="text-xs text-gray-400 italic">Conecta con: {r.connection}</p>}
                </div>
              </div>
            ))}
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setStep(3); setRecs([]); setError(''); }} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Más recomendaciones</button>
              <button onClick={() => { setStep(1); setFilms([]); setRecs([]); setUsername(''); setError(''); }} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Cambiar usuario</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
