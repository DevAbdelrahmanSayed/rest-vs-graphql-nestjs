import { ApolloServerPluginCacheControl } from '@apollo/server/plugin/cacheControl';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { createKeyv } from '@keyv/redis';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { CacheModule, type CacheModuleOptions } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';
import depthLimit from 'graphql-depth-limit';
import { CatalogModule } from './catalog/catalog.module.js';
import { ComplexityPlugin } from './catalog/graphql/complexity.plugin.js';
import { LoadersFactory, type GraphqlContext } from './catalog/graphql/loaders.js';
import { SharedCachePlugin } from './catalog/graphql/shared-cache.plugin.js';
import { DatabaseModule } from './database/database.module.js';

const MAX_QUERY_DEPTH = 5;

@Module({
  imports: [
    DatabaseModule,
    // Server cache in front of the database: Redis when REDIS_URL is set, memory otherwise.
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: (): CacheModuleOptions => {
        const redisUrl = process.env.REDIS_URL;
        return redisUrl ? { stores: [createKeyv(redisUrl)] } : {};
      },
    }),
    // REST is rate limited per request: 100 requests per minute per IP.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [CatalogModule],
      inject: [LoadersFactory],
      useFactory: (loaders: LoadersFactory) => ({
        autoSchemaFile: true,
        sortSchema: true,
        playground: false,
        plugins: [
          ApolloServerPluginLandingPageLocalDefault(),
          // Still works out the cache policy; SharedCachePlugin writes the header.
          ApolloServerPluginCacheControl({ calculateHttpHeaders: false }),
        ],
        validationRules: [depthLimit(MAX_QUERY_DEPTH)],
        context: ({ req }: { req: Request }): GraphqlContext => ({
          loaders: loaders.create(req.header('x-dataloader') !== 'off'),
        }),
      }),
    }),
    CatalogModule,
  ],
  providers: [ComplexityPlugin, SharedCachePlugin],
})
export class AppModule {}
