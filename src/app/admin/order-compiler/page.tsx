import { getOrderCompilerRestaurants } from '@/actions/order-compiler';
import { type OrderCompilerRestaurantOption } from '@/lib/orders/order-compiler-types';
import { OrderCompilerClient } from './order-compiler-client';

export const dynamic = 'force-dynamic';

export default async function OrderCompilerPage() {
  const restaurantsResult = await getOrderCompilerRestaurants();
  const restaurants: OrderCompilerRestaurantOption[] =
    restaurantsResult.ok ? restaurantsResult.data : [];

  return <OrderCompilerClient restaurants={restaurants} />;
}
