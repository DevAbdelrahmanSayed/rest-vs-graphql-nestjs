import {
  Args,
  Context,
  Info,
  Int,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import type { GraphQLResolveInfo } from 'graphql';
import type { ProductRow, ReviewRow, SellerRow } from '../../database/rows.js';
import { CatalogService } from '../catalog.service.js';
import { ProductsArgs, ReviewsArgs, UpdateDescriptionArgs } from '../dto/catalog.inputs.js';
import { Money, Product, Review, Seller } from '../models/catalog.models.js';
import { cachePublicly } from './cache-hint.js';
import type { Loaders } from './loaders.js';

@Resolver(() => Product)
export class ProductsResolver {
  constructor(private readonly catalog: CatalogService) {}

  // A missing product is `null`, not an error: the HTTP status stays 200.
  @Query(() => Product, { nullable: true })
  async product(
    @Args('id', { type: () => Int }) id: number,
    @Info() info: GraphQLResolveInfo,
  ): Promise<ProductRow | null> {
    cachePublicly(info);
    return (await this.catalog.findProduct(id)) ?? null;
  }

  @Query(() => [Product], {
    complexity: ({ args, childComplexity }) => args.first * childComplexity,
  })
  products(
    @Args() { first }: ProductsArgs,
    @Info() info: GraphQLResolveInfo,
  ): Promise<ProductRow[]> {
    cachePublicly(info);
    return this.catalog.listProducts(first);
  }

  // No cache hint, so the response is `no-store`. No auth: demo only.
  @Mutation(() => Product, { nullable: true })
  async updateProductDescription(
    @Args() { id, description }: UpdateDescriptionArgs,
  ): Promise<ProductRow | null> {
    return (await this.catalog.updateDescription(id, description)) ?? null;
  }

  @ResolveField(() => Money)
  priceMoney(@Parent() product: ProductRow, @Info() info: GraphQLResolveInfo): Money {
    cachePublicly(info);
    return { amount: product.price, currency: product.currency };
  }

  @ResolveField(() => Seller)
  seller(
    @Parent() product: ProductRow,
    @Context('loaders') loaders: Loaders,
    @Info() info: GraphQLResolveInfo,
  ): Promise<SellerRow> {
    cachePublicly(info);
    return loaders.sellers.load(product.sellerId);
  }

  @ResolveField(() => [Review], {
    complexity: ({ args, childComplexity }) => args.last * childComplexity,
  })
  reviews(
    @Parent() product: ProductRow,
    @Args() { last }: ReviewsArgs,
    @Context('loaders') loaders: Loaders,
    @Info() info: GraphQLResolveInfo,
  ): Promise<ReviewRow[]> {
    cachePublicly(info);
    return loaders.latestReviews(last).load(product.id);
  }
}
