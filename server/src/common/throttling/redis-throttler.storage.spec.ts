import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lauxlib, lua, lualib, to_luastring } from 'fengari';
import { RedisThrottlerStorage, THROTTLER_INCREMENT_LUA } from './redis-throttler.storage.js';

const { evalStub, redisInstances } = vi.hoisted(() => ({
  evalStub: vi.fn(),
  redisInstances: [] as Array<{ url?: unknown; options?: unknown; quit: unknown }>,
}));

vi.mock('ioredis', () => {
  class MockRedis {
    eval = evalStub;
    quit = vi.fn().mockResolvedValue('OK');
    constructor(
      public url?: unknown,
      public options?: unknown,
    ) {
      redisInstances.push(this);
    }
  }
  return { Redis: MockRedis };
});

type LuaArg = string | number | boolean | null;

interface StorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

// In-memory stand-in for the small slice of Redis the throttler script uses.
// Tests drive `now` explicitly, so PEXPIRE reclaim is a no-op here.
class FakeRedisStore {
  private readonly hashes = new Map<string, Map<string, string>>();
  private readonly zsets = new Map<string, Map<string, number>>();
  private readonly counters = new Map<string, number>();

  zadd(key: string, score: number, member: string): number {
    let zset = this.zsets.get(key);
    if (!zset) {
      zset = new Map();
      this.zsets.set(key, zset);
    }
    const added = zset.has(member) ? 0 : 1;
    zset.set(member, score);
    return added;
  }

  zremrangebyscore(key: string, min: string, max: string): number {
    const zset = this.zsets.get(key);
    if (!zset) return 0;
    const lo = min === '-inf' ? Number.NEGATIVE_INFINITY : Number(min);
    const hi = Number(max);
    let removed = 0;
    for (const [member, score] of zset) {
      if (score >= lo && score <= hi) {
        zset.delete(member);
        removed += 1;
      }
    }
    return removed;
  }

  zcard(key: string): number {
    return this.zsets.get(key)?.size ?? 0;
  }

  zrange(key: string, start: number, stop: number, rest: string[]): LuaArg[] {
    const zset = this.zsets.get(key);
    if (!zset) return [];
    const withScores = rest.includes('WITHSCORES');
    const entries = [...zset.entries()].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
    const out: LuaArg[] = [];
    for (const [member, score] of entries.slice(start, stop + 1)) {
      out.push(member);
      if (withScores) out.push(String(score));
    }
    return out;
  }

  hget(key: string, field: string): string | null {
    return this.hashes.get(key)?.get(field) ?? null;
  }

  hset(key: string, pairs: LuaArg[]): number {
    let hash = this.hashes.get(key);
    if (!hash) {
      hash = new Map();
      this.hashes.set(key, hash);
    }
    let added = 0;
    for (let i = 0; i + 1 < pairs.length; i += 2) {
      const field = String(pairs[i]);
      if (!hash.has(field)) added += 1;
      hash.set(field, String(pairs[i + 1]));
    }
    return added;
  }

  incr(key: string): number {
    const next = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, next);
    return next;
  }

  del(key: string): number {
    let removed = 0;
    if (this.zsets.delete(key)) removed += 1;
    if (this.hashes.delete(key)) removed += 1;
    return removed;
  }
}

function luaToJs(L: object, idx: number): LuaArg {
  const type = lua.lua_type(L, idx);
  if (type === lua.LUA_TNUMBER) return lua.lua_tonumberx(L, idx, null);
  if (type === lua.LUA_TSTRING) return lua.lua_tojsstring(L, idx);
  if (type === lua.LUA_TBOOLEAN) return lua.lua_toboolean(L, idx);
  return null;
}

function pushJs(L: object, value: LuaArg | LuaArg[]): void {
  if (Array.isArray(value)) {
    lua.lua_createtable(L, value.length, 0);
    value.forEach((entry, index) => {
      pushJs(L, entry);
      lua.lua_rawseti(L, -2, index + 1);
    });
    return;
  }
  if (value === null) lua.lua_pushnil(L);
  else if (typeof value === 'number') lua.lua_pushnumber(L, value);
  else if (typeof value === 'boolean') lua.lua_pushboolean(L, value);
  else lua.lua_pushstring(L, to_luastring(value));
}

function setGlobalTable(L: object, name: string, values: LuaArg[]): void {
  lua.lua_createtable(L, values.length, 0);
  values.forEach((value, index) => {
    pushJs(L, value);
    lua.lua_rawseti(L, -2, index + 1);
  });
  lua.lua_setglobal(L, to_luastring(name));
}

function dispatch(store: FakeRedisStore, cmd: string, args: LuaArg[]): LuaArg | LuaArg[] {
  const key = String(args[0]);
  switch (cmd) {
    case 'zadd':
      return store.zadd(key, Number(args[1]), String(args[2]));
    case 'zremrangebyscore':
      return store.zremrangebyscore(key, String(args[1]), String(args[2]));
    case 'zcard':
      return store.zcard(key);
    case 'zrange':
      return store.zrange(key, Number(args[1]), Number(args[2]), args.slice(3).map(String));
    case 'hget':
      return store.hget(key, String(args[1]));
    case 'hset':
      return store.hset(key, args.slice(1));
    case 'incr':
      return store.incr(key);
    case 'del':
      return store.del(key);
    case 'pexpire':
      return 1;
    default:
      throw new Error(`unsupported redis command in throttler script: ${cmd}`);
  }
}

// Runs the shipped Lua increment script inside a real Lua VM (fengari) against
// the fake store — the same script Redis executes, so semantics are verified
// end to end without an external Redis. Each call gets a fresh Lua state, like
// a separate ECS task, which is what proves shared-storage behavior.
function runIncrement(
  store: FakeRedisStore,
  key: string,
  now: number,
  ttl: number,
  limit: number,
  blockDuration: number,
): StorageRecord {
  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);

  const redisCall = (LL: object): number => {
    const parts: LuaArg[] = [];
    for (let i = 1; i <= lua.lua_gettop(LL); i += 1) parts.push(luaToJs(LL, i));
    const result = dispatch(store, String(parts[0]).toLowerCase(), parts.slice(1));
    pushJs(LL, result);
    return 1;
  };

  lua.lua_createtable(L, 0, 1);
  lua.lua_pushstring(L, to_luastring('call'));
  lua.lua_pushcfunction(L, redisCall);
  lua.lua_settable(L, -3);
  lua.lua_setglobal(L, to_luastring('redis'));
  setGlobalTable(L, 'KEYS', [key]);
  setGlobalTable(L, 'ARGV', [String(now), String(ttl), String(limit), String(blockDuration)]);

  const status = lauxlib.luaL_dostring(L, to_luastring(THROTTLER_INCREMENT_LUA));
  if (status !== lua.LUA_OK) {
    throw new Error(`throttler Lua script failed: ${lua.lua_tojsstring(L, -1)}`);
  }
  const reply: number[] = [];
  for (let i = 1; i <= 4; i += 1) {
    lua.lua_rawgeti(L, -1, i);
    reply.push(lua.lua_tonumberx(L, -1, null));
    lua.lua_pop(L, 1);
  }
  const [totalHits = 0, timeToExpire = 0, isBlocked = 0, timeToBlockExpire = 0] = reply;
  return { totalHits, timeToExpire, isBlocked: isBlocked === 1, timeToBlockExpire };
}

const TTL = 60_000;
const LIMIT = 10;

function sequence(
  store: FakeRedisStore,
  key: string,
  start: number,
  count: number,
  opts: { ttl?: number; limit?: number; blockDuration?: number } = {},
): StorageRecord[] {
  const ttl = opts.ttl ?? TTL;
  const limit = opts.limit ?? LIMIT;
  const blockDuration = opts.blockDuration ?? ttl;
  return Array.from({ length: count }, (_, i) =>
    runIncrement(store, key, start, ttl, limit, blockDuration),
  );
}

describe('RedisThrottlerStorage Lua semantics (fengari)', () => {
  let store: FakeRedisStore;
  beforeEach(() => {
    store = new FakeRedisStore();
  });

  it('allows requests up to the limit and blocks the one that crosses it', () => {
    const records = sequence(store, 'key-a', 1000, LIMIT + 1);
    records.slice(0, LIMIT).forEach((record, i) => {
      expect(record).toEqual({
        totalHits: i + 1,
        timeToExpire: 60,
        isBlocked: false,
        timeToBlockExpire: -1,
      });
    });
    expect(records[LIMIT]).toEqual({
      totalHits: LIMIT + 1,
      timeToExpire: 60,
      isBlocked: true,
      timeToBlockExpire: 60,
    });
  });

  it('keeps blocked state without counting further hits until the block expires', () => {
    sequence(store, 'key-b', 1000, LIMIT + 1);
    const during = runIncrement(store, 'key-b', 30_000, TTL, LIMIT, TTL);
    expect(during).toEqual({
      totalHits: LIMIT + 1,
      timeToExpire: 31,
      isBlocked: true,
      timeToBlockExpire: 31,
    });

    const after = runIncrement(store, 'key-b', 1000 + TTL + 500, TTL, LIMIT, TTL);
    expect(after.isBlocked).toBe(false);
    expect(after.totalHits).toBe(1);
  });

  it('slides the window: hits expire individually, so an idle client regains budget', () => {
    runIncrement(store, 'key-c', 1000, TTL, 2, TTL);
    runIncrement(store, 'key-c', 20_000, TTL, 2, TTL);
    expect(runIncrement(store, 'key-c', 30_000, TTL, 2, TTL).isBlocked).toBe(true);

    // The hit that crossed the limit is recorded too, so the t=20s and t=30s
    // hits are still alive at t=62s; only the t=1s hit has expired.
    const duringBlock = runIncrement(store, 'key-c', 62_000, TTL, 2, TTL);
    expect(duringBlock).toEqual({
      totalHits: 2,
      timeToExpire: 60,
      isBlocked: true,
      timeToBlockExpire: 28,
    });

    const recovered = runIncrement(store, 'key-c', 91_000, TTL, 2, TTL);
    expect(recovered.isBlocked).toBe(false);
    expect(recovered.totalHits).toBe(1);
  });

  it('shares counters across independent runtimes, so per-IP ceilings no longer multiply by task count', () => {
    const taskA = store;
    const taskB = store; // same backing store, separate Lua states per call
    const firstFive = sequence(taskA, 'key-d', 1000, LIMIT - 5);
    expect(firstFive.at(-1)?.totalHits).toBe(LIMIT - 5);

    const nextFive = sequence(taskB, 'key-d', 1000, 5);
    expect(nextFive.at(-1)?.totalHits).toBe(LIMIT);
    expect(nextFive.at(-1)?.isBlocked).toBe(false);

    const crossing = runIncrement(taskB, 'key-d', 1000, TTL, LIMIT, TTL);
    expect(crossing).toEqual({
      totalHits: LIMIT + 1,
      timeToExpire: 60,
      isBlocked: true,
      timeToBlockExpire: 60,
    });
  });

  it('matches the no-blockDuration variant (limit reached => report without recording)', () => {
    const [first, second, third] = sequence(store, 'key-e', 1000, 3, {
      limit: 2,
      blockDuration: 0,
    });
    expect(first).toEqual({
      totalHits: 1,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
    expect(second).toEqual({
      totalHits: 2,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
    expect(third).toEqual({
      totalHits: 3,
      timeToExpire: 60,
      isBlocked: true,
      timeToBlockExpire: 60,
    });
    // Nothing was recorded for the blocked hit, so the budget stays consumed by 2.
    expect(runIncrement(store, 'key-e', 1000, TTL, 2, 0).isBlocked).toBe(true);
  });
});

describe('RedisThrottlerStorage (ioredis adapter)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisInstances.length = 0;
  });

  it('runs the shipped Lua script and maps the record fields', async () => {
    evalStub.mockResolvedValue([11, 42, 1, 7]);
    const storage = new RedisThrottlerStorage('redis://localhost:6379');

    const record = await storage.increment('some-key', 60_000, 300, 60_000, 'default');

    const [script, numKeys, key, now, ttl, limit, blockDuration] = evalStub.mock.calls[0] as [
      string,
      number,
      string,
      string,
      string,
      string,
      string,
    ];
    expect(script).toBe(THROTTLER_INCREMENT_LUA);
    expect(numKeys).toBe(1);
    expect(key).toBe('some-key');
    expect([ttl, limit, blockDuration]).toEqual(['60000', '300', '60000']);
    expect(Number(now)).toBeGreaterThan(0);
    expect(record).toEqual({
      totalHits: 11,
      timeToExpire: 42,
      isBlocked: true,
      timeToBlockExpire: 7,
    });
  });

  it('creates a bounded client and closes it on application shutdown', async () => {
    const storage = new RedisThrottlerStorage('rediss://cache:6379');
    expect(redisInstances).toHaveLength(1);
    expect(redisInstances[0]?.url).toBe('rediss://cache:6379');
    expect(redisInstances[0]?.options).toEqual({ maxRetriesPerRequest: 2 });

    await storage.onApplicationShutdown();
    expect(redisInstances[0]?.quit).toHaveBeenCalledTimes(1);
  });
});

describe('createThrottlerStorage', () => {
  beforeEach(() => vi.unstubAllEnvs());

  it('returns undefined without REDIS_URL so the in-memory fallback stays', async () => {
    vi.resetModules();
    vi.stubEnv('REDIS_URL', '');
    const mod = await import('./redis-throttler.storage.js');
    expect(mod.createThrottlerStorage()).toBeUndefined();
  });

  it('returns a Redis storage when REDIS_URL is configured', async () => {
    vi.resetModules();
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    const mod = await import('./redis-throttler.storage.js');
    expect(mod.createThrottlerStorage()).toBeInstanceOf(mod.RedisThrottlerStorage);
  });
});
