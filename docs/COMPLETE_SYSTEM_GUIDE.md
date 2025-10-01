# Complete Order & Payment System Guide

## Overview

This comprehensive guide covers the complete dine-in orders system with Stripe payment integration, including database schema, implementation details, setup instructions, and demo procedures.

## System Architecture

### Components
- **Order Management** - Database schema and business logic
- **Payment Processing** - Stripe integration with webhooks
- **Frontend Interface** - React components and user experience
- **API Layer** - Server actions and webhook handlers
- **Database** - PostgreSQL with Drizzle ORM

### Technology Stack
- **Frontend**: Next.js 15 (App Router) + Tailwind CSS
- **Backend**: Next.js Server Actions + PostgreSQL
- **Payments**: Stripe API + Stripe Elements
- **Database**: Drizzle ORM + PostgreSQL
- **Validation**: Zod schemas

## Database Schema

### Core Tables

#### Orders Table (`dine_in_orders`)
```sql
CREATE TABLE dine_in_orders (
  id BIGSERIAL PRIMARY KEY,
  hotel_id BIGINT REFERENCES hotels(id),
  restaurant_id BIGINT REFERENCES dine_in_restaurants(id),
  user_id BIGINT,
  room_number VARCHAR(255) NOT NULL,
  special_instructions TEXT,
  total_amount NUMERIC(10,2) NOT NULL,
  order_status VARCHAR(50) DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Order Items Table (`dine_in_order_items`)
```sql
CREATE TABLE dine_in_order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES dine_in_orders(id),
  menu_item_id BIGINT REFERENCES menu_items(id),
  menu_item_guid UUID NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  item_description TEXT,
  base_price NUMERIC(10,2) NOT NULL,
  modifier_price NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL,
  total_price NUMERIC(10,2) NOT NULL,
  modifier_details JSONB,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Payments Table (`dine_in_payments`)
```sql
CREATE TABLE dine_in_payments (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES dine_in_orders(id),
  stripe_payment_intent_id VARCHAR(255) NOT NULL,
  amount VARCHAR(20) NOT NULL,
  currency VARCHAR(3) DEFAULT 'usd',
  payment_status VARCHAR(50) DEFAULT 'pending',
  stripe_metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Hotels Table (Updated)
```sql
ALTER TABLE hotels ADD COLUMN stripe_account_id VARCHAR(255);
```

## Order Management System

### Order Status Flow
```
pending → confirmed → processing → ready → delivered
   ↓         ↓           ↓
cancelled  cancelled  cancelled
   ↓
payment_failed
```

### Key Features
- **Price Snapshots** - Store menu item details at order time
- **Modifier Support** - Complex menu items with options and pricing
- **Room Service Ready** - Room numbers and special instructions
- **Multi-hotel Support** - Each hotel has its own Stripe account
- **Order Tracking** - Complete audit trail of order changes

### Modifier Storage
```json
{
  "modifier_details": [
    {
      "groupId": "size-uuid",
      "groupName": "Size",
      "options": [
        {
          "optionId": "large-uuid",
          "optionName": "Large",
          "optionPrice": "2.50"
        }
      ]
    }
  ]
}
```

## Payment System

### Stripe Integration Architecture

#### Why Webhooks Are Essential
Even though we directly charge the card, webhooks are crucial because:
1. **Payment processing is asynchronous** - `stripe.paymentIntents.confirm()` is just a request
2. **Edge cases** - Fraud detection, bank rejections, server crashes
3. **Data integrity** - Webhook is the definitive source of truth
4. **Industry standard** - Used by all major payment processors

#### Correct Payment Pattern
```typescript
// 1. Direct charging (optimistic)
const result = await stripe.paymentIntents.confirm(paymentIntentId);
if (result.status === 'succeeded') {
  // Create payment record with 'processing' status
  const paymentRecord = await db.insert(dineInPayments).values({
    paymentStatus: 'processing', // NOT 'succeeded'!
    // ...
  });
  // Show success to user immediately
  router.push('/success');
}

// 2. Webhook (definitive) - happens separately
// When webhook receives payment_intent.succeeded:
// - Update paymentStatus to 'succeeded'
// - Update orderStatus to 'confirmed'
// - Trigger fulfillment
```

### Payment Status Flow
```
pending → processing → succeeded (via webhook)
   ↓
failed (via webhook)
```

### Webhook Events
| Event | Description | Action |
|-------|-------------|---------|
| `payment_intent.succeeded` | Payment completed successfully | Mark order as confirmed, trigger fulfillment |
| `payment_intent.payment_failed` | Payment failed | Mark order as cancelled |
| `payment_intent.canceled` | Payment canceled | Mark order as cancelled |

## Implementation Details

### Server Actions

#### Order Management
- `createOrderAndPaymentIntent()` - Create order + Stripe payment intent
- `confirmPayment()` - Process payment with Stripe Elements
- `getOrderForFulfillment()` - Get order details for fulfillment
- `updateFulfillmentStatus()` - Update order status

#### Payment Processing
- `createOrderAndPaymentIntent()` - Create order + Stripe payment intent
- `confirmPayment()` - Process payment with Stripe Elements
- Webhook handlers for payment events

### Frontend Components

#### Payment Form (`StripePaymentForm.tsx`)
- Stripe Elements integration
- Separate card input fields (number, expiry, CVC)
- Real-time validation
- Error handling and user feedback

#### Order Management
- Cart management with modifiers
- Checkout flow
- Order confirmation
- Success notifications

## Setup Instructions

### 1. Environment Variables
Create `.env.local` file:
```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/database_name

# Stripe (Server-side)
STRIPE_SECRET_KEY=sk_test_...

# Stripe (Client-side)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Stripe Webhook
STRIPE_WEBHOOK_SECRET=whsec_...

# Other required variables
BASE_URL=http://localhost:3000
GOOGLE_API_KEY=your_google_api_key
OPENAI_API_KEY=your_openai_api_key
BETTER_AUTH_SECRET=your_better_auth_secret_32_chars_minimum
```

### 2. Database Setup
```bash
# Generate migrations
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database
npm run db:seed
```

### 3. Stripe Configuration

#### Local Development
```bash
# Install ngrok for webhook testing
npm install -g ngrok

# Start your app
npm run dev

# Expose local server
ngrok http 3000
```

#### Stripe Dashboard Setup
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-ngrok-url.ngrok.io/api/webhooks/stripe`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
4. Copy webhook secret to environment variables

### 4. Testing
```bash
# Test webhook endpoint
npm run test:webhook-url

# Test payment flow
npm run test:webhook

# Test database operations
npm run test:db

# Test integration
npm run test:integration
```

## Demo Guide

### Demo-Ready Features
- ✅ **Stripe SDK Integration** - Full payment processing
- ✅ **Database Schema** - Orders, items, and payments tables
- ✅ **Server Actions** - Order creation and payment processing
- ✅ **Frontend Components** - Payment forms and checkout flow
- ✅ **Test Suite** - Comprehensive testing with corner cases

### Demo Flow
1. **Menu Selection** → Add items to cart with modifiers
2. **Checkout** → Creates order in database
3. **Payment Page** → Stripe payment form
4. **Payment Processing** → Real Stripe test payments
5. **Success Page** → Order confirmation

### Test Cards
- **Success**: `4242 4242 4242 4242`
- **Declined**: `4000 0000 0000 0002`
- **Insufficient Funds**: `4000 0000 0000 9995`

### Demo Script (5 minutes)

#### Opening (30 seconds):
> "I'm going to show you our new room service ordering system with integrated payments. This is a complete solution that handles everything from menu selection to payment processing."

#### Menu Demo (1 minute):
> "Here's our restaurant menu. You can browse items, see descriptions, and add them to your cart. Notice how we handle complex items with modifiers - like this burger where you can choose bun type, add extra patties, etc."

#### Cart Demo (30 seconds):
> "The cart shows your selections with all modifiers and calculates totals automatically. You can adjust quantities or remove items."

#### Checkout Demo (1 minute):
> "When you're ready, click checkout. You enter your room number and any special instructions. The system creates an order in our database."

#### Payment Demo (1 minute):
> "Now you're taken to our secure payment page powered by Stripe. I'll use a test card to show you the flow. [Enter 4242 4242 4242 4242] The payment processes in real-time."

#### Success Demo (30 seconds):
> "Payment successful! The order is confirmed, status updated in our database, and you get a confirmation page. The kitchen can now see this order and start preparation."

#### Closing (30 seconds):
> "This is a complete, production-ready system. We can customize the UI, add more payment methods, integrate with your hotel management system, and scale to multiple properties."

## API Endpoints

### Webhook Endpoint
**POST** `/api/webhooks/stripe`
- Receives Stripe webhook events
- Verifies webhook signatures
- Updates order and payment status
- Triggers fulfillment process

### Server Actions
- `createOrderAndPaymentIntent()` - Create order + Stripe payment intent
- `confirmPayment()` - Process payment with Stripe Elements
- `processOrderFulfillment()` - Handle order fulfillment
- `updateFulfillmentStatus()` - Update order status

## Error Handling

### Common Issues
1. **Invalid webhook signature** - Check webhook secret
2. **Order not found** - Verify order ID in metadata
3. **Database errors** - Check connection and schema
4. **Payment failures** - Handle gracefully with user feedback

### Troubleshooting
```bash
# Check webhook endpoint
npm run test:webhook-url

# Test Stripe integration
npm run test:webhook

# Check database connection
npm run test:db
```

## Security

### Webhook Security
- Always verify webhook signatures
- Use HTTPS for webhook endpoints
- Validate all incoming data
- Implement rate limiting

### Data Protection
- Encrypt sensitive data in database
- Use secure environment variables
- Implement proper access controls

## Production Deployment

### 1. Update Webhook URL
```
https://yourdomain.com/api/webhooks/stripe
```

### 2. Environment Variables
```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 3. Monitoring
- Track webhook success rates
- Monitor order fulfillment times
- Set up alerts for payment failures

## Key Takeaways

1. **Webhooks are essential** - They ensure data integrity and handle edge cases
2. **Direct charging is optimistic** - Shows immediate feedback to users
3. **Webhook is definitive** - Only webhook can confirm payment success
4. **Status management** - Orders stay 'pending' until webhook confirms
5. **Industry standard** - Follows payment processor best practices

The system ensures no unpaid orders are fulfilled while providing excellent user experience through immediate feedback and reliable webhook processing.

## Support

If you encounter any issues:
1. Check the browser console for errors
2. Run `npm run test:webhook` to verify Stripe connection
3. Check database connection with `npm run test:db`
4. Verify webhook configuration in Stripe Dashboard

**🎉 The system is fully functional and ready for production use!**

