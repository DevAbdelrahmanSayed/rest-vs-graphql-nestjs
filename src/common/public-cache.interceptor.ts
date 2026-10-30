import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { type Observable, tap } from 'rxjs';
import { PUBLIC_MAX_AGE_SECONDS, sharedCacheControl } from './cache-policy.js';

/**
 * Sets the public cache header only on successful GET responses. `@Header()`
 * would also tag 404s and validation errors, letting a CDN cache them, and a
 * write like PATCH must never be cached.
 */
@Injectable()
export class PublicCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    if (http.getRequest<Request>().method !== 'GET') return next.handle();

    return next.handle().pipe(
      tap(() => {
        http
          .getResponse<Response>()
          .setHeader('Cache-Control', sharedCacheControl(PUBLIC_MAX_AGE_SECONDS));
      }),
    );
  }
}
