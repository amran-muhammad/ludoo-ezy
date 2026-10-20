import {Hono} from 'hono';
import {validator} from 'hono/validator';

import {withDb} from '../../platform/guards';
import {
  type Color,
  COLORS,
  type GameState,
  applyMove,
  botChooseToken,
  fillWithBots,
  makeInitialState,
  movableTokens,
  rollDice,
  startGame,
} from '../../lib/ludo';

// ── Validators ────────────────────────────────────────────────────────────────

function str(v: unknown, max = 200): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length > 0 && s.length <= max ? s : null;
}

function isUUID(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

const createBody = validator('json', (value, c) => {
  const v = (value ?? {}) as Record<string, unknown>;
  const name = str(v.name, 30);
  const playerId = isUUID(v.playerId) ? v.playerId : null;
  if (!name || !playerId) return c.json({error: 'bad_request', message: 'name and playerId required.'}, 400);
  return {name, playerId};
});

const joinBody = validator('json', (value, c) => {
  const v = (value ?? {}) as Record<string, unknown>;
  const name = str(v.name, 30);
  const playerId = isUUID(v.playerId) ? v.playerId : null;
  if (!name || !playerId) return c.json({error: 'bad_request', message: 'name and playerId required.'}, 400);
  return {name, playerId};
});

const playerBody = validator('json', (value, c) => {
  const v = (value ?? {}) as Record<string, unknown>;
  const playerId = isUUID(v.playerId) ? v.playerId : null;
  if (!playerId) return c.json({error: 'bad_request', message: 'playerId required.'}, 400);
  return {playerId};
});

const moveBody = validator('json', (value, c) => {
  const v = (value ?? {}) as Record<string, unknown>;
  const playerId = isUUID(v.playerId) ? v.playerId : null;
  const tokenId = typeof v.tokenId === 'number' && v.tokenId >= 0 && v.tokenId <= 3 ? v.tokenId : null;
  if (!playerId || tokenId === null) return c.json({error: 'bad_request', message: 'playerId and tokenId required.'}, 400);
  return {playerId, tokenId};
});

// ── Routes ────────────────────────────────────────────────────────────────────

export const ludoRoutes = new Hono()

  // POST /site-api/ludo/rooms — create a room.
  .post('/rooms', createBody, withDb, async c => {
    const db = c.var.db!;
    const {name, playerId} = c.req.valid('json');
    const color: Color = 'red';
    const code = randomCode();
    const state = makeInitialState([{color, name, isBot: false, playerId}]);
    await (db as any).ludoRoom.create({
      data: {code, state: JSON.stringify(state), status: 'waiting'},
    });
    return c.json({code, color}, 201);
  })

  // GET /site-api/ludo/rooms/:code — poll state.
  .get('/rooms/:code', withDb, async c => {
    const db = c.var.db!;
    const room = await (db as any).ludoRoom.findUnique({where: {code: c.req.param('code')}});
    if (!room) return c.json({error: 'not_found', message: 'Room not found.'}, 404);
    let state: GameState = JSON.parse(room.state);
    if (state.status === 'playing') {
      state = await playBotTurns(state, db, room.code);
    }
    return c.json({room: {code: room.code, status: room.status, state}});
  })

  // POST /site-api/ludo/rooms/:code/join — join room.
  .post('/rooms/:code/join', joinBody, withDb, async c => {
    const db = c.var.db!;
    const code = c.req.param('code');
    const {name, playerId} = c.req.valid('json');
    const room = await (db as any).ludoRoom.findUnique({where: {code}});
    if (!room) return c.json({error: 'not_found', message: 'Room not found.'}, 404);
    const state: GameState = JSON.parse(room.state);
    if (state.status !== 'waiting') return c.json({error: 'already_started', message: 'Game already started.'}, 409);
    const existing = state.players.find(p => p.playerId === playerId);
    if (existing) return c.json({code, color: existing.color});
    if (state.players.length >= 4) return c.json({error: 'full', message: 'Room is full.'}, 409);
    const used = new Set(state.players.map(p => p.color));
    const color = COLORS.find(col => !used.has(col))!;
    state.players.push({color, name, isBot: false, playerId, tokens: [{id:0,pos:-1},{id:1,pos:-1},{id:2,pos:-1},{id:3,pos:-1}], rank: null});
    state.updatedAt = new Date().toISOString();
    await (db as any).ludoRoom.update({where: {code}, data: {state: JSON.stringify(state)}});
    return c.json({code, color});
  })

  // POST /site-api/ludo/rooms/:code/start — fill bots and start.
  .post('/rooms/:code/start', playerBody, withDb, async c => {
    const db = c.var.db!;
    const code = c.req.param('code');
    const {playerId} = c.req.valid('json');
    const room = await (db as any).ludoRoom.findUnique({where: {code}});
    if (!room) return c.json({error: 'not_found', message: 'Room not found.'}, 404);
    let state: GameState = JSON.parse(room.state);
    if (state.status !== 'waiting') return c.json({error: 'already_started', message: 'Already started.'}, 409);
    if (!state.players.some(p => p.playerId === playerId)) return c.json({error: 'not_in_room', message: 'Not in this room.'}, 403);
    state = fillWithBots(state);
    state = startGame(state);
    await (db as any).ludoRoom.update({where: {code}, data: {state: JSON.stringify(state), status: 'playing'}});
    return c.json({ok: true});
  })

  // POST /site-api/ludo/rooms/:code/roll — roll dice.
  .post('/rooms/:code/roll', playerBody, withDb, async c => {
    const db = c.var.db!;
    const code = c.req.param('code');
    const {playerId} = c.req.valid('json');
    const room = await (db as any).ludoRoom.findUnique({where: {code}});
    if (!room) return c.json({error: 'not_found', message: 'Room not found.'}, 404);
    let state: GameState = JSON.parse(room.state);
    if (state.status !== 'playing') return c.json({error: 'not_playing'}, 409);
    const current = state.players[state.turn];
    if (current.playerId !== playerId) return c.json({error: 'not_your_turn', message: 'Not your turn.'}, 409);
    if (state.diceRolled) return c.json({error: 'already_rolled'}, 409);
    state = rollDice(state);
    if (state.diceRolled && state.dice !== null) {
      const movable = movableTokens(state.players[state.turn], state.dice);
      if (movable.length === 1) state = applyMove(state, movable[0]);
    }
    state = await playBotTurns(state, db, code);
    const newStatus = state.status === 'finished' ? 'finished' : 'playing';
    await (db as any).ludoRoom.update({where: {code}, data: {state: JSON.stringify(state), status: newStatus}});
    return c.json({state});
  })

  // POST /site-api/ludo/rooms/:code/move — move a token.
  .post('/rooms/:code/move', moveBody, withDb, async c => {
    const db = c.var.db!;
    const code = c.req.param('code');
    const {playerId, tokenId} = c.req.valid('json');
    const room = await (db as any).ludoRoom.findUnique({where: {code}});
    if (!room) return c.json({error: 'not_found', message: 'Room not found.'}, 404);
    let state: GameState = JSON.parse(room.state);
    if (state.status !== 'playing') return c.json({error: 'not_playing'}, 409);
    const current = state.players[state.turn];
    if (current.playerId !== playerId) return c.json({error: 'not_your_turn'}, 409);
    if (!state.diceRolled || state.dice === null) return c.json({error: 'roll_first'}, 409);
    const movable = movableTokens(current, state.dice);
    if (!movable.includes(tokenId)) return c.json({error: 'invalid_move', message: 'Cannot move that token.'}, 400);
    state = applyMove(state, tokenId);
    state = await playBotTurns(state, db, code);
    const newStatus = state.status === 'finished' ? 'finished' : 'playing';
    await (db as any).ludoRoom.update({where: {code}, data: {state: JSON.stringify(state), status: newStatus}});
    return c.json({state});
  });

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function playBotTurns(state: GameState, _db: unknown, _code: string): Promise<GameState> {
  let s = state;
  let i = 0;
  while (s.status === 'playing' && s.players[s.turn].isBot && i++ < 20) {
    s = rollDice(s);
    if (s.diceRolled && s.dice !== null) {
      const movable = movableTokens(s.players[s.turn], s.dice);
      if (movable.length > 0) s = applyMove(s, botChooseToken(s));
    }
  }
  return s;
}
