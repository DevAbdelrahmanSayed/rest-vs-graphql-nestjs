import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

interface RequestStore {
  queries: string[];
  bypassCache: boolean;
  cacheHits: number;
  cacheMisses: number;
}

const storage = new AsyncLocalStorage<RequestStore>();

export function recordQuery(sql: string): void {
  storage.getStore()?.queries.push(sql);
}

export function recordCacheLookup(hits: number, misses: number): void {
  const store = storage.getStore();
  if (!store) return;
  store.cacheHits += hits;
  store.cacheMisses += misses;
}

/** `X-Cache: off` skips the server cache, so the database work is visible again. */
export function isCacheBypassed(): boolean {
  return storage.getStore()?.bypassCache ?? false;
}

/** HIT: everything from Redis. MISS: everything from the database. PARTIAL: both. */
function cacheStatus(store: RequestStore): string {
  if (store.bypassCache) return 'BYPASS';
  if (store.cacheHits === 0 && store.cacheMisses === 0) return 'NONE';
  if (store.cacheMisses === 0) return 'HIT';
  if (store.cacheHits === 0) return 'MISS';
  return 'PARTIAL';
}

/** One readable line for Postman, e.g. `app | Redis MISS | 1 DB query`. Header values stay ASCII. */
function cacheInfo(store: RequestStore): string {
  const n = store.queries.length;
  return `app | Redis ${cacheStatus(store)} | ${n} DB ${n === 1 ? 'query' : 'queries'}`;
}

/**
 * Tracks the database queries and cache lookups made while handling a request
 * and reports them as `X-DB-Queries`, `X-Cache-Status` and `X-Cache-Info`, so
 * REST and GraphQL can be compared from Postman.
 */
export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const store: RequestStore = {
    queries: [],
    bypassCache: req.header('x-cache') === 'off',
    cacheHits: 0,
    cacheMisses: 0,
  };
  const writeHead = res.writeHead.bind(res) as (...args: unknown[]) => Response;

  res.writeHead = ((...args: unknown[]) => {
    res.setHeader('X-DB-Queries', String(store.queries.length));
    res.setHeader('X-Cache-Status', cacheStatus(store));
    res.setHeader('X-Cache-Info', cacheInfo(store));
    return writeHead(...args);
  }) as Response['writeHead'];

  storage.run(store, next);
}
