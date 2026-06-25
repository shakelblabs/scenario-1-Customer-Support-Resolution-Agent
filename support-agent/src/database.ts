import * as fs from 'fs';
import * as path from 'path';
import { Customer, Order } from './types';

const raw = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../src/data/support-tickets.json'), 'utf-8')
);

export const customers: Customer[] = raw.customers.map((c: any) => ({
  id: c.id,
  name: c.name,
  email: c.email,
  verified: false,
}));

export const orders: Order[] = raw.orders.map((o: any) => ({
  orderId: o.orderId,
  customerId: o.customerId,
  productName: o.product,
  brand: o.brand,
  amount: o.amount,
  purchaseDate: o.purchaseDate,
  status: 'delivered' as const,
  refundPolicy: o.refundPolicy,
}));

export const verifiedCustomers: Map<string, Customer> = new Map();
