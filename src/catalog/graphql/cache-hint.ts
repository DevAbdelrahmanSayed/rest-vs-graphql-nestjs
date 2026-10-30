import { maybeCacheControlFromInfo } from '@apollo/cache-control-types';
import type { GraphQLResolveInfo } from 'graphql';
import { PUBLIC_MAX_AGE_SECONDS } from '../../common/cache-policy.js';

/**
 * Apollo only treats a response as public when every object field in it has a
 * hint, so each public resolver marks itself here.
 */
export function cachePublicly(info: GraphQLResolveInfo): void {
  maybeCacheControlFromInfo(info)?.setCacheHint({
    maxAge: PUBLIC_MAX_AGE_SECONDS,
    scope: 'PUBLIC',
  });
}
