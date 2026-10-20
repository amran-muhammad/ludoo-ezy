import React, {useCallback, useEffect, useRef, useState} from 'react';
import type {Color, GameState} from '../lib/ludo';
import {COLOR_OFFSET, COLORS, HOME_BASE, HOME_COLS, MAIN_PATH, SAFE_ABS, movableTokens} from '../lib/ludo';

// ── Palette ───────────────────────────────────────────────────────────────────

const C = {
  red:    {zone:'#b71c1c', mid:'#e53935', light:'#ffcdd2', bright:'#ff6659', path:'#ffcdd2', text:'#ff6659'},
  green:  {zone:'#1b5e20', mid:'#43a047', light:'#c8e6c9', bright:'#76d275', path:'#c8e6c9', text:'#76d275'},
  yellow: {zone:'#bf360c', mid:'#f57c00', light:'#ffe0b2', bright:'#ffca28', path:'#fff9c4', text:'#ffca28'},
  blue:   {zone:'#0d47a1', mid:'#1e88e5', light:'#bbdefb', bright:'#64b5f6', path:'#bbdefb', text:'#64b5f6'},
} as const;

const COLOR_NAMES: Record<Color, string> = {red:'Red', green:'Green', yellow:'Yellow', blue:'Blue'};

const CELL = 40;
function cx(col: number) { return col * CELL + CELL / 2; }
function cy(row: number) { return row * CELL + CELL / 2; }
function absIdx(color: Color, rel: number) { return (rel + COLOR_OFFSET[color]) % 52; }

const QUICK_EMOJIS = ['😄','😂','🔥','💪','🎲','🏆','👏','😎','🤩','🥳','🎉','❤️','😅','😭','🙏','👍','🤔','😤','😍','🤯','🎯','⚡','😊','🤣'];

// ── SVG Defs ──────────────────────────────────────────────────────────────────

function Defs() {
  return (
    <defs>
      {(COLORS as Color[]).map(c => (
        <radialGradient key={c} id={`tg-${c}`} cx="38%" cy="32%" r="70%">
          <stop offset="0%" stopColor={C[c].bright} />
          <stop offset="55%" stopColor={C[c].mid} />
          <stop offset="100%" stopColor={C[c].zone} />
        </radialGradient>
      ))}
      {(COLORS as Color[]).map(c => (
        <linearGradient key={c} id={`qg-${c}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={C[c].mid} stopOpacity={0.8} />
          <stop offset="100%" stopColor={C[c].zone} stopOpacity={1} />
        </linearGradient>
      ))}
      <filter id="tshadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000" floodOpacity="0.45" />
      </filter>
      <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
  );
}

// ── Static board ──────────────────────────────────────────────────────────────

const QUADRANTS: Array<{color: Color; r: number; c: number}> = [
  {color:'green', r:0, c:0},
  {color:'yellow', r:0, c:9},
  {color:'blue', r:9, c:0},
  {color:'red', r:9, c:9},
];

function BoardBg() {
  return (
    <>
      <rect width={600} height={600} fill="#f8f3e8" />
      {QUADRANTS.map(({color, r, c}) => (
        <g key={color}>
          <rect x={c*CELL} y={r*CELL} width={6*CELL} height={6*CELL} fill={`url(#qg-${color})`} />
          <rect x={c*CELL+CELL*0.8} y={r*CELL+CELL*0.8} width={4.4*CELL} height={4.4*CELL} rx={10}
            fill="white" fillOpacity={0.18} />
          {HOME_BASE[color].map(([row, col], i) => (
            <g key={i}>
              <circle cx={cx(col)} cy={cy(row)} r={16} fill={C[color].zone} stroke="white" strokeOpacity={0.4} strokeWidth={1.5} />
              <circle cx={cx(col)} cy={cy(row)} r={11} fill="white" fillOpacity={0.15} />
            </g>
          ))}
        </g>
      ))}
      {MAIN_PATH.map(([row, col], i) => {
        const safe = SAFE_ABS.has(i);
        const entry = Object.entries(COLOR_OFFSET).find(([, off]) => off === i)?.[0] as Color | undefined;
        const fill = entry ? C[entry].path : '#ffffff';
        return (
          <g key={i}>
            <rect x={col*CELL} y={row*CELL} width={CELL} height={CELL} fill={fill} stroke="#d4c9b0" strokeWidth={0.7} />
            {safe && !entry && (
              <g transform={`translate(${cx(col)},${cy(row)})`}>
                <polygon
                  points={Array.from({length: 12}).map((_, k) => {
                    const angle = (k*30-90)*Math.PI/180;
                    const r = k%2===0 ? 7 : 4;
                    return `${Math.cos(angle)*r},${Math.sin(angle)*r}`;
                  }).join(' ')}
                  fill="#90a4ae" opacity={0.7}
                />
              </g>
            )}
          </g>
        );
      })}
      {(COLORS as Color[]).map(color =>
        HOME_COLS[color].map(([row, col], i) => (
          <rect key={`${color}${i}`} x={col*CELL} y={row*CELL} width={CELL} height={CELL}
            fill={C[color].path} stroke="#d4c9b0" strokeWidth={0.7} />
        ))
      )}
      {([
        ['green', 6, 6, 9, 6, 7.5, 7.5],
        ['yellow', 9, 6, 9, 9, 7.5, 7.5],
        ['blue', 6, 9, 9, 9, 7.5, 7.5],
        ['red', 6, 6, 6, 9, 7.5, 7.5],
      ] as [Color,number,number,number,number,number,number][]).map(([color,r1,c1,r2,c2,rm,cm]) => (
        <polygon key={color}
          points={`${c1*CELL},${r1*CELL} ${c2*CELL},${r2*CELL} ${cm*CELL},${rm*CELL}`}
          fill={C[color].mid} opacity={0.9} />
      ))}
      <circle cx={cx(7)} cy={cy(7)} r={CELL*0.72} fill="white" />
      {Array.from({length: 16}).map((_, i) => (
        <React.Fragment key={i}>
          <line x1={i*CELL} y1={0} x2={i*CELL} y2={600} stroke="#c8bda0" strokeWidth={0.5} />
          <line x1={0} y1={i*CELL} x2={600} y2={i*CELL} stroke="#c8bda0" strokeWidth={0.5} />
        </React.Fragment>
      ))}
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

function DiceFace({value, size=72}: {value:number|null; size?: number}) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" style={{display:'block',filter:'drop-shadow(0 4px 12px rgba(0,0,0,0.6))'}}>
      <defs>
        <linearGradient id="dg2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#d8d0c0" />
        </linearGradient>
      </defs>
      <rect width={72} height={72} rx={14} fill="url(#dg2)" stroke="#bbb" strokeWidth={1.5} />
      <rect x={4} y={4} width={64} height={64} rx={11} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={1} />
      {value !== null
        ? (PIPS[value] ?? []).map(([px,py], i) => (
            <circle key={i} cx={px*72} cy={py*72} r={5.5} fill="#1a1a1a" style={{filter:'drop-shadow(0 1px 1px rgba(0,0,0,0.3))'}} />
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
    <g onClick={movable ? onMove : undefined} style={{cursor:movable?'pointer':'default'}}
      role={movable?'button':undefined} aria-label={label} filter="url(#tshadow)">
      {movable && (
        <circle cx={x} cy={y} r={20} fill={C[color].bright} opacity={0.35}
          filter="url(#glow)" style={{animation:'lpulse 1.1s ease-in-out infinite'}} />
      )}
      <circle cx={x} cy={y} r={14} fill={`url(#tg-${color})`}
        stroke={movable?'#FFD700':'rgba(255,255,255,0.7)'}
        strokeWidth={movable?2.5:1.5} />
      <ellipse cx={x-4} cy={y-5} rx={5} ry={3.5} fill="white" opacity={0.45} />
    </g>
  );
}

// ── Player corner card ────────────────────────────────────────────────────────

function PlayerCard({player, isTurn, isMe, rank}: {
  player: {color:Color; name:string; isBot:boolean; tokens:{pos:number}[]; rank:number|null};
  isTurn: boolean; isMe: boolean; rank: number|null;
}) {
  return (
    <div style={{
      background: isTurn ? `${C[player.color].zone}cc` : 'rgba(0,0,0,0.55)',
      border: `2px solid ${isTurn ? C[player.color].mid : 'rgba(255,255,255,0.12)'}`,
      borderRadius: 10,
      padding: '6px 8px',
      minWidth: 90,
      maxWidth: 120,
      backdropFilter: 'blur(8px)',
      boxShadow: isTurn ? `0 0 16px ${C[player.color].mid}66` : 'none',
      transition: 'all 0.3s',
    }}>
      <div style={{display:'flex', alignItems:'center', gap:5, marginBottom:4}}>
        <div style={{
          width:10, height:10, borderRadius:'50%',
          background: `radial-gradient(circle at 35% 35%, ${C[player.color].bright}, ${C[player.color].mid})`,
          boxShadow: isTurn ? `0 0 6px ${C[player.color].mid}` : 'none',
          flexShrink:0,
        }} />
        <span style={{
          fontSize:11, fontWeight:700, color:'#fff',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
          maxWidth:80,
        }}>
          {player.name}{isMe && <span style={{color:'rgba(255,255,255,0.5)',fontWeight:400}}> (you)</span>}
        </span>
        {rank !== null && (
          <span style={{fontSize:12, marginLeft:'auto'}}>
            {rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':`#${rank}`}
          </span>
        )}
      </div>
      <div style={{display:'flex', gap:3}}>
        {player.tokens.map((t,i) => (
          <div key={i} style={{
            width:8, height:8, borderRadius:'50%',
            background: t.pos===58 ? C[player.color].mid
              : t.pos===-1 ? 'rgba(255,255,255,0.18)'
              : C[player.color].bright,
            border: `1px solid ${C[player.color].mid}`,
            boxShadow: t.pos===58 ? `0 0 4px ${C[player.color].bright}` : 'none',
          }} />
        ))}
        {isTurn && (
          <span style={{marginLeft:'auto',fontSize:10,color:'#FFD700',fontWeight:700}}>▶ TURN</span>
        )}
      </div>
    </div>
  );
}

// ── Chat panel ────────────────────────────────────────────────────────────────

interface ChatMsg {id:number; playerName:string; color:string; body:string}

function ChatPanel({code, myName, myColor}: {code:string; myName:string|null; myColor:string|null}) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const lastId = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchMsgs = useCallback(async () => {
    try {
      const url = `/site-api/ludo/rooms/${code}/messages?after=${lastId.current}`;
      const d: {messages?: ChatMsg[]} = await fetch(url).then(r => r.json());
      if (d.messages && d.messages.length > 0) {
        setMsgs(prev => {
          const newMsgs = d.messages!.filter(m => !prev.some(p => p.id === m.id));
          if (!newMsgs.length) return prev;
          const next = [...prev, ...newMsgs].slice(-80);
          lastId.current = next[next.length - 1].id;
          return next;
        });
      }
    } catch { /* network error, ignore */ }
  }, [code]);

  useEffect(() => {
    fetchMsgs();
    const iv = setInterval(fetchMsgs, 2500);
    return () => clearInterval(iv);
  }, [fetchMsgs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({behavior:'smooth'});
  }, [msgs]);

  async function send(body: string) {
    const trimmed = body.trim();
    if (!trimmed || !myName || !myColor || sending) return;
    setSending(true);
    try {
      await fetch(`/site-api/ludo/rooms/${code}/messages`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({playerName: myName, color: myColor, body: trimmed}),
      });
      setText('');
      setShowEmoji(false);
      await fetchMsgs();
    } catch { /* ignore */ }
    setSending(false);
    inputRef.current?.focus();
  }

  return (
    <div style={{
      display:'flex', flexDirection:'column',
      height:'100%', background:'rgba(0,0,0,0.35)',
      borderRadius:14, border:'1px solid rgba(255,255,255,0.1)',
      overflow:'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,0.1)',
        fontSize:11, fontWeight:700, letterSpacing:2, color:'rgba(255,255,255,0.5)',
        textTransform:'uppercase', flexShrink:0,
      }}>
        💬 Chat
      </div>

      {/* Messages */}
      <div style={{flex:1, overflowY:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:6}}>
        {msgs.length === 0 && (
          <p style={{fontSize:12, color:'rgba(255,255,255,0.3)', textAlign:'center', margin:'auto 0'}}>
            No messages yet. Say hello!
          </p>
        )}
        {msgs.map(m => {
          const col = C[m.color as Color] ?? {text:'#aaa', mid:'#aaa'};
          return (
            <div key={m.id} style={{display:'flex', gap:6, alignItems:'flex-start'}}>
              <div style={{
                width:8, height:8, borderRadius:'50%', marginTop:5, flexShrink:0,
                background:col.mid, boxShadow:`0 0 4px ${col.mid}`,
              }} />
              <div>
                <span style={{fontSize:11, fontWeight:700, color:col.text}}>{m.playerName} </span>
                <span style={{fontSize:13, color:'rgba(255,255,255,0.9)', wordBreak:'break-word'}}>{m.body}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Emoji picker */}
      {showEmoji && (
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:2,
          padding:'8px 10px', borderTop:'1px solid rgba(255,255,255,0.1)',
          background:'rgba(0,0,0,0.3)',
        }}>
          {QUICK_EMOJIS.map(e => (
            <button key={e} onClick={() => send(e)} style={{
              background:'none', border:'none', cursor:'pointer',
              fontSize:20, padding:'4px 2px', borderRadius:6,
              transition:'transform .1s',
            }}
              onMouseEnter={el => (el.currentTarget.style.transform='scale(1.3)')}
              onMouseLeave={el => (el.currentTarget.style.transform='scale(1)')}
            >{e}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        display:'flex', gap:6, padding:'8px 10px',
        borderTop:'1px solid rgba(255,255,255,0.1)', flexShrink:0,
        background:'rgba(0,0,0,0.2)',
      }}>
        <button onClick={() => setShowEmoji(v => !v)} title="Emojis" style={{
          background: showEmoji ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.08)',
          border: `1px solid ${showEmoji ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.15)'}`,
          borderRadius:8, padding:'6px 9px', cursor:'pointer', fontSize:16,
          color:'#fff', flexShrink:0, transition:'all .2s',
        }}>😊</button>
        <input
          ref={inputRef}
          type="text" maxLength={200}
          placeholder={myName ? 'Message…' : 'Join to chat'}
          disabled={!myName}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key==='Enter' && send(text)}
          style={{
            flex:1, background:'rgba(255,255,255,0.08)',
            border:'1px solid rgba(255,255,255,0.15)', borderRadius:8,
            padding:'7px 11px', color:'#fff', fontSize:13, outline:'none',
            minWidth:0,
          }}
        />
        <button onClick={() => send(text)} disabled={!myName || sending || !text.trim()} style={{
          background:'linear-gradient(135deg,#e53935,#b71c1c)',
          border:'none', borderRadius:8, padding:'7px 12px', cursor:'pointer',
          color:'#fff', fontWeight:700, fontSize:13, flexShrink:0,
          opacity: (!myName || !text.trim()) ? 0.4 : 1,
          transition:'opacity .2s',
        }}>→</button>
      </div>
    </div>
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
  const r = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  return r.json() as Promise<T>;
}
async function get<T>(url: string): Promise<T> {
  return (await fetch(url)).json() as Promise<T>;
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  room: {code:string; status:string; state:GameState};
}

export default function LudoGame({room: init}: Props) {
  const playerId = pid();
  const [state, setState] = useState<GameState>(init.state);
  const [roomStatus, setRoomStatus] = useState(init.status);
  const [busy, setBusy] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [joinName, setJoinName] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('name')?.trim() ?? ''; } catch { return ''; }
  });
  const [joinErr, setJoinErr] = useState(() => {
    try {
      const err = new URLSearchParams(window.location.search).get('joinError');
      if (!err) return '';
      const msgs: Record<string,string> = {
        full:'Room is full.',
        already_started:'Game already started — you can only watch.',
        not_found:'Room not found. Check the code and try again.',
        bad_request:'Invalid name or player ID. Please refresh.',
        corrupted:'Room data unavailable. Try a different room.',
      };
      return msgs[err] ?? 'Could not join. Please try again.';
    } catch { return ''; }
  });
  const [joining, setJoining] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const autoJoined = useRef(false);
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
  const canRoll    = isPlaying && isMyTurn && !state.diceRolled && !busy;

  const fetch_ = useCallback(async () => {
    const d = await get<{room:{state:GameState;status:string}}>(`/site-api/ludo/rooms/${code}`);
    if (d?.room) { setState(d.room.state); setRoomStatus(d.room.status); }
  }, [code]);

  useEffect(() => {
    const poll = isWaiting || (isPlaying && !isMyTurn);
    if (poll) pollRef.current = setInterval(fetch_, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isMyTurn, isWaiting, isPlaying, fetch_]);

  useEffect(() => {
    if (autoJoined.current || myPlayer || !isWaiting) return;
    let urlName = '';
    try { urlName = new URLSearchParams(window.location.search).get('name')?.trim() ?? ''; } catch {}
    if (!urlName) return;
    autoJoined.current = true;
    try { history.replaceState({}, '', window.location.pathname); } catch {}
    doJoin(urlName);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWaiting, myPlayer]);

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

  async function doJoin(forName?: string) {
    const name = (typeof forName==='string' ? forName : joinName).trim();
    if (!name) { setJoinErr('Enter your name.'); return; }
    setJoining(true); setJoinErr('');
    try {
      const r = await fetch(`/site-api/ludo/rooms/${code}/join`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({name, playerId}),
      });
      let d: {code?:string;color?:string;error?:string;message?:string} = {};
      let jsonOk = true;
      try { d = await r.json(); } catch { jsonOk = false; }
      if (d.code) {
        try { localStorage.setItem('ludo_player_id', playerId); } catch {}
        await fetch_();
      } else if (!jsonOk) {
        const params = new URLSearchParams({name, playerId});
        window.location.href = `/site-api/ludo/rooms/${code}/join-redirect?${params}`;
        return;
      } else {
        setJoinErr(
          d.error==='full' ? 'Room is full.' :
          d.error==='already_started' ? 'Game already started — you can only watch.' :
          d.message ?? 'Could not join. Please try again.'
        );
      }
    } catch { setJoinErr('Connection failed. Check your internet and try again.'); }
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

  // Helper: find player by color (including absent slots)
  const playerOf = (color: Color) => state.players.find(p => p.color === color) ?? null;

  // Corner positions matching board quadrants: TL=green, TR=yellow, BL=blue, BR=red
  const CORNERS: {color:Color; style:React.CSSProperties}[] = [
    {color:'green',  style:{top:0,  left:0,  transformOrigin:'top left'}},
    {color:'yellow', style:{top:0,  right:0, transformOrigin:'top right'}},
    {color:'blue',   style:{bottom:0, left:0,  transformOrigin:'bottom left'}},
    {color:'red',    style:{bottom:0, right:0, transformOrigin:'bottom right'}},
  ];

  const maxP = state.maxPlayers ?? 4;
  const activeColors = COLORS.slice(0, maxP);

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        .lg-root {
          min-height: 100dvh;
          background: linear-gradient(160deg, #0d1117 0%, #1a1f3c 45%, #0f2d1f 100%);
          color: #fff;
          font-family: system-ui, -apple-system, sans-serif;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        /* ── Header ── */
        .lg-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: rgba(0,0,0,0.4);
          border-bottom: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(8px);
          flex-shrink: 0;
          z-index: 10;
        }
        /* ── Main content area ── */
        .lg-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          overflow-y: auto;
          padding: 12px 8px 0;
          gap: 12px;
        }
        /* ── Board area: board + overlaid corner cards ── */
        .lg-board-area {
          position: relative;
          width: min(92vw, 420px);
          flex-shrink: 0;
        }
        .lg-board-svg {
          display: block;
          width: 100%;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.7), 0 0 0 6px #5d4037, 0 0 0 9px #3e2723;
        }
        .lg-corner {
          position: absolute;
          z-index: 5;
        }
        /* ── Bottom controls ── */
        .lg-controls {
          width: 100%;
          max-width: 420px;
          flex-shrink: 0;
        }
        .lg-dice-row {
          display: flex;
          align-items: center;
          gap: 14px;
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          padding: 14px 16px;
        }
        .lg-roll-btn {
          flex: 1;
          border: none;
          border-radius: 12px;
          padding: 14px 16px;
          font-size: 16px;
          font-weight: 800;
          color: #fff;
          cursor: pointer;
          transition: all .2s;
          letter-spacing: .5px;
          background: linear-gradient(135deg, #e53935, #b71c1c);
          box-shadow: 0 4px 20px rgba(229,57,53,0.4);
        }
        .lg-roll-btn:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(229,57,53,0.55); }
        .lg-roll-btn:not(:disabled):active { transform: translateY(0); }
        .lg-roll-btn:disabled { opacity: .4; cursor: not-allowed; }
        .lg-roll-btn.not-turn {
          background: rgba(255,255,255,0.06);
          box-shadow: none;
        }
        /* ── Chat drawer (mobile) ── */
        .lg-chat-drawer {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          height: 55vh;
          z-index: 50;
          background: #121827;
          border-top: 2px solid rgba(255,255,255,0.15);
          border-radius: 20px 20px 0 0;
          transform: translateY(100%);
          transition: transform .3s cubic-bezier(.25,.8,.25,1);
          display: flex;
          flex-direction: column;
        }
        .lg-chat-drawer.open { transform: translateY(0); }
        .lg-chat-btn {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 20px;
          padding: 6px 14px;
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: background .2s;
        }
        .lg-chat-btn:hover { background: rgba(255,255,255,0.18); }
        .lg-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 49;
          display: none;
        }
        .lg-overlay.show { display: block; }
        /* ── Status text ── */
        .lg-status {
          text-align: center;
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          padding: 0 4px 4px;
        }
        /* ── Card ── */
        .lg-card {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px;
          padding: 14px 16px;
        }
        .lg-card-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.4);
          margin-bottom: 10px;
        }
        .lg-btn-start {
          width: 100%;
          border: none;
          border-radius: 10px;
          padding: 13px 20px;
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all .2s;
          background: linear-gradient(135deg, #43a047, #1b5e20);
          box-shadow: 0 4px 15px rgba(67,160,71,0.4);
        }
        .lg-btn-start:not(:disabled):hover { transform: translateY(-1px); }
        .lg-btn-start:disabled { opacity: .45; cursor: not-allowed; }
        /* ── Turn badge ── */
        .lg-turn-badge {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 20px;
        }
        /* ── Waiting player rows ── */
        .lg-pl-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 10px;
          margin-bottom: 4px;
          border: 1px solid transparent;
          transition: all .3s;
        }
        .lg-dot {
          width: 16px; height: 16px;
          border-radius: 50%;
          border: 2px solid white;
          flex-shrink: 0;
        }
        /* ── Desktop layout ── */
        @media (min-width: 900px) {
          .lg-content {
            flex-direction: row;
            align-items: flex-start;
            justify-content: center;
            padding: 20px 24px;
            gap: 24px;
            overflow-y: auto;
          }
          .lg-board-area { width: min(56vh, 580px); }
          .lg-center-col {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
          }
          .lg-controls { max-width: 260px; }
          .lg-chat-drawer {
            position: static;
            height: auto;
            min-height: 280px;
            max-height: 420px;
            transform: none !important;
            border-radius: 14px;
            border: 1px solid rgba(255,255,255,0.1);
            flex: 1;
            width: 260px;
          }
          .lg-chat-btn { display: none; }
          .lg-overlay { display: none !important; }
          .lg-mobile-pad { display: none; }
        }
        @media (min-width: 1200px) {
          .lg-board-area { width: min(65vh, 640px); }
          .lg-controls { max-width: 290px; }
          .lg-chat-drawer { width: 290px; }
        }
        @keyframes lpulse { 0%,100%{opacity:.25} 50%{opacity:.7} }
        @keyframes lspin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes lshake {
          0%,100%{transform:rotate(0deg)}
          20%{transform:rotate(-15deg)}
          40%{transform:rotate(15deg)}
          60%{transform:rotate(-10deg)}
          80%{transform:rotate(10deg)}
        }
      `}</style>

      <div className="lg-root">
        {/* ── Header ── */}
        <header className="lg-header">
          <a href="/" style={{color:'rgba(255,255,255,0.5)', fontSize:13, textDecoration:'none', fontWeight:600, flexShrink:0}}>
            ← Home
          </a>
          <span style={{fontWeight:900, fontSize:18, letterSpacing:4, color:'#FFD700'}}>LUDO</span>

          {isPlaying && (
            <span className="lg-turn-badge" style={{
              background: isMyTurn ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.08)',
              color: isMyTurn ? '#FFD700' : 'rgba(255,255,255,0.6)',
              border: `1px solid ${isMyTurn ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.15)'}`,
            }}>
              {isMyTurn ? '🎯 Your turn' : `${curPlayer?.name ?? '…'}'s turn`}
            </span>
          )}

          <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:8}}>
            <span style={{fontFamily:'monospace', fontSize:17, fontWeight:800, letterSpacing:4, color:'rgba(255,255,255,0.8)'}}>{code}</span>
            <button onClick={() => {
              navigator.clipboard.writeText(window.location.href).then(() => {
                setCopied(true); setTimeout(() => setCopied(false), 2000);
              });
            }} style={{
              background: copied ? '#388e3c' : 'rgba(255,255,255,0.1)',
              border:'1px solid rgba(255,255,255,0.2)', borderRadius:8,
              padding:'5px 12px', color:'#fff', fontSize:12, cursor:'pointer', fontWeight:600, transition:'background .2s',
            }}>
              {copied ? '✓ Copied' : '🔗 Share'}
            </button>
            {/* Chat toggle (mobile) */}
            <button className="lg-chat-btn" onClick={() => setChatOpen(v => !v)}>
              💬 {chatOpen ? 'Close' : 'Chat'}
            </button>
          </div>
        </header>

        <div className="lg-content">

          {/* ── Board column (mobile: full width, desktop: center) ── */}
          <div className="lg-center-col" style={{width:'100%', maxWidth:'min(92vw,420px)'}}>
            {/* Board with corner player cards */}
            <div className="lg-board-area">
              <svg className="lg-board-svg" viewBox="0 0 600 600">
                <Defs />
                <BoardBg />
                {tokenEls}
              </svg>

              {/* Corner player cards */}
              {CORNERS.map(({color, style}) => {
                const p = playerOf(color);
                if (!p && !activeColors.includes(color)) return null;
                const isTurn = isPlaying && state.players[state.turn]?.color === color;
                return (
                  <div key={color} className="lg-corner" style={{...style, padding:4}}>
                    {p ? (
                      <PlayerCard
                        player={p} isTurn={isTurn} isMe={p.playerId === playerId} rank={p.rank}
                      />
                    ) : activeColors.includes(color) && isWaiting ? (
                      <div style={{
                        background:'rgba(0,0,0,0.55)', border:`1px solid ${C[color].mid}44`,
                        borderRadius:10, padding:'6px 8px', opacity:.6,
                      }}>
                        <div style={{display:'flex', alignItems:'center', gap:5}}>
                          <div style={{width:10,height:10,borderRadius:'50%',background:C[color].mid,flexShrink:0}} />
                          <span style={{fontSize:11, color:'rgba(255,255,255,0.5)'}}>
                            {COLOR_NAMES[color]} slot
                          </span>
                        </div>
                        <div style={{fontSize:10, color:'rgba(255,255,255,0.3)', marginTop:2}}>Waiting…</div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* ── Controls (dice + actions) ── */}
            <div className="lg-controls" style={{width:'100%'}}>

              {/* Waiting room */}
              {isWaiting && (
                <div className="lg-card">
                  <div className="lg-card-label">
                    Players — {state.players.filter(p=>!p.isBot).length}/{maxP}
                  </div>
                  {state.players.map((p,i) => {
                    const isTurn = isPlaying && state.turn === i;
                    return (
                      <div key={p.color} className="lg-pl-row" style={{
                        background: isTurn ? `${C[p.color].zone}28` : 'transparent',
                        border:`1px solid ${isTurn ? C[p.color].mid+'55' : 'transparent'}`,
                      }}>
                        <div className="lg-dot" style={{background:`radial-gradient(circle at 35% 35%, ${C[p.color].bright}, ${C[p.color].mid})`}} />
                        <div style={{flex:1, fontSize:13, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                          {p.name}
                          {p.playerId===playerId && <span style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginLeft:5}}>(you)</span>}
                          {p.isBot && <span style={{fontSize:10,color:'rgba(255,255,255,0.35)',marginLeft:4}}>bot</span>}
                        </div>
                      </div>
                    );
                  })}
                  {isWaiting && state.players.length < maxP && Array.from({length: maxP - state.players.length}).map((_, i) => (
                    <div key={i} className="lg-pl-row" style={{opacity:.4}}>
                      <div className="lg-dot" style={{background:'rgba(255,255,255,0.2)'}} />
                      <span style={{fontSize:12, color:'rgba(255,255,255,0.5)'}}>Waiting for player…</span>
                    </div>
                  ))}

                  {myPlayer ? (
                    <>
                      <p style={{fontSize:12,color:'rgba(255,255,255,0.5)',margin:'10px 0 12px',lineHeight:1.5}}>
                        Share the code with friends. Empty spots fill with bots when you start.
                      </p>
                      <button className="lg-btn-start" onClick={doStart} disabled={busy} aria-busy={busy}>
                        {busy ? 'Starting…' : `▶ Start game (${maxP} players)`}
                      </button>
                    </>
                  ) : (
                    <div style={{display:'flex', flexDirection:'column', gap:8, marginTop:10}}>
                      <p style={{fontSize:12,color:'rgba(255,255,255,0.65)',lineHeight:1.5,margin:0}}>
                        Enter your name to join this game.
                      </p>
                      <input type="text" maxLength={30} placeholder="Your name"
                        value={joinName} onChange={e => {setJoinName(e.target.value); setJoinErr('');}}
                        onKeyDown={e => e.key==='Enter' && doJoin()}
                        style={{
                          background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.2)',
                          borderRadius:8, padding:'10px 14px', color:'#fff', fontSize:14, outline:'none',
                        }}
                      />
                      {joinErr && <p style={{fontSize:12,color:'#ef9a9a',margin:0}}>{joinErr}</p>}
                      <button className="lg-btn-start" onClick={() => doJoin()} disabled={joining} aria-busy={joining}>
                        {joining ? 'Joining…' : '→ Join game'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Spectator */}
              {isPlaying && !myPlayer && (
                <div className="lg-card" style={{textAlign:'center'}}>
                  <p style={{fontSize:13, color:'rgba(255,255,255,0.5)', margin:'0 0 12px', lineHeight:1.6}}>
                    👁 Watching as spectator
                  </p>
                  <a href="/" style={{
                    display:'block', background:'rgba(255,255,255,0.1)', borderRadius:10,
                    padding:'10px 0', color:'#fff', fontSize:13, fontWeight:700, textDecoration:'none',
                    border:'1px solid rgba(255,255,255,0.2)',
                  }}>＋ Start your own game</a>
                </div>
              )}

              {/* Dice + roll */}
              {isPlaying && myPlayer && (
                <div className="lg-dice-row">
                  <div style={{animation: rolling ? 'lshake 0.4s linear' : 'none', flexShrink:0}}>
                    <DiceFace value={state.diceRolled ? state.dice : null} size={72} />
                  </div>
                  <div style={{flex:1, display:'flex', flexDirection:'column', gap:8}}>
                    <button
                      className={`lg-roll-btn${!isMyTurn ? ' not-turn' : ''}`}
                      onClick={doRoll}
                      disabled={!canRoll}
                      aria-busy={busy && rolling}
                      aria-label={canRoll ? 'Roll dice' : !isMyTurn ? "Not your turn" : 'Already rolled — choose a token'}
                    >
                      {rolling ? '🎲 Rolling…'
                        : !isMyTurn ? `⏳ ${curPlayer?.name ?? '…'}'s turn`
                        : state.diceRolled ? '✓ Pick a token'
                        : '🎲 Roll Dice'}
                    </button>
                    {isMyTurn && state.diceRolled && movable.length > 0 && (
                      <p style={{margin:0, fontSize:12, color:'rgba(255,255,255,0.5)', textAlign:'center'}}>
                        Tap a glowing token to move
                      </p>
                    )}
                    {isMyTurn && state.diceRolled && movable.length === 0 && (
                      <p style={{margin:0, fontSize:12, color:'#ef9a9a', textAlign:'center'}}>
                        No valid moves — turn passes
                      </p>
                    )}
                    {!isMyTurn && (
                      <p style={{margin:0, fontSize:12, color:'rgba(255,255,255,0.4)', textAlign:'center'}}>
                        {curPlayer?.isBot ? `${curPlayer.name} is thinking…` : 'Waiting for their move…'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Finished */}
              {isFinished && (
                <div className="lg-card" style={{textAlign:'center'}}>
                  <p style={{fontSize:22, fontWeight:900, color:'#FFD700', margin:'0 0 12px'}}>🏆 Game Over!</p>
                  {ranked.map(p => (
                    <div key={p.color} style={{
                      display:'flex', alignItems:'center', gap:10, padding:'8px 10px',
                      borderRadius:8, fontWeight:p.rank===1?700:400,
                      background:p.rank===1?'rgba(255,215,0,0.1)':'transparent', marginBottom:4,
                    }}>
                      <span style={{width:24, textAlign:'right', fontSize:14}}>
                        {p.rank===1?'🥇':p.rank===2?'🥈':p.rank===3?'🥉':`#${p.rank}`}
                      </span>
                      <div style={{width:14,height:14,borderRadius:'50%',background:C[p.color].mid,border:'2px solid white'}} />
                      <span style={{fontSize:13}}>{p.name}</span>
                    </div>
                  ))}
                  <a href="/" style={{
                    display:'block', marginTop:10, background:'rgba(255,255,255,0.12)',
                    borderRadius:10, padding:'11px 0', color:'#fff', fontSize:13,
                    fontWeight:700, textDecoration:'none', border:'1px solid rgba(255,255,255,0.2)',
                  }}>Play again →</a>
                </div>
              )}

              {error && (
                <div style={{
                  fontSize:12, color:'#ef9a9a', padding:'10px 14px',
                  background:'rgba(229,57,53,0.12)', borderRadius:8,
                  border:'1px solid rgba(229,57,53,0.3)', marginTop:8,
                }}>
                  {error}
                </div>
              )}
            </div>

            {/* Bottom padding so controls don't sit behind chat drawer on mobile */}
            <div className="lg-mobile-pad" style={{height:20}} />
          </div>

          {/* ── Chat (desktop sidebar) ── */}
          <div style={{display:'flex', flexDirection:'column', gap:12, width:260}} className="lg-chat-sidebar">
            <style>{`.lg-chat-sidebar { display: none; } @media (min-width:900px) { .lg-chat-sidebar { display: flex; min-height: 340px; max-height: calc(100dvh - 90px); } }`}</style>
            <div style={{flex:1, display:'flex', flexDirection:'column', minHeight:0}}>
              <ChatPanel code={code} myName={myPlayer?.name ?? null} myColor={myPlayer?.color ?? null} />
            </div>
          </div>

        </div>

        {/* ── Mobile chat overlay ── */}
        <div className={`lg-overlay${chatOpen?' show':''}`} onClick={() => setChatOpen(false)} />
        <div className={`lg-chat-drawer${chatOpen?' open':''}`}>
          <div style={{
            width:40,height:4,borderRadius:4,background:'rgba(255,255,255,0.3)',
            margin:'10px auto 4px', flexShrink:0,
          }} />
          <div style={{flex:1, minHeight:0}}>
            <ChatPanel code={code} myName={myPlayer?.name ?? null} myColor={myPlayer?.color ?? null} />
          </div>
        </div>

      </div>
    </>
  );
}
