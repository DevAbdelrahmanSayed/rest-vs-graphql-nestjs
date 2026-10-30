import { Injectable } from '@nestjs/common';
import DataLoader from 'dataloader';
import type { ReviewRow, SellerRow } from '../../database/rows.js';
import { CatalogService } from '../catalog.service.js';

export interface Loaders {
  sellers: DataLoader<number, SellerRow>;
  latestReviews(last: number): DataLoader<number, ReviewRow[]>;
}

export interface GraphqlContext {
  loaders: Loaders;
}

/**
 * Builds a fresh set of loaders for every GraphQL request, so batching and
 * caching never leak data between users.
 *
 * With `batching = false` each key gets its own query: that is the N+1 problem,
 * kept switchable (header `X-DataLoader: off`) so it can be compared in Postman.
 */
@Injectable()
export class LoadersFactory {
  constructor(private readonly catalog: CatalogService) {}

  create(batching: boolean): Loaders {
    const options = { batch: batching, cache: batching };
    const reviewLoaders = new Map<number, DataLoader<number, ReviewRow[]>>();

    return {
      sellers: new DataLoader((ids) => this.catalog.sellersByIds(ids), options),
      latestReviews: (last) => {
        let loader = reviewLoaders.get(last);
        if (!loader) {
          loader = new DataLoader(
            (ids) => this.catalog.latestReviewsByProductIds(ids, last),
            options,
          );
          reviewLoaders.set(last, loader);
        }
        return loader;
      },
    };
  }
}
