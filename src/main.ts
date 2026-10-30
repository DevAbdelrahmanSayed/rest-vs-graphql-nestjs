import { existsSync } from 'node:fs';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

if (existsSync('.env')) process.loadEnvFile();

// Imported after .env is loaded so REDIS_URL is visible to the cache module.
const { AppModule } = await import('./app.module.js');
const { configureApp } = await import('./app.setup.js');

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create(AppModule, {
    // `debug` prints every SQL query, which is how you watch N+1 happen.
    logger: isProduction ? ['log', 'warn', 'error'] : ['log', 'warn', 'error', 'debug'],
  });
  configureApp(app);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  Logger.log(`REST:    http://localhost:${port}/v1/products/1`, 'Bootstrap');
  Logger.log(`GraphQL: http://localhost:${port}/graphql`, 'Bootstrap');
}
await bootstrap();
