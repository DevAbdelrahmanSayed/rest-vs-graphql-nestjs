import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PublicCacheInterceptor } from '../../common/public-cache.interceptor.js';
import type { SellerRow } from '../../database/rows.js';
import { CatalogService } from '../catalog.service.js';

@Controller({ path: 'sellers', version: '1' })
@UseGuards(ThrottlerGuard)
@UseInterceptors(PublicCacheInterceptor)
export class SellersController {
  constructor(private readonly catalog: CatalogService) {}

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<SellerRow> {
    const seller = await this.catalog.findSeller(id);
    if (!seller) throw new NotFoundException(`Seller ${id} not found`);
    return seller;
  }
}
