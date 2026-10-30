import type { ProductRow, ReviewRow, SellerRow } from './rows.js';

const SELLER_NAMES = [
  'Ahmed Store',
  'Nile Tech',
  'Cairo Gadgets',
  'Delta Shop',
  'Alex Market',
  'Giza Digital',
  'Sinai Mobile',
  'Aswan Electronics',
];
const PRODUCT_NAMES = [
  'Laptop Pro 14',
  'Phone X',
  'Headphones',
  'Keyboard',
  'Mouse',
  'Monitor 27',
  'Tablet 11',
  'Smart Watch',
  'Speaker',
  'Webcam',
];
const COMMENTS = [
  'Fast and light',
  'Great screen',
  'Worth it',
  'Good value',
  'Battery could be better',
];

export const sellers: SellerRow[] = SELLER_NAMES.map((name, i) => ({
  id: i + 1,
  name,
  email: `support@seller${i + 1}.example`,
  rating: 4 + (i % 10) / 10,
  verified: i % 3 !== 0,
  joinedAt: `2023-0${(i % 9) + 1}-01`,
}));

export const products: ProductRow[] = Array.from({ length: 50 }, (_, i) => {
  const id = i + 1;
  const name =
    PRODUCT_NAMES[i % PRODUCT_NAMES.length] +
    (i >= PRODUCT_NAMES.length ? ` v${Math.floor(i / PRODUCT_NAMES.length) + 1}` : '');
  return {
    id,
    name,
    slug: name.toLowerCase().replaceAll(' ', '-'),
    description: `${name} with a one-year warranty`,
    price: 900 - ((i * 137) % 850),
    currency: 'USD',
    stock: (i * 7) % 30,
    sku: `SKU-${String(id).padStart(4, '0')}`,
    sellerId: (i % sellers.length) + 1,
    images: [`/img/${id}-1.jpg`, `/img/${id}-2.jpg`],
    createdAt: '2026-01-12T09:30:00Z',
    updatedAt: '2026-10-20T14:02:11Z',
  };
});

export const reviews: ReviewRow[] = products.flatMap((product, p) =>
  COMMENTS.map((comment, j) => ({
    id: p * COMMENTS.length + j + 1,
    productId: product.id,
    author: ['Mona', 'Karim', 'Sara', 'Omar', 'Laila'][j],
    rating: 3 + ((product.id + j) % 3),
    comment,
    createdAt: `2026-10-${String(20 - j).padStart(2, '0')}T10:00:00Z`,
  })),
);
