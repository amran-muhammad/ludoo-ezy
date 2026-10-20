import React, {useCallback, useEffect, useRef, useState} from 'react';
import type {Color, GameState, Token} from '../lib/ludo';
import {COLORS, HOME_BASE, HOME_COLS, MAIN_PATH, COLOR_OFFSET, movableTokens} from '../lib/ludo';

// ── Constants ────────────────────────────────────────────────────────────────

const COLOR_CLASS: Record<Color, string> = {
  red: 'bg-red-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-400',
  blue: 'bg-blue-500',
};
const COLOR_LIGHT: Record<Color, string> = {
  red: 'bg-red-100',
  green: 'bg-green-100',
  yellow: 'bg-yellow-50',
  blue: 'bg-blue-100',
};
const COLOR_BORDER: Record<Color, string> = {
  red: 'border-red-400',
  green: 'border-green-400',
  yellow: 'border-yellow-400',
  blue: 'border-blue-400',
};
const COLOR_TEXT: Record<Color, string> = {
  red: 'text-red-600',
  green: 'text-green-600',
  yellow: 'text-yellow-600',
  blue: 'text-blue-600',
};

// Cells that are part of home columns keyed as "row,col".
const HOME_COL_CELLS = new Set<string>(
  COLORS.flatMap(c => HOME_COLS[c].map(([r, cl]) => `${r},${cl}`))
);
const HOME_COL_COLOR: Record<string, Color> = {};
for (const c of COLORS) {
  for (const [r, cl] of HOME_COLS[c]) HOME_COL_COLOR[`${r},${cl}`] = c;
}

// Safe squares (absolute main-path index).
const SAFE_ABS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Star cells (subset of safe) — shown with a star glyph.
const STAR_ABS = new Set([8, 21, 34, 47]);

// Which cells belong to each color's home base quadrant.
const QUADRANT_COLOR: Record<string, Color> = {};
const QUADRANT_ROWS: Record<Color, [number, number]> = {
  green:  [0, 5],
  yellow: [0, 5],
  red:    [9, 14],
  blue:   [9, 14],
};
const QUADRANT_COLS: Record<Color, [number, number]> = {
  green:  [0, 5],
  yellow: [9, 14],
  red:    [9, 14],
  blue:   [0, 5],
};
for (const c of COLORS) {
  const [r0, r1] = QUADRANT_ROWS[c];
  const [cl0, cl1] = QUADRANT_COLS[c];
  for (let r = r0; r <= r1; r++)
    for (let cl = cl0; cl <= cl1; cl++)
      QUADRANT_COLOR[`${r},${cl}`] = c;
}

// Entry squares keyed by absolute main-path index.
const ENTRY_COLOR: Record<number, Color> = {};
for (const c of COLORS) ENTRY_COLOR[COLOR_OFFSET[c]] = c;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getOrCreatePlayerId(): string {
  try {
    let id = localStorage.getItem('ludo_player_id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('ludo_player_id', id); }
    return id;
  } catch { return crypto.randomUUID(); }
}

async function api<T>(path: string, body?: object): Promise<T> {
  const res = await fetch(path, body ? {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  } : undefined);
  return res.json() as Promise<T>;
}

// ── Board rendering ──────────────────────────────────────────────────────────

// For each token in the game, compute its [row, col] or null if finished.
function tokenCell(color: Color, pos: number): [number, number] | null {
  if (pos === -1) return null; // rendered in home base
  if (pos <= 51) {
    const abs = (pos + COLOR_OFFSET[color]) % 52;
    return MAIN_PATH[abs] ?? null;
  }
  if (pos <= 57) return HOME_COLS[color][pos - 52] ?? null;
  return null; // finished
}

// Group tokens by cell key for stacking.
type TokenInfo = {color: Color; tokenId: number; playerId: string; pos: number};

function buildCellMap(state: GameState): Map<string, TokenInfo[]> {
  const map = new Map<string, TokenInfo[]>();
  for (const player of state.players) {
    for (const t of player.tokens) {
      const cell = tokenCell(player.color, t.pos);
      if (!cell) continue;
      const key = `${cell[0]},${cell[1]}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({color: player.color, tokenId: t.id, playerId: player.playerId, pos: t.pos});
    }
  }
  return map;
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  room: {code: string; status: string; state: GameState};
}

export default function LudoGame({room: initialRoom}: Props) {
  const playerId = getOrCreatePlayerId();
  const [state, setState] = useState<GameState>(initialRoom.state);
  const [roomStatus, setRoomStatus] = useState(initialRoom.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const code = initialRoom.code;

  // Which player am I?
  const myPlayer = state.players.find(p => p.playerId === playerId) ?? null;
  const myColor = myPlayer?.color ?? null;
  const isMyTurn = myPlayer !== null && state.players[state.turn]?.color === myColor;
  const currentPlayer = state.players[state.turn];

  // Movable token IDs for me (when dice rolled).
  const movable = (isMyTurn && state.diceRolled && state.dice !== null)
    ? movableTokens(myPlayer!, state.dice)
    : [];

  // ── Polling ──────────────────────────────────────────────────────────────
  const fetchState = useCallback(async () => {
    const data = await api<{room: {state: GameState; status: string}}>(`/site-api/ludo/rooms/${code}`);
    if (data?.room) {
      setState(data.room.state);
      setRoomStatus(data.room.status);
    }
  }, [code]);

  useEffect(() => {
    // Poll every 2 s when it's not my turn or game is waiting.
    const shouldPoll = roomStatus !== 'finished' && (!isMyTurn || roomStatus === 'waiting');
    if (shouldPoll) {
      pollRef.current = setInterval(fetchState, 2000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isMyTurn, roomStatus, fetchState]);

  // ── Actions ───────────────────────────────────────────────────────────────
  async function doStart() {
    setBusy(true); setError('');
    const data = await api<{ok?: boolean; message?: string}>(`/site-api/ludo/rooms/${code}/start`, {playerId});
    if (data.ok) await fetchState(); else setError(data.message ?? 'Error starting game.');
    setBusy(false);
  }

  async function doRoll() {
    if (!isMyTurn || state.diceRolled || busy) return;
    setBusy(true); setError('');
    const data = await api<{state?: GameState; message?: string}>(`/site-api/ludo/rooms/${code}/roll`, {playerId});
    if (data.state) setState(data.state); else setError(data.message ?? 'Error rolling.');
    setBusy(false);
  }

  async function doMove(tokenId: number) {
    if (!isMyTurn || !state.diceRolled || busy) return;
    setBusy(true); setError('');
    const data = await api<{state?: GameState; message?: string}>(`/site-api/ludo/rooms/${code}/move`, {playerId, tokenId});
    if (data.state) setState(data.state); else setError(data.message ?? 'Error moving.');
    setBusy(false);
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Board cells ────────────────────────────────────────────────────────────
  const cellMap = buildCellMap(state);

  function renderCell(row: number, col: number) {
    const key = `${row},${col}`;
    const tokens = cellMap.get(key) ?? [];
    const quadrantColor = QUADRANT_COLOR[key];
    const isHomeCol = HOME_COL_CELLS.has(key);
    const homeColColor = HOME_COL_COLOR[key];
    const isCenter = row >= 6 && row <= 8 && col >= 6 && col <= 8 && !isHomeCol;
    const mainPathIdx = MAIN_PATH.findIndex(([r, c]) => r === row && c === col);
    const isMainPath = mainPathIdx !== -1;
    const isSafe = isMainPath && SAFE_ABS.has(mainPathIdx);
    const isStar = isMainPath && STAR_ABS.has(mainPathIdx);
    const entryColor = isMainPath ? ENTRY_COLOR[mainPathIdx] : undefined;

    let cellBg = 'bg-white';
    if (quadrantColor && !isHomeCol && !isMainPath) {
      cellBg = COLOR_LIGHT[quadrantColor];
    } else if (isHomeCol && homeColColor) {
      cellBg = COLOR_LIGHT[homeColColor];
    } else if (isCenter) {
      cellBg = 'bg-white';
    }

    return (
      <div
        key={key}
        className={`relative flex items-center justify-center border border-gray-200 ${cellBg}`}
        style={{gridColumn: col + 1, gridRow: row + 1}}
      >
        {/* Safe star */}
        {isStar && <span className="absolute text-[8px] text-gray-400 pointer-events-none">★</span>}
        {/* Entry dot */}
        {entryColor && isSafe && !isStar && (
          <span className={`absolute size-3 rounded-full opacity-40 ${COLOR_CLASS[entryColor]}`} />
        )}
        {/* Home column color strip */}
        {isHomeCol && homeColColor && tokens.length === 0 && (
          <span className={`size-2.5 rounded-full opacity-50 ${COLOR_CLASS[homeColColor]}`} />
        )}
        {/* Tokens */}
        {tokens.length > 0 && (
          <div className="flex flex-wrap gap-0.5 items-center justify-center w-full h-full p-0.5">
            {tokens.map(t => {
              const isMovable = movable.includes(t.tokenId) && t.color === myColor;
              return (
                <button
                  key={`${t.color}-${t.tokenId}`}
                  onClick={() => isMovable && doMove(t.tokenId)}
                  disabled={!isMovable || busy}
                  aria-label={`${t.color} token ${t.tokenId + 1}${isMovable ? ' — click to move' : ''}`}
                  className={`size-4 rounded-full border-2 transition-transform ${COLOR_CLASS[t.color]} border-white
                    ${isMovable ? 'cursor-pointer ring-2 ring-offset-1 ring-yellow-400 scale-110 animate-pulse' : 'cursor-default'}
                    disabled:cursor-default`}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Home base tokens (not on board) ───────────────────────────────────────
  function renderHomeBase(color: Color, tokens: Token[]): (React.ReactElement | null)[] {
    const atHome = tokens.filter(t => t.pos === -1);
    const slots = HOME_BASE[color];
    return slots.map((slot, i) => {
      const token = atHome[i];
      if (!token) return null;
      const isMovable = movable.includes(token.id) && color === myColor;
      return (
        <div
          key={`home-${color}-${i}`}
          style={{gridColumn: slot[1] + 1, gridRow: slot[0] + 1}}
          className="flex items-center justify-center"
        >
          <button
            onClick={() => isMovable && doMove(token.id)}
            disabled={!isMovable || busy}
            aria-label={`${color} token ${token.id + 1} in home${isMovable ? ' — click to enter (roll was 6)' : ''}`}
            className={`size-5 rounded-full border-2 border-white ${COLOR_CLASS[color]}
              ${isMovable ? 'ring-2 ring-offset-1 ring-yellow-400 scale-110 animate-pulse cursor-pointer' : 'cursor-default'}
              disabled:cursor-default`}
          />
        </div>
      );
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const allCells: React.ReactElement[] = [];
  for (let r = 0; r < 15; r++) for (let c = 0; c < 15; c++) allCells.push(renderCell(r, c));

  const isWaiting = state.status === 'waiting';
  const isPlaying = state.status === 'playing';
  const isFinished = state.status === 'finished';

  const winner = state.players.find(p => p.rank === 1);
  const ranked = [...state.players].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 flex flex-col lg:flex-row gap-8">
      {/* ── Board ── */}
      <div className="relative w-full max-w-[min(95vw,480px)] mx-auto lg:mx-0 flex-shrink-0">
        {/* 15×15 CSS grid */}
        <div
          className="w-full aspect-square border-2 border-gray-300 rounded-lg overflow-hidden"
          style={{display: 'grid', gridTemplateColumns: 'repeat(15, 1fr)', gridTemplateRows: 'repeat(15, 1fr)'}}
        >
          {allCells}
          {/* Home base tokens overlaid on the grid */}
          <div className="absolute inset-0 pointer-events-none" style={{display: 'grid', gridTemplateColumns: 'repeat(15, 1fr)', gridTemplateRows: 'repeat(15, 1fr)'}}>
            {state.players.map(p => renderHomeBase(p.color, p.tokens))}
          </div>
        </div>

        {/* Center triangle finish area overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{display: 'grid', gridTemplateColumns: 'repeat(15, 1fr)', gridTemplateRows: 'repeat(15, 1fr)'}}>
          <div style={{gridColumn: 7, gridRow: 7, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div className="w-4 h-4 bg-green-400 clip-triangle-tl" />
          </div>
          <div style={{gridColumn: 9, gridRow: 7, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div className="w-4 h-4 bg-yellow-400 clip-triangle-tr" />
          </div>
          <div style={{gridColumn: 7, gridRow: 9, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div className="w-4 h-4 bg-blue-400 clip-triangle-bl" />
          </div>
          <div style={{gridColumn: 9, gridRow: 9, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div className="w-4 h-4 bg-red-400 clip-triangle-br" />
          </div>
        </div>
      </div>

      {/* ── Side panel ── */}
      <div className="flex flex-col gap-4 lg:w-64 flex-shrink-0">
        {/* Room code + share */}
        <div className="border rounded-lg p-4 flex flex-col gap-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Room code</p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xl font-bold tracking-widest">{code}</span>
            <button
              onClick={copyLink}
              className="ml-auto text-xs border rounded px-2 py-1 hover:bg-muted transition-colors"
              aria-label="Copy share link"
            >
              {copied ? '✓ Copied' : 'Copy link'}
            </button>
          </div>
          {isWaiting && (
            <p className="text-xs text-muted-foreground">Share this link with friends. Press Start when ready.</p>
          )}
        </div>

        {/* Players */}
        <div className="border rounded-lg p-4 flex flex-col gap-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Players</p>
          {state.players.map((p, i) => (
            <div key={p.color} className={`flex items-center gap-2 text-sm ${isPlaying && state.turn === i ? 'font-semibold' : ''}`}>
              <span className={`size-3 rounded-full flex-shrink-0 ${COLOR_CLASS[p.color]}`} />
              <span className={COLOR_TEXT[p.color]}>{p.name}</span>
              {p.isBot && <span className="text-[10px] text-muted-foreground">(bot)</span>}
              {p.playerId === playerId && <span className="text-[10px] text-muted-foreground">(you)</span>}
              {isPlaying && state.turn === i && !isFinished && <span className="ml-auto text-[10px]">▶</span>}
              {p.rank !== null && <span className="ml-auto text-[10px] font-semibold">#{p.rank}</span>}
            </div>
          ))}
          {isWaiting && state.players.length < 4 && (
            <p className="text-xs text-muted-foreground mt-1">Waiting for {4 - state.players.length} more… (or start with bots)</p>
          )}
        </div>

        {/* Actions */}
        {isWaiting && myPlayer && (
          <button
            onClick={doStart}
            disabled={busy}
            aria-busy={busy}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-3 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {busy ? 'Starting…' : 'Start game'}
          </button>
        )}

        {isWaiting && !myPlayer && (
          <div className="text-sm text-muted-foreground text-center py-2">
            Watching · <a href="/" className="underline">Start your own game</a>
          </div>
        )}

        {isPlaying && (
          <div className="border rounded-lg p-4 flex flex-col gap-3">
            {isMyTurn ? (
              <>
                <p className="text-sm font-semibold text-center">Your turn!</p>
                {!state.diceRolled ? (
                  <button
                    onClick={doRoll}
                    disabled={busy}
                    aria-busy={busy}
                    className="rounded-lg bg-primary text-primary-foreground px-4 py-3 text-xl font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {busy ? '…' : state.dice ? `🎲 ${state.dice}` : '🎲 Roll'}
                  </button>
                ) : (
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-2">🎲 {state.dice}</div>
                    {movable.length > 0
                      ? <p className="text-sm text-muted-foreground">Click a highlighted token to move it.</p>
                      : <p className="text-sm text-muted-foreground">No valid moves — turn skipped.</p>}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-center text-muted-foreground">
                {currentPlayer ? (
                  <>
                    <span className={`font-semibold ${COLOR_TEXT[currentPlayer.color]}`}>{currentPlayer.name}</span>
                    {currentPlayer.isBot ? "'s turn (thinking…)" : "'s turn"}
                  </>
                ) : 'Waiting…'}
                {state.diceRolled && state.dice && (
                  <div className="text-3xl mt-2">🎲 {state.dice}</div>
                )}
              </div>
            )}
          </div>
        )}

        {isFinished && (
          <div className="border rounded-lg p-4 flex flex-col gap-3 text-center">
            <p className="font-bold text-lg">🏆 Game over!</p>
            {ranked.map(p => (
              <div key={p.color} className={`flex items-center gap-2 text-sm ${p.rank === 1 ? 'font-bold' : ''}`}>
                <span className="w-5 text-right text-muted-foreground">#{p.rank}</span>
                <span className={`size-3 rounded-full ${COLOR_CLASS[p.color]}`} />
                <span>{p.name}</span>
              </div>
            ))}
            <a href="/" className="mt-2 rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors">
              Play again
            </a>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive border border-destructive/30 rounded-lg px-3 py-2">{error}</p>
        )}
      </div>
    </div>
  );
}
