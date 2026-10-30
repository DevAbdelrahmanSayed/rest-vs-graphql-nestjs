export interface ProductRow {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  stock: number;
  sku: string;
  sellerId: number;
  images: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SellerRow {
  id: number;
  name: string;
  email: string;
  rating: number;
  verified: boolean;
  joinedAt: string;
}

export interface ReviewRow {
  id: number;
  productId: number;
  author: string;
  rating: number;
  comment: string;
  createdAt: string;
}
