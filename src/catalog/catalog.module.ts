import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { LoadersFactory } from './graphql/loaders.js';
import { ProductsResolver } from './graphql/products.resolver.js';
import { ProductsController, ProductsV2Controller } from './rest/products.controller.js';
import { SellersController } from './rest/sellers.controller.js';

@Module({
  controllers: [ProductsController, ProductsV2Controller, SellersController],
  providers: [CatalogService, LoadersFactory, ProductsResolver],
  exports: [LoadersFactory],
})
export class CatalogModule {}
