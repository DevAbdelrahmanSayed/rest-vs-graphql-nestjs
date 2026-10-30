import { type INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { requestContextMiddleware } from './common/request-context.js';

/** Shared by main.ts and the e2e tests so both run the same app. */
export function configureApp(app: INestApplication): INestApplication {
  app.use(requestContextMiddleware);
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();
  return app;
}
