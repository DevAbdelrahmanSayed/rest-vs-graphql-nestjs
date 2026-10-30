import type {
  ApolloServerPlugin,
  BaseContext,
  GraphQLRequestListener,
} from '@apollo/server';
import { Plugin } from '@nestjs/apollo';
import { sharedCacheControl } from '../../common/cache-policy.js';

/**
 * Apollo's own header is `max-age=60, public`, which a browser would also keep
 * for a minute. This writes the same header as REST instead. Apollo's header is
 * turned off in app.module.ts, but it still works out the cache policy.
 *
 * Responses with errors, mutations and anything not marked public get
 * `no-store`, so a CDN never keeps them.
 */
@Plugin()
export class SharedCachePlugin implements ApolloServerPlugin {
  async requestDidStart(): Promise<GraphQLRequestListener<BaseContext>> {
    return {
      async willSendResponse({ response, overallCachePolicy }) {
        const policy = overallCachePolicy.policyIfCacheable();
        const cacheable =
          policy?.scope === 'PUBLIC' &&
          response.body.kind === 'single' &&
          !response.body.singleResult.errors;
        response.http.headers.set(
          'cache-control',
          cacheable ? sharedCacheControl(policy.maxAge) : 'no-store',
        );
      },
    };
  }
}
