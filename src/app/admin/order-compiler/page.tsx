import {
  getOrderCompilerRestaurants,
  type OrderCompilerRestaurantOption,
} from '@/actions/order-compiler';
import { OrderCompilerClient } from './order-compiler-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function OrderCompilerPage() {
  const restaurantsResult = await getOrderCompilerRestaurants();
  const restaurants: OrderCompilerRestaurantOption[] =
    restaurantsResult.ok ? restaurantsResult.data : [];

  return <OrderCompilerClient restaurants={restaurants} />;
}
