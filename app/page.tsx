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
interface Rec { title: string; englishTitle?: string; originalTitle?: string; year: string; director: string; genres: string[]; reason: string; connection: string; platform: string; poster?: string | null; }
interface Feedback { liked: Rec[]; disliked: Rec[]; rejectedGenres: string[]; rejectedDirectors: string[]; previouslyRecommended: string[]; }
const EMPTY_FEEDBACK: Feedback = { liked: [], disliked: [], rejectedGenres: [], rejectedDirectors: [], previouslyRecommended: [] };

function normalizeFeedback(f: any): Feedback {
  return { liked: f?.liked||[], disliked: f?.disliked||[], rejectedGenres: f?.rejectedGenres||[], rejectedDirectors: f?.rejectedDirectors||[], previouslyRecommended: f?.previouslyRecommended||[] };
}
function letterboxdUrl(rec: Rec): string {
  const title = rec.englishTitle || rec.originalTitle || rec.title;
  const slug = title.toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,'+');
  return `https://letterboxd.com/search/${slug}/`;
}
function loadStorage<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function saveStorage(key: string, value: any) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

const s: Record<string, React.CSSProperties> = {
  container: { width:'100%', maxWidth:680, margin:'0 auto', padding:'80px 24px 120px' },
  logo: { fontFamily:"'Cormorant Garamond', serif", fontWeight:300, fontSize:52, letterSpacing:'-0.02em', lineHeight:1, color:'var(--text)', marginBottom:20 },
  tagline: { fontSize:15, color:'var(--text-mid)', lineHeight:1.6, fontWeight:300, maxWidth:360 },
  metaBar: { display:'flex', alignItems:'center', gap:20, marginTop:32, paddingTop:24, borderTop:'1px solid var(--border)' },
  metaText: { fontSize:12, letterSpacing:'0.1em', textTransform:'uppercase' as const, color:'var(--text-dim)', fontWeight:400 },
  metaNum: { fontFamily:"'Cormorant Garamond', serif", fontSize:18, fontWeight:400, color:'var(--accent)', letterSpacing:0, textTransform:'none' as const, marginRight:4 },
  btnDanger: { background:'none', border:'1px solid var(--danger)', color:'var(--danger)', fontFamily:"'Jost', sans-serif", fontSize:10, fontWeight:400, letterSpacing:'0.12em', textTransform:'uppercase' as const, padding:'6px 14px', cursor:'pointer', marginLeft:'auto' },
  sectionLabel: { display:'flex', alignItems:'baseline', gap:14, marginBottom:40 },
  sectionNumber: { fontFamily:"'Cormorant Garamond', serif", fontSize:13, fontWeight:400, color:'var(--text-dim)', letterSpacing:'0.06em' },
  sectionTitle: { fontFamily:"'Cormorant Garamond', serif", fontSize:28, fontWeight:400, letterSpacing:'-0.01em', color:'var(--text)', lineHeight:1.1 },
  divider: { width:'100%', height:1, background:'var(--border)', marginBottom:48, marginTop:16 },
  tabs: { display:'flex', borderBottom:'1px solid var(--border)', marginBottom:48 },
  tab: { background:'none', border:'none', fontFamily:"'Jost', sans-serif", fontSize:11, fontWeight:400, letterSpacing:'0.1em', textTransform:'uppercase' as const, color:'var(--text-dim)', padding:'14px 24px 13px', cursor:'pointer' },
  inputGroup: { display:'flex', alignItems:'baseline', borderBottom:'1px solid var(--border-strong)', paddingBottom:12, marginBottom:40 },
  inputPrefix: { fontSize:15, color:'var(--text-mid)', whiteSpace:'nowrap' as const, fontWeight:300 },
  inputField: { background:'none', border:'none', outline:'none', fontFamily:"'Jost', sans-serif", fontSize:15, fontWeight:300, color:'var(--text)', flex:1, padding:'0 12px' },
  hint: { fontSize:13, color:'var(--text-dim)', marginBottom:48, lineHeight:1.5, fontWeight:300, fontStyle:'italic', fontFamily:"'Cormorant Garamond', serif" },
  btnPrimary: { background:'var(--text)', color:'var(--bg)', border:'none', fontFamily:"'Jost', sans-serif", fontSize:11, fontWeight:400, letterSpacing:'0.12em', textTransform:'uppercase' as const, padding:'16px 40px', cursor:'pointer', display:'inline-block' },
  guideBox: { border:'1px solid var(--border)', borderLeft:'2px solid var(--accent-light)', padding:'28px 32px', marginBottom:40, background:'var(--bg-card)' },
  guideTitle: { fontFamily:"'Cormorant Garamond', serif", fontSize:15, fontWeight:500, color:'var(--text)', marginBottom:18, letterSpacing:'0.02em' },
  dropzone: { border:'1px dashed var(--border-strong)', padding:'44px 32px', textAlign:'center' as const, cursor:'pointer' },
  dropzoneLabel: { fontSize:11, letterSpacing:'0.1em', textTransform:'uppercase' as const, color:'var(--text-dim)' },
  platformGrid: { display:'flex', flexWrap:'wrap' as const, gap:8, marginBottom:48 },
  platBtn: { fontFamily:"'Jost', sans-serif", fontSize:10, fontWeight:400, letterSpacing:'0.1em', textTransform:'uppercase' as const, background:'none', border:'1px solid var(--border)', color:'var(--text-dim)', padding:'7px 14px', cursor:'pointer' },
  platBtnActive: { border:'1px solid var(--text)', color:'var(--text)' },
  modeGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:1, marginBottom:48, background:'var(--border)' },
  modeOpt: { padding:'24px 28px', background:'var(--bg)', cursor:'pointer', border:'none', textAlign:'left' as const, fontFamily:"'Jost', sans-serif" },
  modeOptActive: { background:'var(--bg-card)' },
  modeTitle: { fontFamily:"'Cormorant Garamond', serif", fontSize:18, fontWeight:400, color:'var(--text)', marginBottom:6, lineHeight:1.2 },
  modeTitleActive: { color:'var(--accent)' },
  modeDesc: { fontSize:11, color:'var(--text-dim)', letterSpacing:'0.04em', lineHeight:1.5 },
  infoBox: { borderLeft:'2px solid var(--accent-light)', paddingLeft:20, marginBottom:40 },
  infoText: { fontSize:13, color:'var(--text-mid)', lineHeight:1.6, fontFamily:"'Cormorant Garamond', serif", fontStyle:'italic' },
  recCard: { borderBottom:'1px solid var(--border)', paddingBottom:48, marginBottom:48, display:'flex', gap:28 },
  recPoster: { width:90, flexShrink:0 },
  recPosterImg: { width:90, height:135, objectFit:'cover' as const, display:'block' },
  recPosterPlaceholder: { width:90, height:135, background:'var(--bg-card)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center' },
  recBody: { flex:1, minWidth:0 },
  recNum: { fontFamily:"'Cormorant Garamond', serif", fontSize:13, color:'var(--text-dim)', letterSpacing:'0.06em', marginBottom:6 },
  recTitle: { fontFamily:"'Cormorant Garamond', serif", fontSize:24, fontWeight:400, color:'var(--text)', letterSpacing:'-0.01em', lineHeight:1.15, textDecoration:'none', display:'block', marginBottom:4 },
  recMeta: { fontSize:11, color:'var(--text-dim)', letterSpacing:'0.06em', textTransform:'uppercase' as const, marginBottom:14 },
  recReason: { fontSize:13, color:'var(--text-mid)', lineHeight:1.7, marginBottom:10, fontWeight:300 },
  recConnection: { fontSize:12, color:'var(--text-dim)', fontStyle:'italic', fontFamily:"'Cormorant Garamond', serif" },
  tagRow: { display:'flex', flexWrap:'wrap' as const, gap:6, marginBottom:14 },
  tag: { fontSize:10, letterSpacing:'0.08em', textTransform:'uppercase' as const, color:'var(--text-dim)', border:'1px solid var(--border)', padding:'3px 10px' },
  tagAccent: { color:'var(--accent)', borderColor:'var(--accent-light)' },
  voteRow: { display:'flex', gap:8, marginTop:16 },
  voteBtn: { background:'none', border:'1px solid var(--border)', color:'var(--text-dim)', fontFamily:"'Jost', sans-serif", fontSize:10, letterSpacing:'0.08em', textTransform:'uppercase' as const, padding:'6px 16px', cursor:'pointer' },
  voteBtnLiked: { borderColor:'var(--accent)', color:'var(--accent)' },
  voteBtnDisliked: { borderColor:'var(--danger)', color:'var(--danger)' },
  profileBox: { borderLeft:'2px solid var(--accent-light)', paddingLeft:20, marginBottom:64 },
  profileLabel: { fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase' as const, color:'var(--text-dim)', marginBottom:10 },
  profileText: { fontFamily:"'Cormorant Garamond', serif", fontStyle:'italic', fontSize:17, color:'var(--text-mid)', lineHeight:1.7 },
  actionRow: { display:'flex', gap:12, marginTop:64 },
  btnGhost: { background:'none', border:'1px solid var(--border)', color:'var(--text-mid)', fontFamily:"'Jost', sans-serif", fontSize:10, fontWeight:400, letterSpacing:'0.12em', textTransform:'uppercase' as const, padding:'12px 28px', cursor:'pointer', flex:1 },
  errorText: { fontSize:13, color:'var(--danger)', marginTop:12, fontFamily:"'Cormorant Garamond', serif", fontStyle:'italic' },
  loadingText: { fontSize:13, color:'var(--text-dim)', marginTop:12, fontFamily:"'Cormorant Garamond', serif", fontStyle:'italic' },
};

async function fetchPoster(title: string, year: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/tmdb?title=${encodeURIComponent(title)}&year=${year}`);
    const data = await res.json();
    return data.poster || null;
  } catch { return null; }
}

export default function Home() {
  const [step, setStep] = useState(1);
  const [inputTab, setInputTab] = useState<'rss'|'csv'|'manual'>('rss');
  const [username, setUsername] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [films, setFilms] = useState<Film[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [mode, setMode] = useState<'history'|'film'>('history');
  const [specificFilm, setSpecificFilm] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError] = useState('');
  const [recs, setRecs] = useState<Rec[]>([]);
  const [userProfile, setUserProfile] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(EMPTY_FEEDBACK);
  const [votes, setVotes] = useState<Record<number,'liked'|'disliked'>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = loadStorage<string[]>('cinebot_platforms', []);
    if (saved.length) setPlatforms(saved);
    setFeedback(normalizeFeedback(loadStorage('cinebot_feedback', EMPTY_FEEDBACK)));
  }, []);

  function vote(i: number, rec: Rec, type: 'liked'|'disliked') {
    const prev = votes[i];
    const nv = { ...votes };
    const nf = normalizeFeedback({ ...feedback });
    if (prev === type) { delete nv[i]; nf[type] = nf[type].filter(r => r.title !== rec.title); }
    else {
      if (prev) nf[prev] = nf[prev].filter(r => r.title !== rec.title);
      nv[i] = type; nf[type] = [...nf[type].filter(r => r.title !== rec.title), rec];
      if (type === 'disliked') {
        const gc: Record<string,number> = {};
        [...nf.disliked].forEach(r => (r.genres||[]).forEach(g => { gc[g]=(gc[g]||0)+1; }));
        nf.rejectedGenres = [...new Set([...nf.rejectedGenres, ...Object.entries(gc).filter(([,c])=>c>=2).map(([g])=>g)])];
        const dc = nf.disliked.filter(r=>r.director===rec.director).length;
        if (dc>=2&&rec.director) nf.rejectedDirectors=[...new Set([...nf.rejectedDirectors,rec.director])];
      }
    }
    setVotes(nv); setFeedback(nf); saveStorage('cinebot_feedback', nf);
  }

  function clearFeedback() { setFeedback(EMPTY_FEEDBACK); saveStorage('cinebot_feedback', EMPTY_FEEDBACK); setVotes({}); }

  async function loadProfile() {
    if (!username) return;
    setLoading(true); setError(''); setLoadingMsg('Leyendo tu perfil...');
    try {
      const res = await fetch(`/api/letterboxd?user=${username}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error||'Error al cargar');
      if (!data.films?.length) throw new Error('No se encontraron películas. ¿El perfil es público?');
      setFilms(data.films.map((t:string)=>({title:t}))); setStep(2);
    } catch(e:any) { setError(e.message); }
    finally { setLoading(false); setLoadingMsg(''); }
  }

  async function loadCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setLoading(true); setError(''); setLoadingMsg('Procesando CSV...');
    try {
      const text = await file.text();
      const res = await fetch('/api/parse-csv', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({csv:text}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error||'Error al procesar');
      setFilms(data.films); setUsername('csv'); setStep(2);
    } catch(e:any) { setError(e.message); }
    finally { setLoading(false); setLoadingMsg(''); }
  }

  function loadManual() {
    const parsed = manualInput.trim().split('\n').filter(l=>l.trim()).map(line=>{ const p=line.split(',').map(s=>s.trim()); return {title:p[0]||'',year:p[1]||'',rating:parseFloat(p[2])||null}; }).filter(f=>f.title);
    if (!parsed.length) { setError('No se pudieron leer las películas'); return; }
    setFilms(parsed); setUsername('manual'); setStep(2);
  }

  async function getRecommendations() {
    if (mode==='film'&&!specificFilm) { setError('Introduce el título de una película'); return; }
    setLoading(true); setError(''); setVotes({}); setLoadingMsg('Claude está analizando tu perfil cinematográfico...');
    try {
      const res = await fetch('/api/recommend', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({films,platforms,mode,specificFilm,username,feedback}) });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const newRecs: Rec[] = data.recommendations || [];

      setLoadingMsg('Buscando pósters...');
      const recsWithPosters = await Promise.all(
        newRecs.map(async (r) => {
          const poster = await fetchPoster(r.englishTitle || r.title, r.year);
          return { ...r, poster };
        })
      );

      const nf = normalizeFeedback({...feedback, previouslyRecommended:[...new Set([...feedback.previouslyRecommended,...recsWithPosters.map(r=>r.title.toLowerCase())])]});
      setFeedback(nf); saveStorage('cinebot_feedback',nf);
      setRecs(recsWithPosters); setUserProfile(data.userProfile||''); setStep(4);
    } catch(e:any) { setError(e.message); }
    finally { setLoading(false); setLoadingMsg(''); }
  }

  const hasFeedback = feedback.liked.length>0||feedback.disliked.length>0||feedback.previouslyRecommended.length>0;

  return (
    <div style={s.container}>
      <div style={{marginBottom:64}}>
        <h1 style={s.logo}>CineBot</h1>
        <p style={s.tagline}>Recomendaciones personalizadas desde tu historial de Letterboxd</p>
        {hasFeedback && (
          <div style={s.metaBar}>
            <p style={s.metaText}><span style={s.metaNum}>{feedback.previouslyRecommended.length}</span> películas recomendadas</p>
            {feedback.liked.length>0 && <p style={s.metaText}><span style={s.metaNum}>{feedback.liked.length}</span> guardadas</p>}
            <button style={s.btnDanger} onClick={clearFeedback}>Borrar memoria</button>
          </div>
        )}
      </div>

      {step===1 && (
        <div>
          <div style={s.sectionLabel}>
            <span style={s.sectionNumber}>01</span>
            <h2 style={s.sectionTitle}>Carga tu historial de películas</h2>
          </div>
          <div style={s.divider}/>
          <div style={s.tabs}>
            {(['rss','csv','manual'] as const).map(t => (
              <button key={t} onClick={()=>setInputTab(t)} style={{...s.tab, color:inputTab===t?'var(--text)':'var(--text-dim)', borderBottom:inputTab===t?'1px solid var(--text)':'none', marginBottom:inputTab===t?-1:0}}>
                {t==='rss'?'Letterboxd':t==='csv'?'Importar CSV':'Manual'}
              </button>
            ))}
          </div>
          {inputTab==='rss' && (
            <div>
              <p style={s.hint}>Carga las últimas 50 películas de tu perfil público.</p>
              <div style={s.inputGroup}>
                <span style={s.inputPrefix}>letterboxd.com /</span>
                <input style={s.inputField} type="text" placeholder="tu_usuario" value={username} onChange={e=>setUsername(e.target.value)} onKeyDown={e=>e.key==='Enter'&&loadProfile()} />
              </div>
              <button style={s.btnPrimary} onClick={loadProfile} disabled={loading}>{loading?'Cargando...':'Cargar'}</button>
            </div>
          )}
          {inputTab==='csv' && (
            <div>
              <div style={s.guideBox}>
                <p style={s.guideTitle}>Cómo exportar tu historial completo</p>
                <ol style={{listStyle:'none',display:'flex',flexDirection:'column',gap:12}}>
                  {[['1','Ve a letterboxd.com/settings/data'],['2','Haz clic en Export Your Data'],['3','Abre el ZIP y sube el archivo watched.csv']].map(([n,t])=>(
                    <li key={n} style={{fontSize:13,color:'var(--text-mid)',display:'flex',gap:16,lineHeight:1.5}}>
                      <span style={{fontFamily:"'Cormorant Garamond', serif",fontSize:13,color:'var(--text-dim)',minWidth:16}}>{n}</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <input ref={fileRef} type="file" accept=".csv" onChange={loadCSV} style={{display:'none'}} />
              <div style={s.dropzone} onClick={()=>fileRef.current?.click()}>
                <p style={s.dropzoneLabel}>{loading?loadingMsg:'Haz clic para subir watched.csv'}</p>
              </div>
            </div>
          )}
          {inputTab==='manual' && (
            <div>
              <p style={{...s.hint,fontFamily:"'Cormorant Garamond', serif",fontSize:17,marginBottom:32}}>Escribe el título de cada película, una por línea.</p>
              <textarea style={{...s.inputField,width:'100%',minHeight:140,resize:'vertical',lineHeight:1.8,padding:'16px 0',borderBottom:'1px solid var(--border-strong)',fontFamily:"'Jost', sans-serif"}} placeholder={"Mulholland Drive\nIn the Mood for Love\nStalker"} value={manualInput} onChange={e=>setManualInput(e.target.value)} />
              <div style={{marginTop:40}}><button style={s.btnPrimary} onClick={loadManual}>Analizar</button></div>
            </div>
          )}
          {loadingMsg && <p style={s.loadingText}>{loadingMsg}</p>}
          {error && <p style={s.errorText}>{error}</p>}
        </div>
      )}

      {step===2 && (
        <div>
          <div style={s.sectionLabel}>
            <span style={s.sectionNumber}>02</span>
            <h2 style={s.sectionTitle}>Tus plataformas de streaming</h2>
          </div>
          <div style={s.divider}/>
          <div style={s.infoBox}>
            <p style={s.infoText}>{films.length} películas cargadas{username!=='manual'&&username!=='csv'?` de @${username}`:username==='csv'?' desde tu exportación CSV':''}. Solo te recomendaremos lo que puedas ver hoy.</p>
          </div>
          <div style={s.platformGrid}>
            {PLATFORMS.map(p=>(
              <button key={p.id} style={{...s.platBtn,...(platforms.includes(p.id)?s.platBtnActive:{})}} onClick={()=>{ const next=platforms.includes(p.id)?platforms.filter(x=>x!==p.id):[...platforms,p.id]; setPlatforms(next); saveStorage('cinebot_platforms',next); }}>{p.label}</button>
            ))}
          </div>
          <div style={{display:'flex',gap:12}}>
            <button style={s.btnGhost} onClick={()=>setStep(1)}>Volver</button>
            <button style={{...s.btnPrimary,opacity:platforms.length===0?0.4:1}} onClick={()=>{setStep(3);setError('');}} disabled={platforms.length===0}>Continuar</button>
          </div>
        </div>
      )}

      {step===3 && (
        <div>
          <div style={s.sectionLabel}>
            <span style={s.sectionNumber}>03</span>
            <h2 style={s.sectionTitle}>¿Cómo quieres descubrir?</h2>
          </div>
          <div style={s.divider}/>
          {(feedback.previouslyRecommended.length>0||feedback.rejectedGenres.length>0) && (
            <div style={{...s.infoBox,marginBottom:40}}>
              <p style={s.infoText}>Memoria activa — excluyendo {films.length} vistas + {feedback.previouslyRecommended.length} ya recomendadas{feedback.rejectedGenres.length>0?`. Evitando: ${feedback.rejectedGenres.join(', ')}`:''}.
              </p>
            </div>
          )}
          <div style={s.modeGrid}>
            {(['history','film'] as const).map(m=>(
              <button key={m} style={{...s.modeOpt,...(mode===m?s.modeOptActive:{})}} onClick={()=>setMode(m)}>
                <p style={{...s.modeTitle,...(mode===m?s.modeTitleActive:{})}}>{m==='history'?'Por mi historial':'Por una película'}</p>
                <p style={s.modeDesc}>{m==='history'?'Analiza todas mis valoraciones y patrones':'Similar a un título que me encantó'}</p>
              </button>
            ))}
          </div>
          {mode==='film' && (
            <div style={{...s.inputGroup,marginBottom:48}}>
              <input style={s.inputField} type="text" placeholder="Ej: Mulholland Drive, Parasite..." value={specificFilm} onChange={e=>setSpecificFilm(e.target.value)} onKeyDown={e=>e.key==='Enter'&&getRecommendations()} />
            </div>
          )}
          {loadingMsg && <p style={{...s.loadingText,marginBottom:24}}>{loadingMsg}</p>}
          <div style={{display:'flex',gap:12}}>
            <button style={s.btnGhost} onClick={()=>setStep(2)}>Volver</button>
            <button style={s.btnPrimary} onClick={getRecommendations} disabled={loading}>{loading?'Analizando...':'Obtener recomendaciones'}</button>
          </div>
          {error && <p style={s.errorText}>{error}</p>}
        </div>
      )}

      {step===4 && (
        <div>
          <div style={s.sectionLabel}>
            <span style={s.sectionNumber}>—</span>
            <h2 style={s.sectionTitle}>Para ti esta semana</h2>
          </div>
          <div style={s.divider}/>
          {userProfile && (
            <div style={s.profileBox}>
              <p style={s.profileLabel}>Tu perfil cinematográfico</p>
              <p style={s.profileText}>{userProfile}</p>
            </div>
          )}
          {recs.map((r,i)=>(
            <div key={i} style={s.recCard}>
              <div style={s.recPoster}>
                {r.poster
                  ? <img src={r.poster} alt={r.title} style={s.recPosterImg} />
                  : <div style={s.recPosterPlaceholder}><span style={{fontSize:10,color:'var(--text-dim)',letterSpacing:'0.06em'}}>—</span></div>
                }
              </div>
              <div style={s.recBody}>
                <p style={s.recNum}>0{i+1}</p>
                <a href={letterboxdUrl(r)} target="_blank" rel="noopener noreferrer" style={s.recTitle}>
                  {r.title}{r.originalTitle&&r.originalTitle!==r.title&&<span style={{fontSize:18,color:'var(--text-dim)',fontWeight:300}}> — {r.originalTitle}</span>}
                </a>
                <p style={s.recMeta}>{r.director?`${r.director}`:''}{r.year?` · ${r.year}`:''}</p>
                <div style={s.tagRow}>
                  {r.platform&&<span style={{...s.tag,...s.tagAccent}}>{r.platform}</span>}
                  {(r.genres||[]).slice(0,3).map(g=><span key={g} style={s.tag}>{g}</span>)}
                </div>
                <p style={s.recReason}>{r.reason}</p>
                {r.connection&&<p style={s.recConnection}>Conecta con {r.connection}</p>}
                <div style={s.voteRow}>
                  <button onClick={()=>vote(i,r,'liked')} style={{...s.voteBtn,...(votes[i]==='liked'?s.voteBtnLiked:{})}}>Me interesa</button>
                  <button onClick={()=>vote(i,r,'disliked')} style={{...s.voteBtn,...(votes[i]==='disliked'?s.voteBtnDisliked:{})}}>No es para mí</button>
                </div>
              </div>
            </div>
          ))}
          <div style={s.actionRow}>
            <button style={s.btnGhost} onClick={()=>{setStep(3);setRecs([]);setError('');}}>Más recomendaciones</button>
            <button style={s.btnGhost} onClick={()=>{setStep(1);setFilms([]);setRecs([]);setUsername('');setError('');}}>Cambiar historial</button>
          </div>
        </div>
      )}
    </div>
  );
}
