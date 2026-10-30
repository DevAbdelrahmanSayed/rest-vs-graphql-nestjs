import { createHash } from 'node:crypto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { INestApplication } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

// Fresh for one minute in a CDN; the browser has to revalidate.
const PUBLIC = 'public, max-age=0, s-maxage=60';

describe('REST vs GraphQL (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication()) as INestApplication<App>;
    await app.init();
  });

  beforeEach(async () => {
    await app.get<Cache>(CACHE_MANAGER).clear();
  });

  afterAll(() => app.close());

  const gql = (query: string, headers: Record<string, string> = {}) =>
    request(app.getHttpServer()).post('/graphql').set(headers).send({ query });

  describe('REST', () => {
    it('returns the full product with a public cache header', async () => {
      const res = await request(app.getHttpServer()).get('/v1/products/1').expect(200);
      expect(res.body).toMatchObject({ id: 1, name: 'Laptop Pro 14', price: 900, sellerId: 1 });
      expect(res.headers['cache-control']).toBe(PUBLIC);
      expect(res.headers['x-db-queries']).toBe('1');
    });

    it('uses status codes for errors and never caches them', async () => {
      const notFound = await request(app.getHttpServer()).get('/v1/products/999').expect(404);
      expect(notFound.headers['cache-control']).toBeUndefined();
      await request(app.getHttpServer()).get('/v1/products/abc').expect(400);
      await request(app.getHttpServer()).get('/v1/products?limit=1000').expect(400);
    });

    it('keeps v1 working while v2 changes the price shape', async () => {
      const v1 = await request(app.getHttpServer()).get('/v1/products/1').expect(200);
      const v2 = await request(app.getHttpServer()).get('/v2/products/1').expect(200);
      expect(v1.body.price).toBe(900);
      expect(v2.body.price).toEqual({ amount: 900, currency: 'USD' });
    });
  });

  describe('Server cache', () => {
    it('serves the second read from the cache, not the database', async () => {
      const first = await request(app.getHttpServer()).get('/v1/products/7').expect(200);
      const second = await request(app.getHttpServer()).get('/v1/products/7').expect(200);
      expect(first.headers['x-db-queries']).toBe('1');
      expect(first.headers['x-cache-status']).toBe('MISS');
      expect(second.headers['x-db-queries']).toBe('0');
      expect(second.headers['x-cache-status']).toBe('HIT');
      expect(first.headers['x-cache-info']).toBe('app | Redis MISS | 1 DB query');
      expect(second.headers['x-cache-info']).toBe('app | Redis HIT | 0 DB queries');
      expect(second.body).toEqual(first.body);
    });

    it('reports PARTIAL when only some of the data was cached', async () => {
      await request(app.getHttpServer()).get('/v1/products/7').expect(200);
      const res = await gql('{ product(id: 7) { name seller { name } } }').expect(200);
      expect(res.headers['x-cache-status']).toBe('PARTIAL');
      expect(res.headers['x-db-queries']).toBe('1');
    });

    it('is shared by REST and GraphQL', async () => {
      await request(app.getHttpServer()).get('/v1/products/7').expect(200);
      const res = await gql('{ product(id: 7) { name } }').expect(200);
      expect(res.headers['x-db-queries']).toBe('0');
    });

    it('is skipped with X-Cache: off', async () => {
      await request(app.getHttpServer()).get('/v1/products/7').expect(200);
      const res = await request(app.getHttpServer())
        .get('/v1/products/7')
        .set('x-cache', 'off')
        .expect(200);
      expect(res.headers['x-db-queries']).toBe('1');
      expect(res.headers['x-cache-status']).toBe('BYPASS');
    });
  });

  describe('GraphQL', () => {
    it('returns only the requested fields in one request', async () => {
      const res = await gql(
        '{ product(id: 1) { name priceMoney { amount } seller { name } reviews(last: 3) { rating } } }',
      ).expect(200);
      expect(res.body.data.product).toEqual({
        name: 'Laptop Pro 14',
        priceMoney: { amount: 900 },
        seller: { name: 'Ahmed Store' },
        reviews: [{ rating: 4 }, { rating: 5 }, { rating: 3 }],
      });
      expect(res.headers['cache-control']).toBe(PUBLIC);
    });

    it('returns null with 200 for a missing product', async () => {
      const res = await gql('{ product(id: 999) { name } }').expect(200);
      expect(res.body).toEqual({ data: { product: null } });
    });

    it('has N+1 without DataLoader and batches with it', async () => {
      const query = '{ products(first: 20) { name seller { name } } }';
      const withoutLoader = await gql(query, { 'x-dataloader': 'off', 'x-cache': 'off' }).expect(200);
      const withLoader = await gql(query, { 'x-cache': 'off' }).expect(200);
      expect(withoutLoader.headers['x-db-queries']).toBe('21');
      expect(withLoader.headers['x-db-queries']).toBe('2');
      expect(withLoader.body).toEqual(withoutLoader.body);
    });

    it('rejects queries that are too complex', async () => {
      const res = await gql(
        '{ products(first: 100) { name seller { name } reviews(last: 3) { rating comment } } }',
      ).expect(400);
      expect(res.body.errors[0].extensions.code).toBe('QUERY_TOO_COMPLEX');
      expect(res.headers['x-db-queries']).toBe('0');
    });

    it('rejects unknown fields before touching the database', async () => {
      const res = await gql('{ product(id: 1) { cost } }').expect(400);
      expect(res.body.errors[0].extensions.code).toBe('GRAPHQL_VALIDATION_FAILED');
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['x-db-queries']).toBe('0');
    });

    it('serves a persisted query over GET with a cache header', async () => {
      const query = '{ product(id: 1) { name } }';
      const sha256Hash = createHash('sha256').update(query).digest('hex');
      const extensions = JSON.stringify({ persistedQuery: { version: 1, sha256Hash } });
      const get = () =>
        request(app.getHttpServer())
          .get('/graphql')
          .query({ extensions })
          .set('apollo-require-preflight', 'true');

      const notYet = await get();
      expect(notYet.body.errors[0].extensions.code).toBe('PERSISTED_QUERY_NOT_FOUND');
      expect(notYet.headers['cache-control']).toBe('no-store');

      await request(app.getHttpServer())
        .post('/graphql')
        .send({ query, extensions: JSON.parse(extensions) })
        .expect(200);

      const cached = await get().expect(200);
      expect(cached.body).toEqual({ data: { product: { name: 'Laptop Pro 14' } } });
      expect(cached.headers['cache-control']).toBe(PUBLIC);
    });
    it('serves a persisted query with variables, so one hash covers every product', async () => {
      const query = 'query ProductPage($id: Int!) { product(id: $id) { name description } }';
      const sha256Hash = createHash('sha256').update(query).digest('hex');
      const extensions = { persistedQuery: { version: 1, sha256Hash } };
      await request(app.getHttpServer())
        .post('/graphql')
        .send({ query, variables: { id: 1 }, extensions })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/graphql')
        .query({ extensions: JSON.stringify(extensions), variables: JSON.stringify({ id: 2 }) })
        .set('apollo-require-preflight', 'true')
        .expect(200);
      expect(res.body.data.product).toEqual({
        name: 'Phone X',
        description: 'Phone X with a one-year warranty',
      });
      expect(res.headers['cache-control']).toBe(PUBLIC);
    });

    it('serves a query sent in the URL with GET as cacheable', async () => {
      const res = await request(app.getHttpServer())
        .get('/graphql')
        .query({ query: '{ product(id: 1) { name description } }' })
        .set('apollo-require-preflight', 'true')
        .expect(200);
      expect(res.body.data.product.name).toBe('Laptop Pro 14');
      expect(res.headers['cache-control']).toBe(PUBLIC);
    });
  });

  describe('Editing a description', () => {
    // Product 30 is not used by the other tests, since the edit stays in memory.
    const ID = 30;

    it('clears the server cache, so the next read is fresh and REST writes are not cached', async () => {
      const before = await request(app.getHttpServer()).get(`/v1/products/${ID}`).expect(200);
      const list = await request(app.getHttpServer()).get('/v1/products?limit=50').expect(200);
      expect(list.headers['x-cache-status']).toBe('MISS');

      const patch = await request(app.getHttpServer())
        .patch(`/v1/products/${ID}`)
        .send({ description: 'Edited from REST' })
        .expect(200);
      expect(patch.body.description).toBe('Edited from REST');
      expect(patch.headers['cache-control']).toBeUndefined();

      const after = await request(app.getHttpServer()).get(`/v1/products/${ID}`).expect(200);
      expect(after.body.description).toBe('Edited from REST');
      expect(after.body.description).not.toBe(before.body.description);
      expect(after.headers['x-cache-status']).toBe('MISS');

      const listAfter = await request(app.getHttpServer()).get('/v1/products?limit=50').expect(200);
      expect(listAfter.headers['x-cache-status']).toBe('MISS');
      expect(listAfter.body[ID - 1].description).toBe('Edited from REST');
    });

    it('edits through a GraphQL mutation, which is never cacheable', async () => {
      await gql(`{ product(id: ${ID}) { description } }`).expect(200);
      const res = await gql(
        `mutation { updateProductDescription(id: ${ID}, description: "Edited from GraphQL") { description } }`,
      ).expect(200);
      expect(res.body.data.updateProductDescription.description).toBe('Edited from GraphQL');
      expect(res.headers['cache-control']).toBe('no-store');

      const read = await gql(`{ product(id: ${ID}) { description } }`).expect(200);
      expect(read.body.data.product.description).toBe('Edited from GraphQL');
      expect(read.headers['x-cache-status']).toBe('MISS');
    });

    it('rejects an empty description', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/products/${ID}`)
        .send({ description: '' })
        .expect(400);
    });
  });
});
