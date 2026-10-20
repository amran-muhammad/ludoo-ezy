import React, {useCallback, useEffect, useRef, useState} from 'react';
import type {Color, GameState} from '../lib/ludo';
import {COLOR_OFFSET, COLORS, HOME_BASE, HOME_COLS, MAIN_PATH, SAFE_ABS, movableTokens} from '../lib/ludo';

// ── Palette ───────────────────────────────────────────────────────────────────

const C = {
  red:    {zone:'#b71c1c', mid:'#e53935', light:'#ffcdd2', bright:'#ff6659', path:'#ffcdd2'},
  green:  {zone:'#1b5e20', mid:'#43a047', light:'#c8e6c9', bright:'#76d275', path:'#c8e6c9'},
  yellow: {zone:'#bf360c', mid:'#f57c00', light:'#ffe0b2', bright:'#ffca28', path:'#fff9c4'},
  blue:   {zone:'#0d47a1', mid:'#1e88e5', light:'#bbdefb', bright:'#64b5f6', path:'#bbdefb'},
} as const;

const CELL = 40; // 15 × 40 = 600 viewBox units

function cx(col: number) { return col * CELL + CELL / 2; }
function cy(row: number) { return row * CELL + CELL / 2; }
function absIdx(color: Color, rel: number) { return (rel + COLOR_OFFSET[color]) % 52; }

// ── SVG Defs (gradients, filters) ────────────────────────────────────────────

function Defs() {
  return (
    <defs>
      {/* Token radial gradient per color */}
      {(COLORS as Color[]).map(c => (
        <radialGradient key={c} id={`tg-${c}`} cx="38%" cy="32%" r="70%">
          <stop offset="0%"   stopColor={C[c].bright} />
          <stop offset="55%"  stopColor={C[c].mid} />
          <stop offset="100%" stopColor={C[c].zone} />
        </radialGradient>
      ))}
      {/* Quadrant gradient per color */}
      {(COLORS as Color[]).map(c => (
        <linearGradient key={c} id={`qg-${c}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor={C[c].mid}  stopOpacity={0.8} />
          <stop offset="100%" stopColor={C[c].zone} stopOpacity={1} />
        </linearGradient>
      ))}
      {/* Dice gradient */}
      <linearGradient id="dice-bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stopColor="#ffffff" />
        <stop offset="100%" stopColor="#e8e8e8" />
      </linearGradient>
      {/* Token drop shadow */}
      <filter id="tshadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000" floodOpacity="0.45" />
      </filter>
      {/* Board inner shadow */}
      <filter id="bshadow">
        <feDropShadow dx="0" dy="3" stdDeviation="6" floodColor="#000" floodOpacity="0.5" />
      </filter>
      {/* Movable token glow */}
      <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
  );
}

// ── Static board ──────────────────────────────────────────────────────────────

const QUADRANTS: Array<{color: Color; r: number; c: number}> = [
  {color: 'green',  r:0,  c:0},
  {color: 'yellow', r:0,  c:9},
  {color: 'blue',   r:9,  c:0},
  {color: 'red',    r:9,  c:9},
];

function BoardBg() {
  return (
    <>
      <rect width={600} height={600} fill="#f8f3e8" />

      {/* Colored quadrants */}
      {QUADRANTS.map(({color, r, c}) => (
        <g key={color}>
          {/* Outer filled zone */}
          <rect x={c*CELL} y={r*CELL} width={6*CELL} height={6*CELL}
            fill={`url(#qg-${color})`} />
          {/* Inner white yard card */}
          <rect x={c*CELL+CELL*0.8} y={r*CELL+CELL*0.8}
            width={4.4*CELL} height={4.4*CELL} rx={10}
            fill="white" fillOpacity={0.18} />
          {/* Home slot circles */}
          {HOME_BASE[color].map(([row, col], i) => (
            <g key={i}>
              <circle cx={cx(col)} cy={cy(row)} r={16}
                fill={C[color].zone} stroke="white" strokeOpacity={0.4} strokeWidth={1.5} />
              <circle cx={cx(col)} cy={cy(row)} r={11}
                fill="white" fillOpacity={0.15} />
            </g>
          ))}
        </g>
      ))}

      {/* Main path squares */}
      {MAIN_PATH.map(([row, col], i) => {
        const safe = SAFE_ABS.has(i);
        const entry = Object.entries(COLOR_OFFSET).find(([,off]) => off === i)?.[0] as Color | undefined;
        const fill = entry ? C[entry].path : '#ffffff';
        return (
          <g key={i}>
            <rect x={col*CELL} y={row*CELL} width={CELL} height={CELL}
              fill={fill} stroke="#d4c9b0" strokeWidth={0.7} />
            {safe && !entry && (
              // Star shape on safe squares
              <g transform={`translate(${cx(col)},${cy(row)})`}>
                {Array.from({length: 6}).map((_, k) => {
                  const a = (k * 60 - 90) * Math.PI / 180;
                  const b = (k * 60 - 60) * Math.PI / 180;
                  const r1 = 7, r2 = 4;
                  const x1 = Math.cos(a)*r1, y1 = Math.sin(a)*r1;
                  const x2 = Math.cos(b-(30*Math.PI/180))*r2, y2 = Math.sin(b-(30*Math.PI/180))*r2;
                  return k === 0
                    ? <path key={k} d={`M${x1},${y1}`} fill="#b0bec5" />
                    : null;
                })}
                <polygon
                  points={Array.from({length: 12}).map((_, k) => {
                    const angle = (k * 30 - 90) * Math.PI / 180;
                    const r = k % 2 === 0 ? 7 : 4;
                    return `${Math.cos(angle)*r},${Math.sin(angle)*r}`;
                  }).join(' ')}
                  fill="#90a4ae" opacity={0.7}
                />
              </g>
            )}
          </g>
        );
      })}

      {/* Home columns */}
      {(COLORS as Color[]).map(color =>
        HOME_COLS[color].map(([row, col], i) => (
          <rect key={`${color}${i}`}
            x={col*CELL} y={row*CELL} width={CELL} height={CELL}
            fill={C[color].path} stroke="#d4c9b0" strokeWidth={0.7} />
        ))
      )}

      {/* Center finish area – 4 triangles */}
      {([
        ['green',  6, 6, 9, 6, 7.5, 7.5],
        ['yellow', 9, 6, 9, 9, 7.5, 7.5],
        ['blue',   6, 9, 9, 9, 7.5, 7.5],
        ['red',    6, 6, 6, 9, 7.5, 7.5],
      ] as [Color, number, number, number, number, number, number][]).map(([color, r1,c1, r2,c2, rm,cm]) => (
        <polygon key={color}
          points={`${c1*CELL},${r1*CELL} ${c2*CELL},${r2*CELL} ${cm*CELL},${rm*CELL}`}
          fill={C[color].mid} opacity={0.9} />
      ))}
      <circle cx={cx(7)} cy={cy(7)} r={CELL*0.72} fill="white" />

      {/* Subtle grid lines */}
      {Array.from({length: 16}).map((_, i) => (
        <React.Fragment key={i}>
          <line x1={i*CELL} y1={0} x2={i*CELL} y2={600} stroke="#c8bda0" strokeWidth={0.5} />
          <line x1={0} y1={i*CELL} x2={600} y2={i*CELL} stroke="#c8bda0" strokeWidth={0.5} />
        </React.Fragment>
      ))}

      {/* Outer board border */}
      <rect width={600} height={600} fill="none" stroke="#795548" strokeWidth={3} />
    </>
  );
}

// ── Dice ──────────────────────────────────────────────────────────────────────

const PIPS: Record<number, [number,number][]> = {
  1: [[.5,.5]],
  2: [[.28,.28],[.72,.72]],
  3: [[.28,.28],[.5,.5],[.72,.72]],
  4: [[.28,.28],[.72,.28],[.28,.72],[.72,.72]],
  5: [[.28,.28],[.72,.28],[.5,.5],[.28,.72],[.72,.72]],
  6: [[.28,.22],[.72,.22],[.28,.5],[.72,.5],[.28,.78],[.72,.78]],
};

function DiceFace({value, size=72}: {value: number|null; size?: number}) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72"
      style={{display:'block', filter:'drop-shadow(0 4px 10px rgba(0,0,0,0.5))'}}>
      <defs>
        <linearGradient id="dg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#ffffff" />
          <stop offset="100%" stopColor="#d8d0c0" />
        </linearGradient>
      </defs>
      <rect width={72} height={72} rx={14} fill="url(#dg)" stroke="#bbb" strokeWidth={1.5} />
      {/* Inner inset line */}
      <rect x={4} y={4} width={64} height={64} rx={11} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={1} />
      {value !== null
        ? (PIPS[value] ?? []).map(([px,py], i) => (
            <circle key={i} cx={px*72} cy={py*72} r={5.5}
              fill="#1a1a1a" style={{filter:'drop-shadow(0 1px 1px rgba(0,0,0,0.3))'}} />
          ))
        : <text x={36} y={44} textAnchor="middle" fontSize={26} fill="#ccc" fontFamily="sans-serif">?</text>
      }
    </svg>
  );
}

// ── Token ─────────────────────────────────────────────────────────────────────

function Token({x,y,color,movable,onMove,label}: {
  x:number; y:number; color:Color; movable:boolean; onMove:()=>void; label:string;
}) {
  return (
    <g onClick={movable ? onMove : undefined}
       style={{cursor: movable ? 'pointer' : 'default'}}
       role={movable ? 'button' : undefined} aria-label={label}
       filter="url(#tshadow)">
      {movable && (
        <circle cx={x} cy={y} r={20} fill={C[color].bright} opacity={0.35}
          filter="url(#glow)"
          style={{animation:'lpulse 1.1s ease-in-out infinite'}} />
      )}
      {/* Outer body */}
      <circle cx={x} cy={y} r={14} fill={`url(#tg-${color})`}
        stroke={movable ? '#FFD700' : 'rgba(255,255,255,0.7)'}
        strokeWidth={movable ? 2.5 : 1.5} />
      {/* Specular highlight */}
      <ellipse cx={x-4} cy={y-5} rx={5} ry={3.5} fill="white" opacity={0.45} />
    </g>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STACK_OFF: [number,number][] = [[0,0],[-7,-7],[7,-7],[0,8]];

function pid(): string {
  try {
    let id = localStorage.getItem('ludo_player_id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('ludo_player_id', id); }
    return id;
  } catch { return crypto.randomUUID(); }
}

async function post<T>(url: string, body: object): Promise<T> {
  const r = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
  return r.json() as Promise<T>;
}
async function get<T>(url: string): Promise<T> {
  return (await fetch(url)).json() as Promise<T>;
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  room: {code: string; status: string; state: GameState};
}

export default function LudoGame({room: init}: Props) {
  const playerId = pid();
  const [state, setState] = useState<GameState>(init.state);
  const [roomStatus, setRoomStatus] = useState(init.status);
  const [busy, setBusy] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [joinName, setJoinName] = useState('');
  const [joinErr, setJoinErr] = useState('');
  const [joining, setJoining] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const code = init.code;

  const myPlayer  = state.players.find(p => p.playerId === playerId) ?? null;
  const myColor   = myPlayer?.color ?? null;
  const isMyTurn  = myPlayer !== null && state.players[state.turn]?.color === myColor;
  const curPlayer = state.players[state.turn];
  const movable   = isMyTurn && state.diceRolled && state.dice !== null
    ? movableTokens(myPlayer!, state.dice) : [];

  const isWaiting  = state.status === 'waiting';
  const isPlaying  = state.status === 'playing';
  const isFinished = state.status === 'finished';

  // Roll button state: disabled unless it's your turn, game is playing, dice not yet rolled
  const canRoll = isPlaying && isMyTurn && !state.diceRolled && !busy;

  const fetch_ = useCallback(async () => {
    const d = await get<{room:{state:GameState;status:string}}>(`/site-api/ludo/rooms/${code}`);
    if (d?.room) { setState(d.room.state); setRoomStatus(d.room.status); }
  }, [code]);

  useEffect(() => {
    const poll = isWaiting || (isPlaying && !isMyTurn);
    if (poll) pollRef.current = setInterval(fetch_, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isMyTurn, isWaiting, isPlaying, fetch_]);

  async function doStart() {
    setBusy(true); setError('');
    const d = await post<{ok?:boolean;message?:string}>(`/site-api/ludo/rooms/${code}/start`, {playerId});
    if (d.ok) await fetch_(); else setError(d.message ?? 'Error starting.');
    setBusy(false);
  }

  async function doRoll() {
    if (!canRoll) return;
    setBusy(true); setRolling(true); setError('');
    const d = await post<{state?:GameState;message?:string}>(`/site-api/ludo/rooms/${code}/roll`, {playerId});
    setRolling(false);
    if (d.state) setState(d.state); else setError(d.message ?? 'Error rolling.');
    setBusy(false);
  }

  async function doJoin() {
    const name = joinName.trim();
    if (!name) { setJoinErr('Enter your name.'); return; }
    setJoining(true); setJoinErr('');
    const d = await post<{code?:string;color?:string;error?:string;message?:string}>(
      `/site-api/ludo/rooms/${code}/join`, {name, playerId}
    );
    if (d.code) {
      try { localStorage.setItem('ludo_player_id', playerId); } catch {}
      await fetch_();
    } else {
      setJoinErr(
        d.error === 'full' ? 'Room is full (4/4 players).' :
        d.error === 'already_started' ? 'Game already started — you can only watch.' :
        d.message ?? 'Could not join. Please try again.'
      );
    }
    setJoining(false);
  }

  async function doMove(tokenId: number) {
    if (!isMyTurn || !state.diceRolled || busy) return;
    setBusy(true); setError('');
    const d = await post<{state?:GameState;message?:string}>(`/site-api/ludo/rooms/${code}/move`, {playerId, tokenId});
    if (d.state) setState(d.state); else setError(d.message ?? 'Error moving.');
    setBusy(false);
  }

  // Build token SVG elements
  const tokenEls: React.ReactElement[] = [];
  const posCount = new Map<string,number>();
  for (const player of state.players) {
    let homeIdx = 0;
    for (const token of player.tokens) {
      if (token.pos === 58) continue;
      let svgX: number, svgY: number;
      if (token.pos === -1) {
        const s = HOME_BASE[player.color][homeIdx++];
        if (!s) continue;
        svgX = cx(s[1]); svgY = cy(s[0]);
      } else if (token.pos >= 52 && token.pos <= 57) {
        const h = HOME_COLS[player.color][token.pos - 52];
        if (!h) continue;
        svgX = cx(h[1]); svgY = cy(h[0]);
      } else {
        const m = MAIN_PATH[absIdx(player.color, token.pos)];
        if (!m) continue;
        svgX = cx(m[1]); svgY = cy(m[0]);
      }
      const k = `${Math.round(svgX)},${Math.round(svgY)}`;
      const si = posCount.get(k) ?? 0; posCount.set(k, si+1);
      const [ox,oy] = STACK_OFF[si % 4];
      const isMovable = movable.includes(token.id) && player.color === myColor;
      tokenEls.push(
        <Token key={`${player.color}-${token.id}`}
          x={svgX+ox} y={svgY+oy} color={player.color}
          movable={isMovable} onMove={() => doMove(token.id)}
          label={`${player.color} token ${token.id+1}${isMovable ? ', click to move' : ''}`}
        />
      );
    }
  }

  const ranked = [...state.players].sort((a,b) => (a.rank??99)-(b.rank??99));

  return (
    <>
      <style>{`
        .lg-root { min-height:100vh; background:linear-gradient(135deg,#0d1b2a 0%,#1b2838 50%,#1a3a5c 100%); color:#fff; font-family:system-ui,sans-serif; }
        .lg-header { display:flex; align-items:center; gap:12px; padding:10px 20px; border-bottom:1px solid rgba(255,255,255,0.1); backdrop-filter:blur(6px); }
        .lg-body { display:flex; flex-direction:column; align-items:center; gap:20px; padding:20px 12px 40px; }
        .lg-layout { display:flex; flex-direction:column; align-items:center; gap:20px; width:100%; }
        .lg-board-wrap { border-radius:16px; overflow:hidden; box-shadow:0 24px 64px rgba(0,0,0,0.7), 0 0 0 8px #5d4037, 0 0 0 11px #3e2723, 0 0 40px rgba(0,0,0,0.4); flex-shrink:0; }
        .lg-board-svg { display:block; width:100%; max-width:min(92vw, 420px); }
        .lg-panel { display:flex; flex-direction:column; gap:10px; width:100%; max-width:420px; }
        .lg-card { background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:14px; padding:14px 16px; }
        .lg-label { font-size:10px; font-weight:700; letter-spacing:2.5px; text-transform:uppercase; color:rgba(255,255,255,0.45); margin-bottom:10px; }
        .lg-btn { width:100%; border:none; border-radius:10px; padding:13px 20px; color:#fff; font-size:15px; font-weight:700; cursor:pointer; transition:all .2s; letter-spacing:.5px; }
        .lg-btn:disabled { opacity:.45; cursor:not-allowed; }
        .lg-btn-roll { background:linear-gradient(135deg,#e53935,#b71c1c); box-shadow:0 4px 20px rgba(229,57,53,0.4); }
        .lg-btn-roll:not(:disabled):hover { transform:translateY(-1px); box-shadow:0 6px 24px rgba(229,57,53,0.55); }
        .lg-btn-start { background:linear-gradient(135deg,#43a047,#1b5e20); box-shadow:0 4px 15px rgba(67,160,71,0.4); }
        .lg-btn-start:not(:disabled):hover { transform:translateY(-1px); }
        .lg-pl-row { display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:10px; margin-bottom:4px; border:1px solid transparent; transition:all .3s; }
        .lg-dot { width:18px; height:18px; border-radius:50%; border:2px solid white; flex-shrink:0; }
        .lg-progress { display:flex; gap:4px; margin-top:4px; }
        .lg-prog-pip { width:8px; height:8px; border-radius:50%; }
        .lg-dice-area { display:flex; flex-direction:column; align-items:center; gap:12px; }
        .lg-status-txt { font-size:12px; color:rgba(255,255,255,0.55); text-align:center; }
        .lg-turn-badge { font-size:12px; font-weight:700; letter-spacing:1px; text-transform:uppercase; padding:4px 12px; border-radius:20px; }
        @keyframes lpulse { 0%,100%{opacity:.25} 50%{opacity:.7} }
        @keyframes lspin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        /* ── Desktop ── */
        @media (min-width:900px) {
          .lg-layout { flex-direction:row; align-items:flex-start; justify-content:center; gap:28px; }
          .lg-board-svg { max-width:min(58vh, 640px); }
          .lg-panel { width:290px; max-width:290px; }
        }
        @media (min-width:1280px) {
          .lg-board-svg { max-width:min(70vh, 720px); }
          .lg-panel { width:310px; max-width:310px; }
          .lg-card { padding:18px 20px; }
        }
      `}</style>

      <div className="lg-root">
        {/* Header */}
        <div className="lg-header">
          <a href="/" style={{color:'rgba(255,255,255,0.55)', fontSize:13, textDecoration:'none', fontWeight:600}}>← Home</a>
          <span style={{fontWeight:900, fontSize:17, letterSpacing:4, color:'#FFD700', marginLeft:4}}>LUDO</span>

          {/* Turn status */}
          {isPlaying && (
            <span className="lg-turn-badge" style={{
              marginLeft:8,
              background: isMyTurn ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.08)',
              color: isMyTurn ? '#FFD700' : 'rgba(255,255,255,0.6)',
              border: `1px solid ${isMyTurn ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.15)'}`,
            }}>
              {isMyTurn ? '🎯 Your turn' : `${curPlayer?.name ?? '…'}'s turn`}
            </span>
          )}

          <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:10}}>
            <span style={{fontFamily:'monospace', fontSize:20, fontWeight:800, letterSpacing:5}}>{code}</span>
            <button onClick={() => {
              navigator.clipboard.writeText(window.location.href).then(() => {
                setCopied(true); setTimeout(() => setCopied(false), 2000);
              });
            }} style={{
              background: copied ? '#388e3c' : 'rgba(255,255,255,0.1)',
              border:'1px solid rgba(255,255,255,0.2)', borderRadius:8,
              padding:'5px 14px', color:'#fff', fontSize:12, cursor:'pointer',
              fontWeight:600, transition:'background .2s',
            }}>
              {copied ? '✓ Copied' : '🔗 Share'}
            </button>
          </div>
        </div>

        <div className="lg-body">
          <div className="lg-layout">

            {/* ── Board ── */}
            <div className="lg-board-wrap">
              <svg className="lg-board-svg" viewBox="0 0 600 600">
                <Defs />
                <BoardBg />
                {tokenEls}
              </svg>
            </div>

            {/* ── Side panel ── */}
            <div className="lg-panel">

              {/* Players card */}
              <div className="lg-card">
                <div className="lg-label">Players</div>
                {state.players.map((p, i) => {
                  const isTurn = isPlaying && state.turn === i && !isFinished;
                  return (
                    <div key={p.color} className="lg-pl-row" style={{
                      background: isTurn ? `${C[p.color].zone}28` : 'transparent',
                      border: `1px solid ${isTurn ? C[p.color].mid+'55' : 'transparent'}`,
                    }}>
                      <div className="lg-dot" style={{
                        background: `radial-gradient(circle at 35% 35%, ${C[p.color].bright}, ${C[p.color].mid})`,
                        boxShadow: isTurn ? `0 0 10px ${C[p.color].mid}` : 'none',
                      }} />
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                          {p.name}
                          {p.playerId === playerId && <span style={{fontSize:10, color:'rgba(255,255,255,0.4)', marginLeft:5}}>(you)</span>}
                          {p.isBot && <span style={{fontSize:10, color:'rgba(255,255,255,0.35)', marginLeft:4}}>bot</span>}
                        </div>
                        <div className="lg-progress">
                          {p.tokens.map(t => (
                            <div key={t.id} className="lg-prog-pip" style={{
                              background: t.pos === 58 ? C[p.color].mid
                                : t.pos === -1 ? 'rgba(255,255,255,0.2)'
                                : C[p.color].bright,
                              border: `1px solid ${C[p.color].mid}`,
                              boxShadow: t.pos === 58 ? `0 0 4px ${C[p.color].bright}` : 'none',
                            }} />
                          ))}
                        </div>
                      </div>
                      {isTurn && <span style={{fontSize:12, color:'#FFD700'}}>▶</span>}
                      {p.rank !== null && (
                        <span style={{fontSize:12, fontWeight:700, color: p.rank===1 ? '#FFD700' : 'rgba(255,255,255,0.5)'}}>
                          {p.rank===1 ? '🥇' : p.rank===2 ? '🥈' : p.rank===3 ? '🥉' : `#${p.rank}`}
                        </span>
                      )}
                    </div>
                  );
                })}
                {isWaiting && state.players.length < 4 && (
                  <div style={{display:'flex', flexDirection:'column', gap:4, marginTop:4}}>
                    {Array.from({length: 4 - state.players.length}).map((_, i) => (
                      <div key={i} className="lg-pl-row" style={{opacity:.4}}>
                        <div className="lg-dot" style={{background:'rgba(255,255,255,0.2)'}} />
                        <span style={{fontSize:12, color:'rgba(255,255,255,0.5)'}}>Waiting for player…</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dice + action card */}
              <div className="lg-card">
                <div className="lg-label">
                  {isWaiting ? 'Ready to start?' : isFinished ? 'Result' : 'Dice'}
                </div>

                {isWaiting && myPlayer && (
                  <>
                    <p style={{fontSize:12, color:'rgba(255,255,255,0.55)', marginBottom:12, lineHeight:1.5}}>
                      Share the room code with up to 3 friends. Empty spots fill with bots when you start.
                    </p>
                    <button className="lg-btn lg-btn-start" onClick={doStart} disabled={busy}
                      aria-busy={busy}>
                      {busy ? 'Starting…' : '▶ Start game'}
                    </button>
                  </>
                )}

                {isWaiting && !myPlayer && (
                  <div style={{display:'flex', flexDirection:'column', gap:10}}>
                    <p style={{fontSize:12, color:'rgba(255,255,255,0.65)', lineHeight:1.5, margin:0}}>
                      You received a shared link. Enter your name to join this game.
                    </p>
                    <input
                      type="text" maxLength={30} placeholder="Your name"
                      value={joinName} onChange={e => { setJoinName(e.target.value); setJoinErr(''); }}
                      onKeyDown={e => e.key === 'Enter' && doJoin()}
                      style={{
                        background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.2)',
                        borderRadius:8, padding:'10px 14px', color:'#fff', fontSize:14,
                        outline:'none', width:'100%',
                      }}
                    />
                    {joinErr && <p style={{fontSize:12, color:'#ef9a9a', margin:0}}>{joinErr}</p>}
                    <button className="lg-btn lg-btn-start" onClick={doJoin}
                      disabled={joining} aria-busy={joining}>
                      {joining ? 'Joining…' : '→ Join game'}
                    </button>
                  </div>
                )}

                {isPlaying && !myPlayer && (
                  <div style={{display:'flex', flexDirection:'column', gap:10, alignItems:'center', padding:'8px 0'}}>
                    <p style={{fontSize:13, color:'rgba(255,255,255,0.5)', textAlign:'center', margin:0, lineHeight:1.6}}>
                      This game is already in progress.<br/>You are watching as a spectator.
                    </p>
                    <a href="/" style={{
                      display:'block', textAlign:'center', width:'100%',
                      background:'rgba(255,255,255,0.1)', borderRadius:10,
                      padding:'10px 0', color:'#fff', fontSize:13, fontWeight:700,
                      textDecoration:'none', border:'1px solid rgba(255,255,255,0.2)',
                    }}>
                      ＋ Start your own game
                    </a>
                  </div>
                )}

                {isPlaying && myPlayer && (
                  <div className="lg-dice-area">
                    <div style={{
                      padding:'16px 20px', borderRadius:12,
                      background: isMyTurn ? 'rgba(255,215,0,0.06)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isMyTurn ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.08)'}`,
                      width:'100%', textAlign:'center',
                    }}>
                      <div style={{
                        display:'inline-block',
                        animation: rolling ? 'lspin 0.4s linear infinite' : 'none',
                      }}>
                        <DiceFace value={state.diceRolled ? state.dice : null} size={80} />
                      </div>
                      {state.diceRolled && state.dice !== null && (
                        <p style={{margin:'8px 0 0', fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.8)'}}>
                          Rolled: {state.dice}
                        </p>
                      )}
                    </div>

                    <button
                      className="lg-btn lg-btn-roll"
                      onClick={doRoll}
                      disabled={!canRoll}
                      aria-busy={busy && rolling}
                      aria-label={
                        !isPlaying ? 'Game not started' :
                        !isMyTurn ? "Not your turn" :
                        state.diceRolled ? 'Already rolled — choose a token' :
                        'Roll dice'
                      }
                    >
                      {rolling ? '🎲 Rolling…'
                        : !isMyTurn ? `🎲 ${curPlayer?.name ?? '…'}'s turn`
                        : state.diceRolled ? '✓ Pick a token'
                        : '🎲 Roll dice'}
                    </button>

                    {isMyTurn && state.diceRolled && movable.length > 0 && (
                      <p className="lg-status-txt">
                        Tap a glowing token on the board to move it.
                      </p>
                    )}
                    {isMyTurn && state.diceRolled && movable.length === 0 && (
                      <p className="lg-status-txt" style={{color:'#ef9a9a'}}>
                        No valid moves — turn passes automatically.
                      </p>
                    )}
                    {!isMyTurn && (
                      <p className="lg-status-txt">
                        {curPlayer?.isBot ? `${curPlayer.name} is thinking…` : 'Waiting for their move…'}
                      </p>
                    )}
                  </div>
                )}

                {isFinished && (
                  <div style={{display:'flex', flexDirection:'column', gap:8}}>
                    <p style={{textAlign:'center', fontSize:20, fontWeight:800, color:'#FFD700', margin:0}}>
                      🏆 Game Over!
                    </p>
                    {ranked.map(p => (
                      <div key={p.color} style={{
                        display:'flex', alignItems:'center', gap:10, padding:'8px 10px',
                        borderRadius:8, fontWeight: p.rank===1 ? 700 : 400,
                        background: p.rank===1 ? 'rgba(255,215,0,0.1)' : 'transparent',
                      }}>
                        <span style={{width:24, textAlign:'right', fontSize:14}}>
                          {p.rank===1?'🥇':p.rank===2?'🥈':p.rank===3?'🥉':`#${p.rank}`}
                        </span>
                        <div style={{width:14, height:14, borderRadius:'50%', background:C[p.color].mid, border:'2px solid white'}} />
                        <span style={{fontSize:13}}>{p.name}</span>
                      </div>
                    ))}
                    <a href="/" style={{
                      display:'block', textAlign:'center', marginTop:6,
                      background:'rgba(255,255,255,0.12)', borderRadius:10,
                      padding:'11px 0', color:'#fff', fontSize:13,
                      fontWeight:700, textDecoration:'none',
                      border:'1px solid rgba(255,255,255,0.2)',
                    }}>
                      Play again →
                    </a>
                  </div>
                )}
              </div>

              {error && (
                <div style={{
                  fontSize:12, color:'#ef9a9a', padding:'10px 14px',
                  background:'rgba(229,57,53,0.12)', borderRadius:8,
                  border:'1px solid rgba(229,57,53,0.3)',
                }}>
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
