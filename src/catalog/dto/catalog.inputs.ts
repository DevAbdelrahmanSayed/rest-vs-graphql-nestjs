import { ArgsType, Field, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const MAX_PAGE_SIZE = 100;
export const MAX_REVIEWS = 20;
export const MAX_DESCRIPTION_LENGTH = 2000;

// REST query strings

export class ListProductsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit = 20;
}

export class LatestReviewsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_REVIEWS)
  last = 3;
}

export class UpdateDescriptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_DESCRIPTION_LENGTH)
  description: string;
}

// GraphQL arguments

@ArgsType()
export class ProductsArgs {
  @Field(() => Int, { defaultValue: 10 })
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  first = 10;
}

@ArgsType()
export class ReviewsArgs {
  @Field(() => Int, { defaultValue: 3 })
  @IsInt()
  @Min(1)
  @Max(MAX_REVIEWS)
  last = 3;
}

@ArgsType()
export class UpdateDescriptionArgs {
  @Field(() => Int)
  @IsInt()
  id: number;

  @Field()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_DESCRIPTION_LENGTH)
  description: string;
}
