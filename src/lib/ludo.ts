// Ludo game logic — pure functions, no I/O.
// Rules: Bangladeshi standard — need 6 to enter, bonus turn on 6, bonus turn on kill,
// 3 consecutive sixes = forfeit, blocking (2+ same-color on one square = unlandable).

export type Color = 'red' | 'green' | 'yellow' | 'blue';
export const COLORS: Color[] = ['red', 'green', 'yellow', 'blue'];

export type DiceValue = 1 | 2 | 3 | 4 | 5 | 6;

// Token position encoding:
//  -1  = home base (not yet entered)
//   0  = just entered main path (player's own entry square)
//   1-51 = on main path (relative steps from entry)
//  52-57 = home column (52 = first square, 57 = last before finish)
//  58  = finished
export type TokenPos = number;

export interface Token {
  id: number; // 0-3
  pos: TokenPos;
}

export interface Player {
  color: Color;
  name: string;
  isBot: boolean;
  playerId: string; // random UUID assigned at join; bot = ''
  tokens: Token[];
  rank: number | null; // finishing order (1 = first)
}

export interface GameState {
  players: Player[];
  turn: number; // index into players[] — whose turn
  dice: DiceValue | null;
  diceRolled: boolean;
  consecutiveSixes: number; // 3 sixes in a row = forfeit turn
  status: 'waiting' | 'playing' | 'finished';
  maxPlayers: number; // 2 | 3 | 4 — total player slots (humans + bots)
  // Last notable event, set after each roll/move for UI toasts.
  // Format: 'three_sixes' | 'no_moves' | 'cut:Name' | 'finished:Name' | 'extra_six' | 'extra_kill'
  lastEvent?: string;
  updatedAt: string; // ISO
}

// ── Board geometry ──────────────────────────────────────────────────────────

// 52-square main path as [row, col] on a 15×15 grid.
// Position 0 = Red's entry (safe), going clockwise.
// Offsets for each color: Red=0, Green=13, Yellow=26, Blue=39
export const MAIN_PATH: [number, number][] = [
  // Section 1: Red→Green (pos 0-12, Green entry at 13)
  [13,6],[12,6],[11,6],[10,6],[9,6],[8,6],[8,5],[8,4],[8,3],[8,2],[8,1],[8,0],[7,0],
  // Section 2: Green→Yellow (pos 13-25, Yellow entry at 26)
  [6,0],[6,1],[6,2],[6,3],[6,4],[6,5],[6,6],[5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
  // Section 3: Yellow→Blue (pos 26-38, Blue entry at 39)
  [0,7],[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,8],[6,9],[6,10],[6,11],[6,12],[6,13],
  // Section 4: Blue→Red (pos 39-51)
  [6,14],[7,14],[8,14],[8,13],[8,12],[8,11],[8,10],[8,9],[8,8],[9,8],[10,8],[11,8],[12,8],
];

// Home columns: 6 squares from entry toward center col/row 7.
// pos 52-57 map to index 0-5 here.
export const HOME_COLS: Record<Color, [number, number][]> = {
  red:    [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
  green:  [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  yellow: [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  blue:   [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
};

// Home base token slot positions (the colored yard where pieces start).
export const HOME_BASE: Record<Color, [number, number][]> = {
  red:    [[10,10],[10,12],[12,10],[12,12]],
  green:  [[2,2],[2,4],[4,2],[4,4]],
  yellow: [[2,10],[2,12],[4,10],[4,12]],
  blue:   [[10,2],[10,4],[12,2],[12,4]],
};

export const COLOR_OFFSET: Record<Color, number> = {
  red: 0, green: 13, yellow: 26, blue: 39,
};

// Safe squares (absolute main-path indices 0-51) — can't be captured here.
// Entries (0,13,26,39) + midpoints (8,21,34,47).
export const SAFE_ABS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Convert a color-relative position (0-51) to an absolute board index (0-51).
function absPos(color: Color, relPos: number): number {
  return (relPos + COLOR_OFFSET[color]) % 52;
}

// Get the [row,col] for a token given its color + position.
export function cellOf(color: Color, pos: TokenPos): [number, number] | null {
  if (pos === -1) return null;
  if (pos <= 51) return MAIN_PATH[absPos(color, pos)];
  if (pos <= 57) return HOME_COLS[color][pos - 52];
  return null;
}

function isSafe(color: Color, relPos: number): boolean {
  return SAFE_ABS.has(absPos(color, relPos));
}

// ── Blocking ────────────────────────────────────────────────────────────────

// A square is "blocked" for `movingColor` if any opponent has 2+ tokens there.
// Blocked squares cannot be landed on (Bangladeshi rule).
function isBlockedFor(state: GameState, movingColor: Color, relPos: number): boolean {
  if (relPos < 0 || relPos > 51) return false; // home column / finished — never blocked
  if (isSafe(movingColor, relPos)) return false;  // safe squares are never blocked
  const absLand = absPos(movingColor, relPos);
  for (const other of state.players) {
    if (other.color === movingColor) continue;
    const count = other.tokens.filter(
      ot => ot.pos >= 0 && ot.pos <= 51 && absPos(other.color, ot.pos) === absLand
    ).length;
    if (count >= 2) return true;
  }
  return false;
}

// ── Move validation ─────────────────────────────────────────────────────────

// Returns the new position after moving `die` steps, or null if not valid.
export function newPos(pos: TokenPos, die: DiceValue): TokenPos | null {
  if (pos === 58) return null;          // already finished
  if (pos === -1) return die === 6 ? 0 : null; // enter only on 6
  const next = pos + die;
  if (next > 58) return null;           // overshot home
  return next;
}

// Returns which token IDs the current player can legally move with `die`.
// Enforces the blocking rule: can't land on a square with 2+ opponent tokens.
export function movableTokens(state: GameState, player: Player, die: DiceValue): number[] {
  return player.tokens
    .filter(t => {
      const np = newPos(t.pos, die);
      if (np === null) return false;
      // Blocking: can't land on opponent's double-stack on a non-safe square
      if (isBlockedFor(state, player.color, np)) return false;
      return true;
    })
    .map(t => t.id);
}

// ── Apply a move ────────────────────────────────────────────────────────────

export function applyMove(state: GameState, tokenId: number): GameState {
  const s = structuredClone(state) as GameState;
  const player = s.players[s.turn];
  const die = s.dice!;
  const token = player.tokens.find(t => t.id === tokenId)!;
  const next = newPos(token.pos, die)!;
  token.pos = next;

  // Capture: land on non-safe main-path square → send ALL opponent tokens there home.
  // A single token can be captured (not a double-stack, which is a block and can't be landed on anyway).
  let actualKill = false;
  let killedNames: string[] = [];
  if (next >= 0 && next <= 51 && !isSafe(player.color, next)) {
    const absLand = absPos(player.color, next);
    for (const other of s.players) {
      if (other.color === player.color) continue;
      for (const ot of other.tokens) {
        if (ot.pos >= 0 && ot.pos <= 51 && absPos(other.color, ot.pos) === absLand) {
          ot.pos = -1; // send home
          actualKill = true;
          if (!killedNames.includes(other.name)) killedNames.push(other.name);
        }
      }
    }
  }

  // Check if this player finished.
  const done = player.tokens.every(t => t.pos === 58);
  if (done) {
    const ranks = s.players.map(p => p.rank).filter(r => r !== null) as number[];
    player.rank = ranks.length === 0 ? 1 : Math.max(...ranks) + 1;
    s.lastEvent = `finished:${player.name}`;
  } else if (actualKill) {
    s.lastEvent = `cut:${killedNames.join(',')}`;
  } else if (die === 6) {
    s.lastEvent = 'extra_six';
  } else {
    s.lastEvent = undefined;
  }

  // Check overall game finish (≤1 active player left).
  const activePlayers = s.players.filter(p => p.tokens.some(t => t.pos !== 58));
  if (activePlayers.length <= 1) {
    for (const p of s.players) {
      if (p.rank === null) {
        const ranks = s.players.map(q => q.rank).filter(r => r !== null) as number[];
        p.rank = ranks.length + 1;
      }
    }
    s.status = 'finished';
  }

  // Bangladeshi extra-turn rules:
  //   • Rolling a 6 → bonus roll
  //   • Killing an opponent token → bonus roll
  // Both can stack: roll 6 AND kill → still just one bonus roll, and consecutiveSixes keeps counting.
  const extraTurn = die === 6 || actualKill;

  if (!s.players.every(p => p.rank !== null)) {
    if (!extraTurn) {
      // Advance to the next active (unfinished) player.
      let next_turn = (s.turn + 1) % s.players.length;
      let guard = 0;
      while (s.players[next_turn].tokens.every(t => t.pos === 58) && guard++ < s.players.length) {
        next_turn = (next_turn + 1) % s.players.length;
      }
      s.turn = next_turn;
    }
  }

  s.dice = null;
  s.diceRolled = false;
  // Keep consecutiveSixes count only when the bonus came from rolling 6 itself.
  // If extra turn came from a kill only (die !== 6), reset the streak.
  s.consecutiveSixes = (extraTurn && die === 6) ? s.consecutiveSixes : 0;
  s.updatedAt = new Date().toISOString();
  return s;
}

// ── Roll dice ───────────────────────────────────────────────────────────────

export function rollDice(state: GameState): GameState {
  const s = structuredClone(state) as GameState;
  const die = (Math.floor(Math.random() * 6) + 1) as DiceValue;
  s.dice = die;
  s.diceRolled = true;
  s.lastEvent = undefined;

  if (die === 6) {
    s.consecutiveSixes++;
    if (s.consecutiveSixes >= 3) {
      // Three sixes in a row — forfeit turn, nothing moves.
      s.consecutiveSixes = 0;
      s.dice = null;
      s.diceRolled = false;
      s.lastEvent = 'three_sixes';
      // Advance to next active player.
      let next = (s.turn + 1) % s.players.length;
      let guard = 0;
      while (s.players[next].tokens.every(t => t.pos === 58) && guard++ < s.players.length) {
        next = (next + 1) % s.players.length;
      }
      s.turn = next;
      s.updatedAt = new Date().toISOString();
      return s;
    }
  } else {
    s.consecutiveSixes = 0;
  }

  // Check if the current player has any legal move.
  const movable = movableTokens(s, s.players[s.turn], die);
  if (movable.length === 0) {
    // No valid move (including blocked squares) — pass turn.
    s.dice = null;
    s.diceRolled = false;
    s.lastEvent = 'no_moves';
    let next = (s.turn + 1) % s.players.length;
    let guard = 0;
    while (s.players[next].tokens.every(t => t.pos === 58) && guard++ < s.players.length) {
      next = (next + 1) % s.players.length;
    }
    s.turn = next;
  }

  s.updatedAt = new Date().toISOString();
  return s;
}

// ── Bot logic ────────────────────────────────────────────────────────────────

// Strategy: kill > enter new token on 6 > advance furthest token.
export function botChooseToken(state: GameState): number {
  const player = state.players[state.turn];
  const die = state.dice!;
  const movable = movableTokens(state, player, die);

  // Prefer a token that would kill an opponent.
  for (const id of movable) {
    const t = player.tokens.find(x => x.id === id)!;
    const np = newPos(t.pos, die)!;
    if (np >= 0 && np <= 51 && !isSafe(player.color, np)) {
      const absLand = absPos(player.color, np);
      const kills = state.players.some(other => {
        if (other.color === player.color) return false;
        return other.tokens.some(
          ot => ot.pos >= 0 && ot.pos <= 51 && absPos(other.color, ot.pos) === absLand
        );
      });
      if (kills) return id;
    }
  }

  // On a 6, prefer entering a new token from home.
  if (die === 6) {
    const atHome = movable.find(id => player.tokens.find(x => x.id === id)!.pos === -1);
    if (atHome !== undefined) return atHome;
  }

  // Advance the token that is furthest along.
  return movable.reduce((best, id) => {
    const bp = player.tokens.find(x => x.id === best)!.pos;
    const cp = player.tokens.find(x => x.id === id)!.pos;
    return cp > bp ? id : best;
  }, movable[0]);
}

// ── Room helpers ─────────────────────────────────────────────────────────────

function makeTokens(): Token[] {
  return [0, 1, 2, 3].map(id => ({id, pos: -1}));
}

export function makeInitialState(
  players: Array<{color: Color; name: string; isBot: boolean; playerId: string}>,
  maxPlayers: number = 4,
): GameState {
  return {
    players: players.map(p => ({...p, tokens: makeTokens(), rank: null})),
    turn: 0,
    dice: null,
    diceRolled: false,
    consecutiveSixes: 0,
    status: 'waiting',
    maxPlayers: Math.max(2, Math.min(4, maxPlayers)),
    updatedAt: new Date().toISOString(),
  };
}

export function startGame(state: GameState): GameState {
  return {...state, status: 'playing', updatedAt: new Date().toISOString()};
}

// Fill remaining player slots with bots up to state.maxPlayers.
export function fillWithBots(state: GameState): GameState {
  const s = structuredClone(state) as GameState;
  const max = s.maxPlayers ?? 4;
  const used = new Set(s.players.map(p => p.color));
  let bi = 1;
  for (const color of COLORS) {
    if (s.players.length >= max) break;
    if (used.has(color)) continue;
    s.players.push({color, name: `Bot ${bi++}`, isBot: true, playerId: '', tokens: makeTokens(), rank: null});
  }
  return s;
}
