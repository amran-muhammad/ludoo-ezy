import React, {useCallback, useEffect, useRef, useState} from 'react';
import type {Color, GameState, Token} from '../lib/ludo';
import {
  COLOR_OFFSET, COLORS, HOME_BASE, HOME_COLS, MAIN_PATH,
  SAFE_ABS, movableTokens,
} from '../lib/ludo';

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  red:    {zone:'#c62828', path:'#ef9a9a', home:'#ff5252', token:'#e53935', pip:'#ffcdd2', text:'#ffcdd2'},
  green:  {zone:'#2e7d32', path:'#a5d6a7', home:'#69f0ae', token:'#43a047', pip:'#c8e6c9', text:'#c8e6c9'},
  yellow: {zone:'#e65100', path:'#ffe082', home:'#ffd740', token:'#f9a825', pip:'#fff9c4', text:'#fff9c4'},
  blue:   {zone:'#1565c0', path:'#90caf9', home:'#40c4ff', token:'#1e88e5', pip:'#bbdefb', text:'#bbdefb'},
} as const;

const CELL = 40; // px — 15 cells × 40 = 600px board
const R = {
  token: 13,   // token outer radius
  inner: 8,    // token inner highlight radius
  slot: 11,    // home base slot circle radius
  star: 5,     // star dot radius
};

// ── Board geometry helpers ───────────────────────────────────────────────────

function cx(col: number) { return col * CELL + CELL / 2; }
function cy(row: number) { return row * CELL + CELL / 2; }

function absIdx(color: Color, relPos: number): number {
  return (relPos + COLOR_OFFSET[color]) % 52;
}

function tokenSVGPos(color: Color, pos: number, slotIdx: number): [number, number] | null {
  if (pos === 58) return null;
  if (pos === -1) {
    const s = HOME_BASE[color][slotIdx];
    return s ? [cx(s[1]), cy(s[0])] : null;
  }
  if (pos >= 52 && pos <= 57) {
    const h = HOME_COLS[color][pos - 52];
    return h ? [cx(h[1]), cy(h[0])] : null;
  }
  if (pos >= 0 && pos <= 51) {
    const abs = absIdx(color, pos);
    const m = MAIN_PATH[abs];
    return m ? [cx(m[1]), cy(m[0])] : null;
  }
  return null;
}

// ── Static board drawing ─────────────────────────────────────────────────────

function BoardBg() {
  const quadrants: Array<{color: Color; row: number; col: number}> = [
    {color: 'green',  row: 0,  col: 0},
    {color: 'yellow', row: 0,  col: 9},
    {color: 'blue',   row: 9,  col: 0},
    {color: 'red',    row: 9,  col: 9},
  ];

  return (
    <>
      {/* Base board */}
      <rect width={600} height={600} fill="#fafafa" />

      {/* Colored quadrants */}
      {quadrants.map(q => (
        <g key={q.color}>
          <rect
            x={q.col * CELL} y={q.row * CELL}
            width={6 * CELL} height={6 * CELL}
            fill={C[q.color].zone}
          />
          {/* Inner white rounded yard */}
          <rect
            x={q.col * CELL + CELL} y={q.row * CELL + CELL}
            width={4 * CELL} height={4 * CELL}
            rx={8} fill="white" fillOpacity={0.12}
          />
          {/* Slot circles (for home base tokens) */}
          {HOME_BASE[q.color].map(([r, cl], i) => (
            <circle key={i} cx={cx(cl)} cy={cy(r)} r={R.slot}
              fill="white" fillOpacity={0.25} stroke="white" strokeOpacity={0.5} strokeWidth={1.5} />
          ))}
        </g>
      ))}

      {/* Path squares (the 52 main squares) */}
      {MAIN_PATH.map(([r, cl], i) => {
        const isSafe = SAFE_ABS.has(i);
        // Determine color of this cell if it's an entry or home-stretch cell
        const entryColor = Object.entries(COLOR_OFFSET).find(([, off]) => off === i)?.[0] as Color | undefined;
        return (
          <g key={i}>
            <rect x={cl * CELL} y={r * CELL} width={CELL} height={CELL}
              fill={entryColor ? C[entryColor].path : '#f5f5f5'}
              stroke="#e0e0e0" strokeWidth={0.5}
            />
            {isSafe && !entryColor && (
              <polygon
                points={`${cx(cl)},${cy(r) - R.star} ${cx(cl) + R.star * 0.588},${cy(r) - R.star * 0.809} ${cx(cl) + R.star * 0.951},${cy(r) - R.star * 0.309} ${cx(cl) + R.star * 0.588},${cy(r) + R.star * 0.309} ${cx(cl) + R.star * 0.951},${cy(r) + R.star * 0.809} ${cx(cl)},${cy(r) + R.star} ${cx(cl) - R.star * 0.951},${cy(r) + R.star * 0.809} ${cx(cl) - R.star * 0.588},${cy(r) + R.star * 0.309} ${cx(cl) - R.star * 0.951},${cy(r) - R.star * 0.309} ${cx(cl) - R.star * 0.588},${cy(r) - R.star * 0.809}`}
                fill="#bdbdbd" opacity={0.6}
              />
            )}
          </g>
        );
      })}

      {/* Home columns */}
      {COLORS.map(color =>
        HOME_COLS[color].map(([r, cl], i) => (
          <rect key={`${color}-${i}`}
            x={cl * CELL} y={r * CELL} width={CELL} height={CELL}
            fill={C[color].path} stroke="#e0e0e0" strokeWidth={0.5}
          />
        ))
      )}

      {/* Center finish triangles */}
      {([
        ['green',  `${cx(6)},${cy(6)} ${cx(8)+CELL/2},${cy(6)} ${cx(7)},${cy(7)}`],
        ['yellow', `${cx(8)+CELL/2},${cy(6)} ${cx(8)+CELL/2},${cy(8)+CELL/2} ${cx(7)},${cy(7)}`],
        ['blue',   `${cx(6)},${cy(8)+CELL/2} ${cx(7)},${cy(7)} ${cx(8)+CELL/2},${cy(8)+CELL/2}`],
        ['red',    `${cx(6)},${cy(6)} ${cx(7)},${cy(7)} ${cx(6)},${cy(8)+CELL/2}`],
      ] as [Color, string][]).map(([color, pts]) => (
        <polygon key={color} points={pts} fill={C[color].token} opacity={0.85} />
      ))}

      {/* Center hexagon */}
      <circle cx={cx(7)} cy={cy(7)} r={CELL * 0.8} fill="white" />
      <circle cx={cx(7)} cy={cy(7)} r={CELL * 0.55} fill="#9e9e9e" opacity={0.3} />

      {/* Grid lines */}
      {Array.from({length: 16}).map((_, i) => (
        <React.Fragment key={i}>
          <line x1={i * CELL} y1={0} x2={i * CELL} y2={600} stroke="#bdbdbd" strokeWidth={0.5} />
          <line x1={0} y1={i * CELL} x2={600} y2={i * CELL} stroke="#bdbdbd" strokeWidth={0.5} />
        </React.Fragment>
      ))}

      {/* Board border */}
      <rect width={600} height={600} fill="none" stroke="#5d4037" strokeWidth={3} />
    </>
  );
}

// ── Dice component ────────────────────────────────────────────────────────────

const PIP_POSITIONS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.22], [0.72, 0.22], [0.28, 0.5], [0.72, 0.5], [0.28, 0.78], [0.72, 0.78]],
};

function Dice({value, rolling}: {value: number | null; rolling: boolean}) {
  const SIZE = 72;
  return (
    <svg width={SIZE} height={SIZE} viewBox="0 0 72 72"
      style={{filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))', transition: 'transform 0.15s'}}
      className={rolling ? 'animate-spin' : ''}
    >
      <rect width={72} height={72} rx={12} fill="#fafafa" stroke="#e0e0e0" strokeWidth={2} />
      {value !== null && (PIP_POSITIONS[value] ?? []).map(([px, py], i) => (
        <circle key={i} cx={px * 72} cy={py * 72} r={5} fill="#212121" />
      ))}
      {value === null && (
        <text x={36} y={42} textAnchor="middle" fontSize={24} fill="#bdbdbd">?</text>
      )}
    </svg>
  );
}

// ── Token SVG element ─────────────────────────────────────────────────────────

function TokenCircle({
  x, y, color, movable, onMove, label,
}: {
  x: number; y: number; color: Color;
  movable: boolean; onMove: () => void; label: string;
}) {
  return (
    <g
      onClick={movable ? onMove : undefined}
      style={{cursor: movable ? 'pointer' : 'default'}}
      role={movable ? 'button' : undefined}
      aria-label={label}
    >
      {movable && (
        <circle cx={x} cy={y} r={R.token + 5} fill="rgba(255,235,59,0.35)"
          style={{animation: 'pulse 1.2s ease-in-out infinite'}} />
      )}
      {/* Shadow */}
      <circle cx={x + 1} cy={y + 2} r={R.token} fill="rgba(0,0,0,0.35)" />
      {/* Outer */}
      <circle cx={x} cy={y} r={R.token} fill={C[color].token}
        stroke={movable ? '#FFD700' : 'white'} strokeWidth={movable ? 2.5 : 1.5} />
      {/* Inner highlight */}
      <circle cx={x - 3} cy={y - 3} r={R.inner} fill={C[color].home} opacity={0.65} />
      <circle cx={x - 5} cy={y - 5} r={4} fill="white" opacity={0.4} />
    </g>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getOrCreatePlayerId(): string {
  try {
    let id = localStorage.getItem('ludo_player_id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('ludo_player_id', id); }
    return id;
  } catch { return crypto.randomUUID(); }
}

async function apiPost<T>(path: string, body: object): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  return res.json() as Promise<T>;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path);
  return res.json() as Promise<T>;
}

// Offset stacked tokens so they don't all overlap.
const STACK_OFFSETS: [number, number][] = [[0,0],[-6,-6],[6,-6],[0,8]];

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  room: {code: string; status: string; state: GameState};
}

export default function LudoGame({room: initialRoom}: Props) {
  const playerId = getOrCreatePlayerId();
  const [state, setState] = useState<GameState>(initialRoom.state);
  const [roomStatus, setRoomStatus] = useState(initialRoom.status);
  const [busy, setBusy] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const code = initialRoom.code;

  const myPlayer = state.players.find(p => p.playerId === playerId) ?? null;
  const myColor = myPlayer?.color ?? null;
  const isMyTurn = myPlayer !== null && state.players[state.turn]?.color === myColor;
  const currentPlayer = state.players[state.turn];

  const movable = (isMyTurn && state.diceRolled && state.dice !== null)
    ? movableTokens(myPlayer!, state.dice)
    : [];

  // ── Polling ──
  const fetchState = useCallback(async () => {
    const data = await apiGet<{room: {state: GameState; status: string}}>(`/site-api/ludo/rooms/${code}`);
    if (data?.room) { setState(data.room.state); setRoomStatus(data.room.status); }
  }, [code]);

  useEffect(() => {
    const shouldPoll = roomStatus !== 'finished' && (!isMyTurn || roomStatus === 'waiting' || (isMyTurn && !state.diceRolled));
    if (shouldPoll) { pollRef.current = setInterval(fetchState, 2000); }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isMyTurn, roomStatus, fetchState, state.diceRolled]);

  // ── Actions ──
  async function doStart() {
    setBusy(true); setError('');
    const d = await apiPost<{ok?: boolean; message?: string}>(`/site-api/ludo/rooms/${code}/start`, {playerId});
    if (d.ok) await fetchState(); else setError(d.message ?? 'Error starting.');
    setBusy(false);
  }

  async function doRoll() {
    if (!isMyTurn || state.diceRolled || busy) return;
    setBusy(true); setRolling(true); setError('');
    const d = await apiPost<{state?: GameState; message?: string}>(`/site-api/ludo/rooms/${code}/roll`, {playerId});
    setRolling(false);
    if (d.state) setState(d.state); else setError(d.message ?? 'Error rolling.');
    setBusy(false);
  }

  async function doMove(tokenId: number) {
    if (!isMyTurn || !state.diceRolled || busy) return;
    setBusy(true); setError('');
    const d = await apiPost<{state?: GameState; message?: string}>(`/site-api/ludo/rooms/${code}/move`, {playerId, tokenId});
    if (d.state) setState(d.state); else setError(d.message ?? 'Error moving.');
    setBusy(false);
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Render tokens ──
  const tokenElements: React.ReactElement[] = [];
  // Track positions for stacking
  const posMap = new Map<string, number>(); // key → count at that pixel position

  for (const player of state.players) {
    const atHome = player.tokens.filter(t => t.pos === -1);
    let homeIdx = 0;

    for (const token of player.tokens) {
      const isMovable = movable.includes(token.id) && player.color === myColor;
      let svgX: number, svgY: number;

      if (token.pos === -1) {
        const slot = HOME_BASE[player.color][homeIdx++];
        if (!slot) continue;
        svgX = cx(slot[1]); svgY = cy(slot[0]);
      } else if (token.pos === 58) {
        continue; // finished — don't render
      } else if (token.pos >= 52 && token.pos <= 57) {
        const h = HOME_COLS[player.color][token.pos - 52];
        if (!h) continue;
        svgX = cx(h[1]); svgY = cy(h[0]);
      } else {
        const abs = absIdx(player.color, token.pos);
        const m = MAIN_PATH[abs];
        if (!m) continue;
        svgX = cx(m[1]); svgY = cy(m[0]);
      }

      // Offset stacked tokens
      const key = `${Math.round(svgX)},${Math.round(svgY)}`;
      const stackIdx = posMap.get(key) ?? 0;
      posMap.set(key, stackIdx + 1);
      const [ox, oy] = STACK_OFFSETS[stackIdx % 4];

      tokenElements.push(
        <TokenCircle
          key={`${player.color}-${token.id}`}
          x={svgX + ox} y={svgY + oy}
          color={player.color}
          movable={isMovable}
          onMove={() => doMove(token.id)}
          label={`${player.color} token ${token.id + 1}${isMovable ? ', click to move' : ''}`}
        />
      );
    }
  }

  const isWaiting = state.status === 'waiting';
  const isPlaying = state.status === 'playing';
  const isFinished = state.status === 'finished';
  const ranked = [...state.players].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      color: 'white',
      fontFamily: 'inherit',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '12px 24px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(4px)',
      }}>
        <a href="/" style={{color: 'rgba(255,255,255,0.6)', fontSize: 13, textDecoration: 'none'}}>
          ← Back
        </a>
        <span style={{fontWeight: 700, fontSize: 16, letterSpacing: 2, color: '#FFD700'}}>LUDO</span>
        <div style={{marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12}}>
          <span style={{fontFamily: 'monospace', fontSize: 18, fontWeight: 700, letterSpacing: 4, color: 'white'}}>
            {code}
          </span>
          <button onClick={copyLink} style={{
            background: copied ? '#43a047' : 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: 6, padding: '4px 12px', color: 'white',
            fontSize: 12, cursor: 'pointer', transition: 'background 0.2s',
          }}>
            {copied ? '✓ Copied!' : 'Share link'}
          </button>
        </div>
      </div>

      {/* Main game area */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 24, padding: '24px 16px',
      }}>
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 24,
          justifyContent: 'center', alignItems: 'flex-start', width: '100%', maxWidth: 940,
        }}>
          {/* ── Board ── */}
          <div style={{
            borderRadius: 16, overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 6px #5d4037, 0 0 0 8px #3e2723',
            flexShrink: 0,
          }}>
            <svg
              width="100%"
              viewBox="0 0 600 600"
              style={{display: 'block', maxWidth: 520, width: '100%'}}
            >
              <style>{`
                @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.9} }
              `}</style>
              <BoardBg />
              {tokenElements}
            </svg>
          </div>

          {/* ── Side panel ── */}
          <div style={{display: 'flex', flexDirection: 'column', gap: 12, width: 240, flexShrink: 0}}>

            {/* Players */}
            <div style={{
              background: 'rgba(255,255,255,0.07)', borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.12)', padding: '14px 16px',
            }}>
              <p style={{fontSize: 10, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.5)', marginBottom: 10, textTransform: 'uppercase'}}>
                Players
              </p>
              {state.players.map((p, i) => {
                const isTurn = isPlaying && state.turn === i && !isFinished;
                return (
                  <div key={p.color} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 8, marginBottom: 4,
                    background: isTurn ? `${C[p.color].zone}30` : 'transparent',
                    border: isTurn ? `1px solid ${C[p.color].token}60` : '1px solid transparent',
                    transition: 'all 0.3s',
                  }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: C[p.color].token,
                      border: '2px solid white',
                      boxShadow: `0 0 6px ${C[p.color].token}`,
                      flexShrink: 0,
                    }} />
                    <div style={{flex: 1, minWidth: 0}}>
                      <div style={{fontSize: 13, fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                        {p.name}
                        {p.playerId === playerId && <span style={{fontSize: 10, color: 'rgba(255,255,255,0.5)', marginLeft: 4}}>(you)</span>}
                        {p.isBot && <span style={{fontSize: 10, color: 'rgba(255,255,255,0.4)', marginLeft: 4}}>bot</span>}
                      </div>
                      {/* Token progress dots */}
                      <div style={{display: 'flex', gap: 3, marginTop: 3}}>
                        {p.tokens.map(t => (
                          <div key={t.id} style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: t.pos === 58 ? C[p.color].token : t.pos === -1 ? 'rgba(255,255,255,0.2)' : C[p.color].home,
                            border: `1px solid ${C[p.color].token}`,
                          }} />
                        ))}
                      </div>
                    </div>
                    {isTurn && <span style={{fontSize: 14}}>▶</span>}
                    {p.rank !== null && (
                      <span style={{fontSize: 12, fontWeight: 700, color: p.rank === 1 ? '#FFD700' : 'rgba(255,255,255,0.6)'}}>
                        #{p.rank}
                      </span>
                    )}
                  </div>
                );
              })}
              {isWaiting && state.players.length < 4 && (
                <p style={{fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8, textAlign: 'center'}}>
                  Waiting for {4 - state.players.length} more…
                </p>
              )}
            </div>

            {/* Action area */}
            {isWaiting && myPlayer && (
              <div style={{
                background: 'rgba(255,255,255,0.07)', borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.12)', padding: 16,
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <p style={{fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 1.4}}>
                  Share the link with friends, or start now with bots.
                </p>
                <button onClick={doStart} disabled={busy} style={{
                  background: 'linear-gradient(135deg, #43a047, #1b5e20)',
                  border: 'none', borderRadius: 10, padding: '12px 20px',
                  color: 'white', fontSize: 15, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.6 : 1, boxShadow: '0 4px 15px rgba(67,160,71,0.4)',
                  transition: 'all 0.2s',
                }}>
                  {busy ? 'Starting…' : '▶ Start game'}
                </button>
              </div>
            )}

            {isWaiting && !myPlayer && (
              <p style={{fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: 16}}>
                Spectating · <a href="/" style={{color: '#90caf9'}}>Start your own game</a>
              </p>
            )}

            {isPlaying && (
              <div style={{
                background: 'rgba(255,255,255,0.07)', borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.12)', padding: 16,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              }}>
                {isMyTurn ? (
                  <>
                    <p style={{fontSize: 13, fontWeight: 600, color: '#FFD700'}}>Your turn!</p>
                    <Dice value={state.dice} rolling={rolling} />
                    {!state.diceRolled ? (
                      <button onClick={doRoll} disabled={busy} style={{
                        background: 'linear-gradient(135deg, #e53935, #b71c1c)',
                        border: 'none', borderRadius: 10, padding: '12px 32px',
                        color: 'white', fontSize: 16, fontWeight: 700,
                        cursor: busy ? 'not-allowed' : 'pointer',
                        opacity: busy ? 0.6 : 1,
                        boxShadow: '0 4px 20px rgba(229,57,53,0.5)',
                        transition: 'all 0.2s', width: '100%',
                      }}>
                        🎲 Roll dice
                      </button>
                    ) : movable.length > 0 ? (
                      <p style={{fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'center'}}>
                        Click a glowing token to move it.
                      </p>
                    ) : (
                      <p style={{fontSize: 12, color: 'rgba(255,255,255,0.5)', textAlign: 'center'}}>
                        No valid moves — turn passes.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p style={{fontSize: 12, color: 'rgba(255,255,255,0.5)'}}>
                      {currentPlayer?.isBot ? `${currentPlayer.name} is thinking…` : `${currentPlayer?.name}'s turn`}
                    </p>
                    <Dice value={state.diceRolled ? state.dice : null} rolling={false} />
                    <p style={{fontSize: 11, color: 'rgba(255,255,255,0.3)'}}>Polling for updates…</p>
                  </>
                )}
              </div>
            )}

            {isFinished && (
              <div style={{
                background: 'rgba(255,215,0,0.08)', borderRadius: 12,
                border: '1px solid rgba(255,215,0,0.3)', padding: 16,
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <p style={{textAlign: 'center', fontSize: 18, fontWeight: 700, color: '#FFD700'}}>
                  🏆 Game over!
                </p>
                {ranked.map(p => (
                  <div key={p.color} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontWeight: p.rank === 1 ? 700 : 400,
                    opacity: p.rank === 1 ? 1 : 0.7,
                  }}>
                    <span style={{width: 22, textAlign: 'right', fontSize: 12, color: 'rgba(255,255,255,0.5)'}}>#{p.rank}</span>
                    <div style={{width: 12, height: 12, borderRadius: '50%', background: C[p.color].token, border: '1px solid white'}} />
                    <span style={{fontSize: 13, color: 'white'}}>{p.name}</span>
                  </div>
                ))}
                <a href="/" style={{
                  display: 'block', textAlign: 'center', marginTop: 4,
                  background: 'rgba(255,255,255,0.15)', borderRadius: 8,
                  padding: '10px 0', color: 'white', fontSize: 13, fontWeight: 600,
                  textDecoration: 'none', border: '1px solid rgba(255,255,255,0.2)',
                }}>
                  Play again
                </a>
              </div>
            )}

            {error && (
              <p style={{
                fontSize: 12, color: '#ef9a9a', padding: '10px 14px',
                background: 'rgba(229,57,53,0.15)', borderRadius: 8,
                border: '1px solid rgba(229,57,53,0.3)',
              }}>
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
