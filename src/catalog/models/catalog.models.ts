import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Money {
  @Field(() => Int)
  amount: number;

  @Field()
  currency: string;
}

@ObjectType()
export class Seller {
  @Field(() => Int)
  id: number;

  @Field()
  name: string;

  @Field(() => Float)
  rating: number;
}

@ObjectType()
export class Review {
  @Field(() => Int)
  id: number;

  @Field()
  author: string;

  @Field(() => Int)
  rating: number;

  @Field()
  comment: string;
}

/** `seller`, `reviews` and `priceMoney` are resolved in ProductsResolver. */
@ObjectType()
export class Product {
  @Field(() => Int)
  id: number;

  @Field()
  name: string;

  @Field()
  description: string;

  @Field(() => Int, { deprecationReason: 'Use priceMoney, which includes the currency.' })
  price: number;

  @Field(() => Int)
  stock: number;
}
