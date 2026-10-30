import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PublicCacheInterceptor } from '../../common/public-cache.interceptor.js';
import type { ProductRow, ReviewRow } from '../../database/rows.js';
import { CatalogService } from '../catalog.service.js';
import {
  LatestReviewsQueryDto,
  ListProductsQueryDto,
  UpdateDescriptionDto,
} from '../dto/catalog.inputs.js';

@Controller({ path: 'products', version: '1' })
@UseGuards(ThrottlerGuard)
@UseInterceptors(PublicCacheInterceptor)
export class ProductsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@Query() { limit }: ListProductsQueryDto): Promise<ProductRow[]> {
    return this.catalog.listProducts(limit);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<ProductRow> {
    const product = await this.catalog.findProduct(id);
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  // No auth: this is a demo endpoint for trying the cache timeline locally.
  @Patch(':id')
  async updateDescription(
    @Param('id', ParseIntPipe) id: number,
    @Body() { description }: UpdateDescriptionDto,
  ): Promise<ProductRow> {
    const product = await this.catalog.updateDescription(id, description);
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  @Get(':id/reviews')
  latestReviews(
    @Param('id', ParseIntPipe) id: number,
    @Query() { last }: LatestReviewsQueryDto,
  ): Promise<ReviewRow[]> {
    return this.catalog.latestReviews(id, last);
  }
}

/** v2 changes the shape of `price`; v1 keeps working for old app versions. */
@Controller({ path: 'products', version: '2' })
@UseGuards(ThrottlerGuard)
@UseInterceptors(PublicCacheInterceptor)
export class ProductsV2Controller {
  constructor(private readonly catalog: CatalogService) {}

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const product = await this.catalog.findProduct(id);
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    const { price, currency, ...rest } = product;
    return { ...rest, price: { amount: price, currency } };
  }
}
