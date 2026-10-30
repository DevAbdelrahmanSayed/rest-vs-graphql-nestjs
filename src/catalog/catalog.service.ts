import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { isCacheBypassed, recordCacheLookup } from '../common/request-context.js';
import { DatabaseService } from '../database/database.service.js';
import type { ProductRow, ReviewRow, SellerRow } from '../database/rows.js';
import { MAX_PAGE_SIZE } from './dto/catalog.inputs.js';

export const SERVER_CACHE_TTL_MS = 60_000;

const keys = {
  productList: (limit: number) => `products:list:${limit}`,
  product: (id: number) => `product:${id}`,
  seller: (id: number) => `seller:${id}`,
  reviews: (productId: number, last: number) => `reviews:${productId}:${last}`,
};

/**
 * Business logic shared by the REST controllers and the GraphQL resolvers.
 *
 * Reads go through the server cache (Redis, or memory when REDIS_URL is not
 * set) before the database. Because both APIs call this service, a product
 * cached by REST is also a cache hit for GraphQL.
 */
@Injectable()
export class CatalogService {
  constructor(
    private readonly db: DatabaseService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  listProducts(limit: number): Promise<ProductRow[]> {
    return this.cached(keys.productList(limit), () => this.db.findProducts(limit));
  }

  findProduct(id: number): Promise<ProductRow | undefined> {
    return this.cached(keys.product(id), () => this.db.findProductById(id));
  }

  /**
   * Clears the product from the server cache straight away, so the only delay
   * left before visitors see the edit is the CDN's `s-maxage`. Without this, a
   * CDN could store a copy that was already a minute old in Redis.
   */
  async updateDescription(id: number, description: string): Promise<ProductRow | undefined> {
    const product = await this.db.updateProductDescription(id, description);
    if (!product) return undefined;
    const listKeys = Array.from({ length: MAX_PAGE_SIZE }, (_, i) => keys.productList(i + 1));
    await this.cache.mdel([keys.product(id), ...listKeys]);
    return product;
  }

  async findSeller(id: number): Promise<SellerRow | undefined> {
    const [seller] = await this.sellersByIds([id]);
    return seller instanceof Error ? undefined : seller;
  }

  async latestReviews(productId: number, last: number): Promise<ReviewRow[]> {
    const [reviews] = await this.latestReviewsByProductIds([productId], last);
    return reviews;
  }

  /** Batch lookup for DataLoader: results must line up with `ids`. */
  async sellersByIds(ids: readonly number[]): Promise<(SellerRow | Error)[]> {
    const found = await this.cachedMany(ids, keys.seller, async (missing) => {
      const rows = await this.db.findSellersByIds(missing);
      return new Map(rows.map((s) => [s.id, s]));
    });
    return ids.map((id) => found.get(id) ?? new Error(`Seller ${id} not found`));
  }

  /** Batch lookup for DataLoader: one list of reviews per product id. */
  async latestReviewsByProductIds(
    productIds: readonly number[],
    last: number,
  ): Promise<ReviewRow[][]> {
    const found = await this.cachedMany(
      productIds,
      (id) => keys.reviews(id, last),
      async (missing) => {
        const rows = await this.db.findLatestReviews(missing, last);
        return new Map(missing.map((id) => [id, rows.filter((r) => r.productId === id)]));
      },
    );
    return productIds.map((id) => found.get(id) ?? []);
  }

  /** Cache-aside for one key: Redis first, then the database, then save. */
  private async cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (!isCacheBypassed()) {
      const hit = await this.cache.get<T>(key);
      recordCacheLookup(hit === undefined ? 0 : 1, hit === undefined ? 1 : 0);
      if (hit !== undefined) return hit;
    }
    const value = await load();
    if (value !== undefined) await this.cache.set(key, value, SERVER_CACHE_TTL_MS);
    return value;
  }

  /** Cache-aside for a batch: one MGET, one database query for the misses, one MSET. */
  private async cachedMany<T>(
    ids: readonly number[],
    keyOf: (id: number) => string,
    loadMissing: (ids: number[]) => Promise<Map<number, T>>,
  ): Promise<Map<number, T>> {
    const found = new Map<number, T>();
    if (!isCacheBypassed()) {
      const hits = await this.cache.mget<T>(ids.map(keyOf));
      ids.forEach((id, i) => {
        const hit = hits[i];
        if (hit !== undefined) found.set(id, hit);
      });
      recordCacheLookup(found.size, ids.length - found.size);
    }

    const missing = ids.filter((id) => !found.has(id));
    if (missing.length === 0) return found;

    const loaded = await loadMissing(missing);
    await this.cache.mset(
      [...loaded].map(([id, value]) => ({ key: keyOf(id), value, ttl: SERVER_CACHE_TTL_MS })),
    );
    loaded.forEach((value, id) => found.set(id, value));
    return found;
  }
}
