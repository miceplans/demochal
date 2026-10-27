import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { Redis } from 'ioredis';
import { env } from '../../config/env.js';

// Structural copy of the record the guard consumes; @nestjs/throttler does not
// re-export ThrottlerStorageRecord from its package root.
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

// Mirrors the default in-memory ThrottlerStorageService sliding-window
// semantics so limits behave identically once storage moves off task memory:
// hits expire ttl after they fire, the window anchor refreshes once expired,
// and crossing `limit` blocks further requests for blockDuration. Redis keys
// carry only the guard's sha256 tracker hash — never raw IPs or emails.
// Redis errors intentionally propagate (fail closed): a store outage rejects
// requests instead of silently lifting rate limits, since this guard is a
// security control; the /health check does not probe Redis by design.
export const THROTTLER_INCREMENT_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local ttl_ms = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local block_ms = tonumber(ARGV[4])

local hits_key = key .. ':hits'
local meta_key = key .. ':meta'
local seq_key = key .. ':seq'

redis.call('ZREMRANGEBYSCORE', hits_key, '-inf', now)

local expires_at = tonumber(redis.call('HGET', meta_key, 'expiresAt') or '0')
if expires_at <= now then
  expires_at = now + ttl_ms
  redis.call('HSET', meta_key, 'expiresAt', expires_at)
end

local stored_blocked = redis.call('HGET', meta_key, 'isBlocked') == '1'
local block_expires_at = tonumber(redis.call('HGET', meta_key, 'blockExpiresAt') or '0')

local total_hits = redis.call('ZCARD', hits_key)
local time_to_expire = math.ceil((expires_at - now) / 1000)

-- keep keys briefly beyond the live window so Redis reclaims idle trackers
local keep_ms = math.max(expires_at, block_expires_at) - now + 60000
redis.call('PEXPIRE', hits_key, keep_ms)
redis.call('PEXPIRE', meta_key, keep_ms)
redis.call('PEXPIRE', seq_key, keep_ms)

local function fire_hit()
  redis.call('ZADD', hits_key, now + ttl_ms, now .. ':' .. redis.call('INCR', seq_key))
end

if block_ms <= 0 then
  local blocked = total_hits >= limit
  if not blocked then
    fire_hit()
  end
  local time_to_block_expire = 0
  if blocked then
    local earliest = redis.call('ZRANGE', hits_key, 0, 0, 'WITHSCORES')
    time_to_block_expire = earliest[2] and math.ceil((tonumber(earliest[2]) - now) / 1000) or time_to_expire
  end
  return { total_hits + 1, time_to_expire, blocked and 1 or 0, time_to_block_expire }
end

if not stored_blocked then
  fire_hit()
  total_hits = total_hits + 1
end

if total_hits > limit and not stored_blocked then
  stored_blocked = true
  block_expires_at = now + block_ms
  redis.call('HSET', meta_key, 'isBlocked', '1', 'blockExpiresAt', block_expires_at)
end

local time_to_block_expire = math.ceil((block_expires_at - now) / 1000)
if time_to_block_expire <= 0 and stored_blocked then
  redis.call('HSET', meta_key, 'isBlocked', '0')
  redis.call('DEL', hits_key)
  fire_hit()
  redis.call('PEXPIRE', hits_key, keep_ms)
  total_hits = 1
  stored_blocked = false
end

return { total_hits, time_to_expire, stored_blocked and 1 or 0, time_to_block_expire }
`;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnApplicationShutdown {
  private readonly redis: Redis;

  constructor(url: string) {
    this.redis = new Redis(url, { maxRetriesPerRequest: 2 });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    _throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const [totalHits, timeToExpire, isBlocked, timeToBlockExpire] = (await this.redis.eval(
      THROTTLER_INCREMENT_LUA,
      1,
      key,
      String(Date.now()),
      String(ttl),
      String(limit),
      String(blockDuration),
    )) as [number, number, number, number];
    return {
      totalHits: Number(totalHits),
      timeToExpire: Number(timeToExpire),
      isBlocked: Number(isBlocked) === 1,
      timeToBlockExpire: Number(timeToBlockExpire),
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit();
  }
}

// Redis keeps one shared counter per key across every ECS task; without
// REDIS_URL the per-task in-memory fallback (and its multiplicative ceiling)
// stays for local dev and serverless deploys.
export function createThrottlerStorage(): RedisThrottlerStorage | undefined {
  return env.redisUrl ? new RedisThrottlerStorage(env.redisUrl) : undefined;
}
