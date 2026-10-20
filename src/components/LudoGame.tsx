import React, {useCallback, useEffect, useRef, useState} from 'react';
import type {Color, DiceValue, GameState} from '../lib/ludo';
import {COLOR_OFFSET, COLORS, HOME_BASE, HOME_COLS, MAIN_PATH, SAFE_ABS, movableTokens} from '../lib/ludo';

// ── Palette ───────────────────────────────────────────────────────────────────

const C = {
  red:    {zone:'#c62828', mid:'#ef5350', light:'#ffcdd2', bright:'#ff6659', path:'#ffcdd2'},
  green:  {zone:'#2e7d32', mid:'#66bb6a', light:'#c8e6c9', bright:'#a5d6a7', path:'#c8e6c9'},
  yellow: {zone:'#e65100', mid:'#ffa726', light:'#ffe0b2', bright:'#ffca28', path:'#fff9c4'},
  blue:   {zone:'#1565c0', mid:'#42a5f5', light:'#bbdefb', bright:'#90caf9', path:'#bbdefb'},
} as const;

const CELL = 40;
const cx = (col: number) => col * CELL + CELL / 2;
const cy = (row: number) => row * CELL + CELL / 2;
const absIdx = (color: Color, rel: number) => (rel + COLOR_OFFSET[color]) % 52;

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
          <stop offset="0%" stopColor={C[c].mid} stopOpacity={0.85} />
          <stop offset="100%" stopColor={C[c].zone} stopOpacity={1} />
        </linearGradient>
      ))}
      <filter id="tshadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000" floodOpacity="0.5" />
      </filter>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
  );
}

// ── Board ─────────────────────────────────────────────────────────────────────

const QUADRANTS: {color: Color; r: number; c: number}[] = [
  {color:'green',  r:0, c:0},
  {color:'yellow', r:0, c:9},
  {color:'blue',   r:9, c:0},
  {color:'red',    r:9, c:9},
];

function BoardBg() {
  return (
    <>
      <rect width={600} height={600} fill="#f5f0e8" />
      {QUADRANTS.map(({color, r, c}) => (
        <g key={color}>
          <rect x={c*CELL} y={r*CELL} width={6*CELL} height={6*CELL} fill={`url(#qg-${color})`} />
          <rect x={c*CELL+CELL*0.75} y={r*CELL+CELL*0.75} width={4.5*CELL} height={4.5*CELL} rx={12}
            fill="white" fillOpacity={0.2} />
          {HOME_BASE[color].map(([row, col], i) => (
            <g key={i}>
              <circle cx={cx(col)} cy={cy(row)} r={17} fill={C[color].zone}
                stroke="white" strokeOpacity={0.35} strokeWidth={2} />
              <circle cx={cx(col)} cy={cy(row)} r={12} fill="white" fillOpacity={0.12} />
            </g>
          ))}
        </g>
      ))}
      {MAIN_PATH.map(([row, col], i) => {
        const safe = SAFE_ABS.has(i);
        const entry = (Object.entries(COLOR_OFFSET) as [Color,number][])
          .find(([,off]) => off === i)?.[0];
        const fill = entry ? C[entry].path : '#ffffff';
        return (
          <g key={i}>
            <rect x={col*CELL} y={row*CELL} width={CELL} height={CELL}
              fill={fill} stroke="#d4c9a8" strokeWidth={0.8} />
            {safe && !entry && (
              <polygon
                transform={`translate(${cx(col)},${cy(row)})`}
                points={Array.from({length:12}).map((_,k)=>{
                  const a=(k*30-90)*Math.PI/180;
                  const r=k%2===0?7:4;
                  return `${Math.cos(a)*r},${Math.sin(a)*r}`;
                }).join(' ')}
                fill="#90a4ae" opacity={0.65}
              />
            )}
          </g>
        );
      })}
      {(COLORS as Color[]).map(color =>
        HOME_COLS[color].map(([row, col], i) => (
          <rect key={`${color}${i}`} x={col*CELL} y={row*CELL} width={CELL} height={CELL}
            fill={C[color].path} stroke="#d4c9a8" strokeWidth={0.8} />
        ))
      )}
      {([
        ['green',  6,6, 9,6, 7.5,7.5],
        ['yellow', 9,6, 9,9, 7.5,7.5],
        ['blue',   6,9, 9,9, 7.5,7.5],
        ['red',    6,6, 6,9, 7.5,7.5],
      ] as [Color,number,number,number,number,number,number][]).map(([color,r1,c1,r2,c2,rm,cm]) => (
        <polygon key={color}
          points={`${c1*CELL},${r1*CELL} ${c2*CELL},${r2*CELL} ${cm*CELL},${rm*CELL}`}
          fill={C[color].mid} opacity={0.92} />
      ))}
      <circle cx={cx(7)} cy={cy(7)} r={CELL*0.75} fill="white" />
      <text x={cx(7)} y={cy(7)+9} textAnchor="middle" fontSize={22} fill="#bbb">★</text>
      {Array.from({length:16}).map((_,i)=>(
        <React.Fragment key={i}>
          <line x1={i*CELL} y1={0} x2={i*CELL} y2={600} stroke="#c8bda0" strokeWidth={0.5}/>
          <line x1={0} y1={i*CELL} x2={600} y2={i*CELL} stroke="#c8bda0" strokeWidth={0.5}/>
        </React.Fragment>
      ))}
      <rect width={600} height={600} fill="none" stroke="#795548" strokeWidth={3}/>
    </>
  );
}

// ── Dice ──────────────────────────────────────────────────────────────────────

const PIPS: Record<number, [number,number][]> = {
  1:[[.5,.5]],
  2:[[.28,.28],[.72,.72]],
  3:[[.28,.28],[.5,.5],[.72,.72]],
  4:[[.28,.28],[.72,.28],[.28,.72],[.72,.72]],
  5:[[.28,.28],[.72,.28],[.5,.5],[.28,.72],[.72,.72]],
  6:[[.28,.22],[.72,.22],[.28,.5],[.72,.5],[.28,.78],[.72,.78]],
};

function DiceFace({value, size=64, rolling}: {value:number|null; size?: number; rolling?: boolean}) {
  const isSix = value === 6;
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" style={{
      display:'block',
      filter:'drop-shadow(0 4px 14px rgba(0,0,0,0.55))',
      animation: rolling ? 'diceRoll 0.45s ease-in-out' : 'none',
    }}>
      <defs>
        <linearGradient id="dg-n" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff"/>
          <stop offset="100%" stopColor="#d0c8b8"/>
        </linearGradient>
        <linearGradient id="dg-6" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff9e0"/>
          <stop offset="100%" stopColor="#ffe082"/>
        </linearGradient>
      </defs>
      <rect width={72} height={72} rx={14}
        fill={isSix ? 'url(#dg-6)' : 'url(#dg-n)'}
        stroke={isSix ? '#f9a825' : '#bbb'}
        strokeWidth={isSix ? 2.5 : 1.5}/>
      <rect x={4} y={4} width={64} height={64} rx={11}
        fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={1.2}/>
      {value !== null
        ? (PIPS[value] ?? []).map(([px,py],i) => (
            <circle key={i} cx={px*72} cy={py*72} r={5.8}
              fill={isSix ? '#e65100' : '#1a1a1a'}
              style={{filter:'drop-shadow(0 1px 1px rgba(0,0,0,0.3))'}}/>
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
        <circle cx={x} cy={y} r={21} fill={C[color].bright} opacity={0.38}
          filter="url(#glow)" style={{animation:'lpulse 1s ease-in-out infinite'}}/>
      )}
      <circle cx={x} cy={y} r={14} fill={`url(#tg-${color})`}
        stroke={movable ? '#FFD700' : 'rgba(255,255,255,0.65)'}
        strokeWidth={movable ? 2.8 : 1.5}/>
      <ellipse cx={x-4} cy={y-5} rx={5} ry={3.5} fill="white" opacity={0.42}/>
    </g>
  );
}

// ── Player portrait ───────────────────────────────────────────────────────────

interface PlayerInfo {
  color: Color; name: string; isBot: boolean;
  tokens: {id:number; pos:number}[]; rank: number|null; playerId: string;
}

function PlayerPortrait({player, color, isTurn, isMe}: {
  player: PlayerInfo|null; color: Color; isTurn: boolean; isMe: boolean;
}) {
  if (!player) {
    return (
      <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:3, width:80, opacity:.45}}>
        <div style={{
          width:44, height:44, borderRadius:'50%',
          background:'rgba(255,255,255,0.08)', border:`2px solid ${C[color].mid}44`,
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:'rgba(255,255,255,0.25)',
        }}>?</div>
        <span style={{fontSize:9, color:'rgba(255,255,255,0.3)', textTransform:'uppercase', letterSpacing:1}}>
          {color}
        </span>
      </div>
    );
  }
  return (
    <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:3, width:88}}>
      <div style={{position:'relative'}}>
        <div style={{
          width:46, height:46, borderRadius:'50%',
          background:`radial-gradient(circle at 35% 30%, ${C[player.color].bright}, ${C[player.color].zone})`,
          border:`3px solid ${isTurn ? '#FFD700' : C[player.color].mid}`,
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:20,
          boxShadow: isTurn
            ? `0 0 16px #FFD700cc, 0 0 0 2px #FFD70055`
            : `0 2px 8px rgba(0,0,0,0.5)`,
          transition:'box-shadow .3s, border-color .3s',
        }}>
          {player.tokens.every(t=>t.pos===58) ? '🏆' : player.isBot ? '🤖' : '👤'}
        </div>
        {player.rank !== null && (
          <div style={{position:'absolute', bottom:-4, right:-6, fontSize:13, lineHeight:1}}>
            {player.rank===1?'🥇':player.rank===2?'🥈':player.rank===3?'🥉':`#${player.rank}`}
          </div>
        )}
      </div>
      <span style={{
        fontSize:10, fontWeight:700, maxWidth:86,
        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        color: isTurn ? '#FFD700' : '#fff',
        textShadow:'0 1px 4px rgba(0,0,0,0.9)',
        transition:'color .3s',
      }}>
        {player.name}{isMe ? ' ★' : ''}
      </span>
      {/* Token pip dots */}
      <div style={{display:'flex', gap:3}}>
        {player.tokens.map((t,i) => (
          <div key={i} style={{
            width:7, height:7, borderRadius:'50%',
            background: t.pos===58 ? C[player.color].mid
              : t.pos===-1 ? 'rgba(255,255,255,0.22)'
              : C[player.color].bright,
            border:`1.5px solid ${C[player.color].mid}`,
            boxShadow: t.pos===58 ? `0 0 5px ${C[player.color].bright}` : 'none',
          }}/>
        ))}
      </div>
    </div>
  );
}

// ── Chat panel ────────────────────────────────────────────────────────────────

interface ChatMsg {id:number; playerName:string; color:string; body:string}

function ChatPanel({code, playerId, myName}: {code:string; playerId:string; myName:string|null}) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatErr, setChatErr] = useState('');
  const lastId = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchMsgs = useCallback(async () => {
    try {
      const d: {messages?: ChatMsg[]} = await fetch(
        `/site-api/ludo/rooms/${code}/messages?after=${lastId.current}`
      ).then(r => r.json());
      if (d.messages && d.messages.length > 0) {
        setMsgs(prev => {
          const fresh = d.messages!.filter(m => !prev.some(p => p.id === m.id));
          if (!fresh.length) return prev;
          const next = [...prev, ...fresh].slice(-80);
          lastId.current = next[next.length-1].id;
          return next;
        });
      }
    } catch { /* ignore */ }
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
    if (!trimmed || !myName || sending) return;
    setSending(true); setChatErr('');
    try {
      // Route expects: {playerId, body}
      const r = await fetch(`/site-api/ludo/rooms/${code}/messages`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({playerId, body: trimmed}),
      });
      if (r.ok) {
        setText(''); setShowEmoji(false);
        await fetchMsgs();
      } else {
        const d = await r.json().catch(()=>({})) as {message?:string};
        setChatErr(d.message ?? 'Could not send.');
      }
    } catch { setChatErr('Connection error.'); }
    setSending(false);
    inputRef.current?.focus();
  }

  return (
    <div style={{display:'flex', flexDirection:'column', height:'100%', minHeight:0}}>
      {/* Messages list */}
      <div style={{
        flex:1, overflowY:'auto', padding:'8px 12px',
        display:'flex', flexDirection:'column', gap:5,
      }}>
        {msgs.length === 0 && (
          <p style={{fontSize:12, color:'rgba(255,255,255,0.3)', textAlign:'center', margin:'auto', padding:'20px 0'}}>
            No messages yet. Say hello! 👋
          </p>
        )}
        {msgs.map(m => {
          const col = (C as Record<string, typeof C.red>)[m.color] ?? {mid:'#aaa', bright:'#ccc'};
          return (
            <div key={m.id} style={{display:'flex', alignItems:'flex-start', gap:6}}>
              <div style={{
                width:8, height:8, borderRadius:'50%', marginTop:5, flexShrink:0,
                background:col.mid, boxShadow:`0 0 5px ${col.mid}`,
              }}/>
              <div style={{minWidth:0}}>
                <span style={{fontSize:11, fontWeight:700, color:col.bright}}>{m.playerName} </span>
                <span style={{fontSize:13, color:'rgba(255,255,255,0.88)', wordBreak:'break-word'}}>{m.body}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}/>
      </div>

      {/* Emoji grid */}
      {showEmoji && (
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:2,
          padding:'8px 10px', borderTop:'1px solid rgba(255,255,255,0.1)',
          background:'rgba(0,0,0,0.35)',
        }}>
          {QUICK_EMOJIS.map(e => (
            <button key={e} onClick={() => send(e)} style={{
              background:'none', border:'none', cursor:'pointer',
              fontSize:22, padding:'4px 2px', borderRadius:6, lineHeight:1,
            }}>{e}</button>
          ))}
        </div>
      )}

      {chatErr && (
        <p style={{
          fontSize:11, color:'#ef9a9a', margin:'0 10px 4px',
          padding:'4px 8px', background:'rgba(200,0,0,0.15)', borderRadius:6,
        }}>{chatErr}</p>
      )}

      {/* Input row */}
      <div style={{
        display:'flex', gap:6, padding:'8px 10px', flexShrink:0,
        borderTop:'1px solid rgba(255,255,255,0.1)',
        background:'rgba(0,0,0,0.25)',
      }}>
        <button onClick={() => setShowEmoji(v => !v)} style={{
          background: showEmoji ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.08)',
          border:`1px solid ${showEmoji ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.15)'}`,
          borderRadius:8, padding:'7px 10px', cursor:'pointer',
          fontSize:18, flexShrink:0, transition:'all .2s',
        }}>😊</button>
        <input
          ref={inputRef} type="text" maxLength={200}
          placeholder={myName ? 'Type a message…' : 'Join to chat'}
          disabled={!myName}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send(text); } }}
          style={{
            flex:1, minWidth:0, background:'rgba(255,255,255,0.09)',
            border:'1px solid rgba(255,255,255,0.18)',
            borderRadius:8, padding:'8px 11px', color:'#fff',
            fontSize:13, outline:'none',
          }}
        />
        <button onClick={() => send(text)}
          disabled={!myName || sending || !text.trim()} style={{
          background:'linear-gradient(135deg,#e53935,#b71c1c)',
          border:'none', borderRadius:8, padding:'7px 14px',
          cursor:'pointer', color:'#fff', fontWeight:800, fontSize:14,
          flexShrink:0,
          opacity:(!myName || !text.trim()) ? 0.4 : 1,
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

async function apiPost<T>(url: string, body: object): Promise<T> {
  const r = await fetch(url, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  return r.json() as Promise<T>;
}

// ── Main game component ───────────────────────────────────────────────────────

interface Props { room: {code:string; status:string; state:GameState} }

export default function LudoGame({room: init}: Props) {
  const playerId = pid();
  const [state, setState] = useState<GameState>(init.state);
  const [busy, setBusy] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const [joinName, setJoinName] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('name')?.trim() ?? ''; } catch { return ''; }
  });
  const [joinErr, setJoinErr] = useState(() => {
    try {
      const e = new URLSearchParams(window.location.search).get('joinError');
      const m: Record<string,string> = {
        full:'Room is full.', already_started:'Game already started.',
        not_found:'Room not found.', bad_request:'Invalid request.', corrupted:'Room data unavailable.',
      };
      return e ? (m[e] ?? 'Could not join.') : '';
    } catch { return ''; }
  });
  const [joining, setJoining] = useState(false);

  // Track last dice value to always display it, even after auto-move resets state.dice to null
  const lastDiceRef = useRef<DiceValue|null>(null);
  if (state.dice !== null) lastDiceRef.current = state.dice;

  const pollRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const autoJoined = useRef(false);
  const code = init.code;

  const myPlayer  = state.players.find(p => p.playerId === playerId) ?? null;
  const myColor   = myPlayer?.color ?? null;
  const isMyTurn  = myPlayer !== null && state.players[state.turn]?.color === myColor;
  const curPlayer = state.players[state.turn];
  const movable   = (isMyTurn && state.diceRolled && state.dice !== null)
    ? movableTokens(state, myPlayer!, state.dice) : [];

  const isWaiting  = state.status === 'waiting';
  const isPlaying  = state.status === 'playing';
  const isFinished = state.status === 'finished';
  const canRoll    = isPlaying && isMyTurn && !state.diceRolled && !busy;

  // Detect extra-turn from six (rolled but not yet moved, or just got one)
  const gotExtraTurn = isMyTurn && state.diceRolled && state.dice === 6;

  // Dice face value: always show last rolled number
  const diceVal: DiceValue|null = state.dice ?? lastDiceRef.current;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  }, []);

  const lastEventRef = useRef<string|undefined>(undefined);
  const applyGameState = useCallback((s: GameState) => {
    setState(s);
    if (s.lastEvent && s.lastEvent !== lastEventRef.current) {
      lastEventRef.current = s.lastEvent;
      const ev = s.lastEvent;
      if (ev === 'three_sixes') showToast('🚫 Three 6s! Turn forfeited.');
      else if (ev === 'no_moves') showToast('⏭️ No valid moves — turn passed.');
      else if (ev.startsWith('cut:')) showToast(`✂️ Cut! ${ev.slice(4)} sent home.`);
      else if (ev.startsWith('finished:')) showToast(`🏆 ${ev.slice(9)} finished!`);
      else if (ev === 'extra_six') showToast('🎲 Six! Roll again.');
      else if (ev === 'extra_kill') showToast('⚔️ Kill! Roll again.');
    }
  }, [showToast]);

  const fetchState = useCallback(async () => {
    try {
      const d: {room:{state:GameState}} = await fetch(`/site-api/ludo/rooms/${code}`).then(r=>r.json());
      if (d?.room?.state) applyGameState(d.room.state);
    } catch { /* ignore */ }
  }, [code, applyGameState]);

  useEffect(() => {
    const needsPoll = isWaiting || (isPlaying && !isMyTurn);
    if (needsPoll) pollRef.current = setInterval(fetchState, 2000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [isMyTurn, isWaiting, isPlaying, fetchState]);

  // Auto-join when redirected from home with ?name=
  useEffect(() => {
    if (autoJoined.current || myPlayer || !isWaiting) return;
    let n = '';
    try { n = new URLSearchParams(window.location.search).get('name')?.trim() ?? ''; } catch {}
    if (!n) return;
    autoJoined.current = true;
    try { history.replaceState({}, '', window.location.pathname); } catch {}
    doJoin(n);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWaiting, myPlayer]);

  async function doStart() {
    setBusy(true); setError('');
    const d = await apiPost<{ok?:boolean;message?:string}>(`/site-api/ludo/rooms/${code}/start`, {playerId});
    if (d.ok) await fetchState(); else setError(d.message ?? 'Error starting.');
    setBusy(false);
  }

  async function doRoll() {
    if (!canRoll) return;
    setBusy(true); setRolling(true); setError('');
    const d = await apiPost<{state?:GameState;message?:string}>(`/site-api/ludo/rooms/${code}/roll`, {playerId});
    setRolling(false);
    if (d.state) {
      if (d.state.dice !== null) lastDiceRef.current = d.state.dice;
      applyGameState(d.state);
    } else {
      setError(d.message ?? 'Error rolling dice.');
    }
    setBusy(false);
  }

  async function doJoin(forName?: string) {
    const name = (typeof forName === 'string' ? forName : joinName).trim();
    if (!name) { setJoinErr('Enter your name.'); return; }
    setJoining(true); setJoinErr('');
    try {
      const r = await fetch(`/site-api/ludo/rooms/${code}/join`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({name, playerId}),
      });
      let d: {code?:string; error?:string; message?:string} = {};
      let jsonOk = true;
      try { d = await r.json(); } catch { jsonOk = false; }
      if (d.code) {
        try { localStorage.setItem('ludo_player_id', playerId); } catch {}
        await fetchState();
      } else if (!jsonOk) {
        const ps = new URLSearchParams({name, playerId});
        window.location.href = `/site-api/ludo/rooms/${code}/join-redirect?${ps}`;
        return;
      } else {
        setJoinErr(d.error === 'full' ? 'Room is full.' :
          d.error === 'already_started' ? 'Game already started.' :
          d.message ?? 'Could not join.');
      }
    } catch { setJoinErr('Connection failed.'); }
    setJoining(false);
  }

  async function doMove(tokenId: number) {
    if (!isMyTurn || !state.diceRolled || busy) return;
    setBusy(true); setError('');
    const d = await apiPost<{state?:GameState;message?:string}>(`/site-api/ludo/rooms/${code}/move`, {playerId, tokenId});
    if (d.state) applyGameState(d.state); else setError(d.message ?? 'Error moving.');
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
        const s = HOME_BASE[player.color][homeIdx++]; if (!s) continue;
        svgX = cx(s[1]); svgY = cy(s[0]);
      } else if (token.pos >= 52 && token.pos <= 57) {
        const h = HOME_COLS[player.color][token.pos-52]; if (!h) continue;
        svgX = cx(h[1]); svgY = cy(h[0]);
      } else {
        const m = MAIN_PATH[absIdx(player.color, token.pos)]; if (!m) continue;
        svgX = cx(m[1]); svgY = cy(m[0]);
      }
      const k = `${Math.round(svgX)},${Math.round(svgY)}`;
      const si = posCount.get(k) ?? 0; posCount.set(k, si+1);
      const [ox,oy] = STACK_OFF[si%4];
      const isMov = movable.includes(token.id) && player.color === myColor;
      tokenEls.push(
        <Token key={`${player.color}-${token.id}`}
          x={svgX+ox} y={svgY+oy} color={player.color}
          movable={isMov} onMove={() => doMove(token.id)}
          label={`${player.color} token ${token.id+1}${isMov?', tap to move':''}`}
        />
      );
    }
  }

  const ranked = [...state.players].sort((a,b) => (a.rank??99) - (b.rank??99));
  const maxP   = state.maxPlayers ?? 4;
  const playerOf = (color: Color): PlayerInfo|null =>
    state.players.find(p => p.color === color) ?? null;

  // Roll button label
  const rollLabel = rolling
    ? '🎲 Rolling…'
    : !isPlaying ? (isWaiting ? 'Game not started' : 'Game over')
    : !isMyTurn  ? `⏳ ${curPlayer?.name ?? '…'}'s turn`
    : gotExtraTurn ? '🔥 Extra turn! Roll again'
    : state.diceRolled ? (movable.length > 0 ? '↑ Pick a token to move' : '⏭ No moves — auto skip')
    : '🎲 Roll Dice';

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }

        .lg {
          display: flex; flex-direction: column;
          height: 100dvh; overflow: hidden;
          background: radial-gradient(ellipse at 30% 20%, #1a2a4a 0%, #0d1117 60%, #0d2010 100%);
          color: #fff;
          font-family: system-ui, -apple-system, sans-serif;
        }

        /* Top bar */
        .lg-bar {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 12px; flex-shrink: 0;
          background: rgba(0,0,0,0.5);
          border-bottom: 1px solid rgba(255,255,255,0.07);
          backdrop-filter: blur(6px);
          min-height: 46px;
        }

        /* Body: column on mobile, row on desktop */
        .lg-body { flex: 1; display: flex; overflow: hidden; }

        /* Center area: always a flex column */
        .lg-center {
          flex: 1; display: flex; flex-direction: column;
          overflow: hidden; min-width: 0;
        }

        /* Player portrait rows above/below board */
        .lg-prow {
          display: flex; align-items: center; justify-content: space-between;
          padding: 6px 14px; flex-shrink: 0;
        }

        /* Board */
        .lg-boardwrap {
          flex: 1; min-height: 0;
          display: flex; align-items: center; justify-content: center;
          padding: 0 10px;
        }
        .lg-board {
          display: block;
          /* Square: constrained by both width and height */
          width: min(calc(100vw - 20px), calc(100dvh - 220px));
          height: min(calc(100vw - 20px), calc(100dvh - 220px));
          border-radius: 10px;
          box-shadow: 0 0 0 5px #5d4037, 0 0 0 9px #3e2723, 0 16px 48px rgba(0,0,0,0.7);
        }

        /* Controls strip at bottom */
        .lg-controls {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 12px; flex-shrink: 0;
          background: rgba(0,0,0,0.45);
          border-top: 1px solid rgba(255,255,255,0.08);
          min-height: 68px;
        }

        /* Roll button */
        .lg-roll {
          flex: 1; border: none; border-radius: 12px;
          padding: 12px 14px; font-size: 14px; font-weight: 800;
          color: #fff; cursor: pointer; transition: all .15s; line-height: 1.2;
          min-height: 50px; text-align: center;
        }
        .lg-roll-on  { background: linear-gradient(135deg,#e53935,#b71c1c); box-shadow: 0 4px 18px rgba(229,57,53,0.5); }
        .lg-roll-on:active { transform: scale(0.97); }
        .lg-roll-off { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); opacity:.65; cursor:not-allowed; }
        .lg-roll-six { background: linear-gradient(135deg,#f57f17,#e65100); box-shadow: 0 4px 18px rgba(245,127,23,0.6); animation: sixPop .4s ease-in-out; }

        /* Side panels (desktop) */
        .lg-side { width: 248px; flex-shrink: 0; display: flex; flex-direction: column; overflow: hidden; }
        .lg-side-l { border-right: 1px solid rgba(255,255,255,0.08); }
        .lg-side-r { border-left:  1px solid rgba(255,255,255,0.08); }

        /* Mobile chat sheet */
        .lg-sheet {
          position: fixed; inset: 0; z-index: 60;
          display: flex; flex-direction: column; justify-content: flex-end;
        }
        .lg-sheet-bg { position: absolute; inset: 0; background: rgba(0,0,0,0.55); }
        .lg-sheet-panel {
          position: relative; z-index: 1;
          background: #141e30;
          border-radius: 22px 22px 0 0;
          border-top: 2px solid rgba(255,255,255,0.12);
          height: 58vh; display: flex; flex-direction: column; overflow: hidden;
        }
        .lg-sheet-handle {
          width:40px; height:4px; border-radius:4px;
          background:rgba(255,255,255,0.25); margin: 10px auto 4px; flex-shrink:0;
        }
        .lg-sheet-title {
          padding: 0 14px 8px; font-size: 11px; font-weight: 700;
          letter-spacing: 2px; text-transform: uppercase;
          color: rgba(255,255,255,0.4); flex-shrink: 0;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        /* Lobby card */
        .lg-lobby {
          margin: 8px 10px; padding: 14px 16px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 16px;
          display: flex; flex-direction: column; gap: 10px;
        }

        /* Badges */
        .lg-badge {
          font-size: 11px; font-weight: 700; letter-spacing: .8px;
          text-transform: uppercase; padding: 4px 10px; border-radius: 14px;
        }

        /* ── Desktop layout ── */
        @media (min-width: 840px) {
          .lg-side { display: flex; }
          .lg-board {
            width:  min(calc(100vw - 540px), 62vh);
            height: min(calc(100vw - 540px), 62vh);
          }
          /* On desktop the chat lives in the right panel, not a sheet */
          .lg-sheet { position: static; height: auto; display: flex; flex-direction: column; flex: 1; min-height: 0; }
          .lg-sheet-bg { display: none; }
          .lg-sheet-panel { flex: 1; height: auto; border-radius: 0; border-top: none; }
          .lg-sheet-handle { display: none; }
          .lg-sheet-title { padding-top: 12px; }
          .lg-chat-fab { display: none !important; }
        }

        @keyframes lpulse { 0%,100%{opacity:.22} 50%{opacity:.7} }
        @keyframes diceRoll {
          0%   { transform: rotate(0deg)   scale(1)    }
          25%  { transform: rotate(-20deg) scale(1.15) }
          50%  { transform: rotate(20deg)  scale(1.1)  }
          75%  { transform: rotate(-10deg) scale(1.05) }
          100% { transform: rotate(0deg)   scale(1)    }
        }
        @keyframes sixPop {
          0%,100% { transform: scale(1) }
          40%     { transform: scale(1.06) }
        }
        .lg-toast {
          position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
          background: rgba(20,20,30,0.92); color: #fff;
          border: 1px solid rgba(255,255,255,0.18); border-radius: 24px;
          padding: 10px 22px; font-size: 15px; font-weight: 600;
          white-space: nowrap; z-index: 9999;
          animation: lgToastIn 0.22s ease;
          backdrop-filter: blur(8px);
          box-shadow: 0 4px 24px rgba(0,0,0,0.5);
          pointer-events: none;
        }
        @keyframes lgToastIn { from { opacity:0; transform:translateX(-50%) translateY(12px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
      `}</style>

      <div className="lg">
        {toast && <div className="lg-toast">{toast}</div>}

        {/* ── Top bar ── */}
        <div className="lg-bar">
          <a href="/" style={{color:'rgba(255,255,255,0.5)',fontSize:13,textDecoration:'none',fontWeight:600,flexShrink:0}}>
            ← Home
          </a>
          <span style={{fontWeight:900,fontSize:17,letterSpacing:5,color:'#FFD700'}}>LUDO</span>

          {isPlaying && (
            <span className="lg-badge" style={{
              background: isMyTurn ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.08)',
              color: isMyTurn ? '#FFD700' : 'rgba(255,255,255,0.6)',
              border:`1px solid ${isMyTurn?'rgba(255,215,0,0.4)':'rgba(255,255,255,0.15)'}`,
            }}>
              {isMyTurn
                ? (gotExtraTurn ? '🔥 Extra turn!' : '🎯 Your turn')
                : `${curPlayer?.name ?? '…'}'s turn`}
            </span>
          )}

          <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontFamily:'monospace',fontSize:16,fontWeight:800,letterSpacing:4,color:'rgba(255,255,255,0.75)'}}>{code}</span>
            <button onClick={() => {
              navigator.clipboard.writeText(window.location.href)
                .then(() => { setCopied(true); setTimeout(()=>setCopied(false),2000); });
            }} style={{
              background:copied?'#388e3c':'rgba(255,255,255,0.1)',
              border:'1px solid rgba(255,255,255,0.2)',borderRadius:8,
              padding:'5px 11px',color:'#fff',fontSize:12,cursor:'pointer',fontWeight:600,transition:'background .2s',
            }}>{copied ? '✓ Copied' : '🔗 Share'}</button>
            {/* Mobile chat FAB */}
            <button className="lg-chat-fab" onClick={() => setChatOpen(v=>!v)} style={{
              background:'rgba(255,255,255,0.12)',border:'1px solid rgba(255,255,255,0.2)',
              borderRadius:20,padding:'5px 12px',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',
            }}>💬</button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="lg-body">

          {/* ── Left panel (desktop): player list ── */}
          <div className="lg-side lg-side-l" style={{display:'none'}}>
            <style>{`@media(min-width:840px){.lg-side-l{display:flex!important;}}`}</style>
            <div style={{padding:'12px 14px',overflowY:'auto',flex:1}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:2,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',marginBottom:10}}>
                Players {state.players.filter(p=>!p.isBot).length}/{maxP}
              </div>
              {state.players.map((p,i) => {
                const isTurn = isPlaying && state.turn === i;
                return (
                  <div key={p.color} style={{
                    display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:10,marginBottom:4,
                    background:isTurn?`${C[p.color].zone}30`:'transparent',
                    border:`1px solid ${isTurn?C[p.color].mid+'55':'transparent'}`,
                    transition:'all .3s',
                  }}>
                    <div style={{
                      width:32,height:32,borderRadius:'50%',flexShrink:0,
                      background:`radial-gradient(circle at 35% 30%, ${C[p.color].bright}, ${C[p.color].zone})`,
                      border:`2px solid ${isTurn?'#FFD700':C[p.color].mid}`,
                      display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,
                    }}>{p.isBot?'🤖':'👤'}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:isTurn?'#FFD700':'#fff'}}>
                        {p.name}
                        {p.playerId===playerId&&<span style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginLeft:4}}>(you)</span>}
                        {p.isBot&&<span style={{fontSize:10,color:'rgba(255,255,255,0.35)',marginLeft:4}}>bot</span>}
                      </div>
                      <div style={{display:'flex',gap:3,marginTop:3}}>
                        {p.tokens.map((t,ti)=>(
                          <div key={ti} style={{
                            width:7,height:7,borderRadius:'50%',
                            background:t.pos===58?C[p.color].mid:t.pos===-1?'rgba(255,255,255,0.2)':C[p.color].bright,
                            border:`1.5px solid ${C[p.color].mid}`,
                          }}/>
                        ))}
                      </div>
                    </div>
                    {isTurn && <span style={{fontSize:12,color:'#FFD700'}}>▶</span>}
                    {p.rank!==null && <span style={{fontSize:13}}>{p.rank===1?'🥇':p.rank===2?'🥈':p.rank===3?'🥉':`#${p.rank}`}</span>}
                  </div>
                );
              })}
              {isWaiting && Array.from({length:maxP-state.players.length}).map((_,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',opacity:.4}}>
                  <div style={{width:32,height:32,borderRadius:'50%',background:'rgba(255,255,255,0.1)',border:'2px solid rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>?</div>
                  <span style={{fontSize:12,color:'rgba(255,255,255,0.45)'}}>Waiting for player…</span>
                </div>
              ))}

              {/* Lobby controls (desktop) */}
              {isWaiting && myPlayer && (
                <div style={{marginTop:12}}>
                  <p style={{fontSize:12,color:'rgba(255,255,255,0.5)',lineHeight:1.5,marginBottom:10}}>
                    Share the code with friends. Empty spots become bots when you start.
                  </p>
                  <button onClick={doStart} disabled={busy} style={{
                    width:'100%',border:'none',borderRadius:10,padding:'12px',color:'#fff',
                    fontSize:14,fontWeight:700,cursor:'pointer',
                    background:'linear-gradient(135deg,#43a047,#1b5e20)',
                    boxShadow:'0 4px 15px rgba(67,160,71,0.35)',
                    opacity:busy?.5:1,transition:'all .2s',
                  }}>{busy?'Starting…':`▶ Start (${maxP} players)`}</button>
                </div>
              )}
              {isWaiting && !myPlayer && (
                <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:8}}>
                  <p style={{fontSize:12,color:'rgba(255,255,255,0.6)',lineHeight:1.5}}>Enter your name to join.</p>
                  <input type="text" maxLength={30} placeholder="Your name"
                    value={joinName} onChange={e=>{setJoinName(e.target.value);setJoinErr('');}}
                    onKeyDown={e=>e.key==='Enter'&&doJoin()}
                    style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:8,padding:'10px 12px',color:'#fff',fontSize:13,outline:'none'}}/>
                  {joinErr && <p style={{fontSize:12,color:'#ef9a9a'}}>{joinErr}</p>}
                  <button onClick={()=>doJoin()} disabled={joining} style={{
                    border:'none',borderRadius:10,padding:'11px',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer',
                    background:'linear-gradient(135deg,#43a047,#1b5e20)',opacity:joining?.5:1,
                  }}>{joining?'Joining…':'→ Join game'}</button>
                </div>
              )}
            </div>
          </div>

          {/* ── Center: player rows + board + controls ── */}
          <div className="lg-center">

            {/* Top player portraits: green (tl) + yellow (tr) */}
            <div className="lg-prow">
              <PlayerPortrait color="green" player={playerOf('green')}
                isTurn={isPlaying && state.players[state.turn]?.color==='green'}
                isMe={playerOf('green')?.playerId===playerId}/>
              <PlayerPortrait color="yellow" player={playerOf('yellow')}
                isTurn={isPlaying && state.players[state.turn]?.color==='yellow'}
                isMe={playerOf('yellow')?.playerId===playerId}/>
            </div>

            {/* Board */}
            <div className="lg-boardwrap">
              <svg className="lg-board" viewBox="0 0 600 600">
                <Defs/>
                <BoardBg/>
                {tokenEls}
              </svg>
            </div>

            {/* Bottom player portraits: blue (bl) + red (br) */}
            <div className="lg-prow">
              <PlayerPortrait color="blue" player={playerOf('blue')}
                isTurn={isPlaying && state.players[state.turn]?.color==='blue'}
                isMe={playerOf('blue')?.playerId===playerId}/>
              <PlayerPortrait color="red" player={playerOf('red')}
                isTurn={isPlaying && state.players[state.turn]?.color==='red'}
                isMe={playerOf('red')?.playerId===playerId}/>
            </div>

            {/* ── Controls strip ── */}
            <div className="lg-controls">

              {/* Dice face (always visible during/after play) */}
              {(isPlaying || isFinished) && (
                <div style={{flexShrink:0}}>
                  <DiceFace
                    value={isPlaying ? diceVal : null}
                    size={56}
                    rolling={rolling}
                  />
                </div>
              )}

              {/* Roll button */}
              {isPlaying && myPlayer && (
                <button
                  className={`lg-roll ${canRoll ? (gotExtraTurn ? 'lg-roll-six' : 'lg-roll-on') : 'lg-roll-off'}`}
                  onClick={doRoll}
                  disabled={!canRoll}
                  aria-busy={rolling}
                >
                  {rollLabel}
                </button>
              )}

              {/* Spectator label */}
              {isPlaying && !myPlayer && (
                <div style={{flex:1,textAlign:'center',fontSize:12,color:'rgba(255,255,255,0.45)'}}>
                  👁 Watching as spectator
                </div>
              )}

              {/* Waiting: start button (mobile) */}
              {isWaiting && myPlayer && (
                <button onClick={doStart} disabled={busy}
                  className={`lg-roll ${busy?'lg-roll-off':'lg-roll-on'}`}
                  style={{background:'linear-gradient(135deg,#43a047,#1b5e20)',boxShadow:'0 4px 15px rgba(67,160,71,0.35)'}}>
                  {busy ? 'Starting…' : `▶ Start (${maxP}P)`}
                </button>
              )}

              {/* Waiting: join button if not yet joined */}
              {isWaiting && !myPlayer && (
                <button onClick={()=>doJoin()} disabled={joining}
                  className={`lg-roll ${joining?'lg-roll-off':'lg-roll-on'}`}
                  style={{background:'linear-gradient(135deg,#43a047,#1b5e20)'}}>
                  {joining ? 'Joining…' : '→ Join'}
                </button>
              )}

              {/* Game over label */}
              {isFinished && (
                <div style={{flex:1,textAlign:'center',fontSize:14,fontWeight:800,color:'#FFD700'}}>🏆 Game Over!</div>
              )}

              {/* Chat FAB */}
              <button className="lg-chat-fab" onClick={()=>setChatOpen(v=>!v)} style={{
                background:'rgba(255,255,255,0.12)',border:'1px solid rgba(255,255,255,0.2)',
                borderRadius:'50%',width:44,height:44,cursor:'pointer',fontSize:20,
                flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',
              }}>💬</button>
            </div>

            {/* Mobile join name input (shown when not joined and waiting) */}
            {isWaiting && !myPlayer && (
              <div style={{padding:'8px 12px',background:'rgba(0,0,0,0.3)',borderTop:'1px solid rgba(255,255,255,0.07)'}}>
                <div style={{display:'flex',gap:8}}>
                  <input type="text" maxLength={30} placeholder="Your name to join"
                    value={joinName} onChange={e=>{setJoinName(e.target.value);setJoinErr('');}}
                    onKeyDown={e=>e.key==='Enter'&&doJoin()}
                    style={{
                      flex:1,background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.2)',
                      borderRadius:8,padding:'9px 12px',color:'#fff',fontSize:13,outline:'none',
                    }}/>
                </div>
                {joinErr && <p style={{fontSize:12,color:'#ef9a9a',marginTop:5}}>{joinErr}</p>}
              </div>
            )}

            {/* Errors */}
            {error && (
              <div style={{
                margin:'0 10px 6px',fontSize:12,color:'#ef9a9a',
                padding:'8px 12px',background:'rgba(229,57,53,0.12)',
                borderRadius:8,border:'1px solid rgba(229,57,53,0.3)',
              }}>{error}</div>
            )}

            {/* Game over results */}
            {isFinished && (
              <div style={{
                margin:'6px 10px 10px',padding:'14px 16px',
                background:'rgba(0,0,0,0.55)',border:'1px solid rgba(255,215,0,0.25)',
                borderRadius:16,textAlign:'center',
              }}>
                {ranked.map(p => (
                  <div key={p.color} style={{
                    display:'flex',alignItems:'center',gap:10,padding:'7px 12px',borderRadius:8,marginBottom:4,
                    fontWeight:p.rank===1?700:400,
                    background:p.rank===1?'rgba(255,215,0,0.12)':'transparent',
                  }}>
                    <span style={{width:26,textAlign:'center',fontSize:15}}>
                      {p.rank===1?'🥇':p.rank===2?'🥈':p.rank===3?'🥉':`#${p.rank}`}
                    </span>
                    <div style={{width:12,height:12,borderRadius:'50%',background:C[p.color].mid,border:'2px solid white'}}/>
                    <span style={{fontSize:13}}>{p.name}</span>
                    {p.playerId===playerId&&<span style={{fontSize:10,color:'rgba(255,255,255,0.5)'}}>(you)</span>}
                  </div>
                ))}
                <a href="/" style={{
                  display:'block',marginTop:10,background:'rgba(255,255,255,0.12)',
                  borderRadius:10,padding:'10px',color:'#fff',fontSize:13,
                  fontWeight:700,textDecoration:'none',border:'1px solid rgba(255,255,255,0.2)',
                }}>Play again →</a>
              </div>
            )}
          </div>

          {/* ── Right panel (desktop): chat ── */}
          <div className="lg-side lg-side-r" style={{display:'none'}}>
            <style>{`@media(min-width:840px){.lg-side-r{display:flex!important;}}`}</style>
            <div style={{padding:'12px 14px 0',fontSize:11,fontWeight:700,letterSpacing:2,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',borderBottom:'1px solid rgba(255,255,255,0.08)',paddingBottom:8}}>
              💬 Chat
            </div>
            <div style={{flex:1,minHeight:0}}>
              <ChatPanel code={code} playerId={playerId} myName={myPlayer?.name ?? null}/>
            </div>
          </div>
        </div>

        {/* ── Mobile chat sheet ── */}
        {chatOpen && (
          <div className="lg-sheet">
            <div className="lg-sheet-bg" onClick={()=>setChatOpen(false)}/>
            <div className="lg-sheet-panel">
              <div className="lg-sheet-handle"/>
              <div className="lg-sheet-title">💬 Chat</div>
              <div style={{flex:1,minHeight:0}}>
                <ChatPanel code={code} playerId={playerId} myName={myPlayer?.name ?? null}/>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
