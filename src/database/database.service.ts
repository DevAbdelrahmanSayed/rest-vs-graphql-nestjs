import { Injectable, Logger } from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';
import { recordQuery } from '../common/request-context.js';
import type { ProductRow, ReviewRow, SellerRow } from './rows.js';
import { products, reviews, sellers } from './seed.js';

const QUERY_LATENCY_MS = 2;

/**
 * In-memory stand-in for a SQL database. Every method logs the SQL it would
 * run, so the N+1 problem (and the DataLoader fix) is visible in the console
 * and in the `X-DB-Queries` response header.
 */
@Injectable()
export class DatabaseService {
  private readonly logger = new Logger('SQL');

  async findProducts(limit: number): Promise<ProductRow[]> {
    await this.query(`SELECT * FROM products ORDER BY id LIMIT ${limit}`);
    return products.slice(0, limit);
  }

  async findProductById(id: number): Promise<ProductRow | undefined> {
    await this.query(`SELECT * FROM products WHERE id = ${id}`);
    return products.find((p) => p.id === id);
  }

  async updateProductDescription(
    id: number,
    description: string,
  ): Promise<ProductRow | undefined> {
    await this.query(
      `UPDATE products SET description = $1, updated_at = now() WHERE id = ${id}`,
    );
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) return undefined;
    products[index] = { ...products[index], description, updatedAt: new Date().toISOString() };
    return products[index];
  }

  async findSellersByIds(ids: readonly number[]): Promise<SellerRow[]> {
    await this.query(`SELECT * FROM sellers WHERE id IN (${ids.join(', ')})`);
    return sellers.filter((s) => ids.includes(s.id));
  }

  async findLatestReviews(
    productIds: readonly number[],
    perProduct: number,
  ): Promise<ReviewRow[]> {
    await this.query(
      `SELECT * FROM reviews WHERE product_id IN (${productIds.join(', ')}) ` +
        `ORDER BY created_at DESC -- latest ${perProduct} per product`,
    );
    return productIds.flatMap((id) =>
      reviews
        .filter((r) => r.productId === id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, perProduct),
    );
  }

  private async query(sql: string): Promise<void> {
    recordQuery(sql);
    this.logger.debug(sql);
    await sleep(QUERY_LATENCY_MS);
  }
}
