export const TIP_PAYMENT_STATUS = {
  pending: 'pending',
  completed: 'completed',
  failed: 'failed',
} as const;

export type TipPaymentStatus =
  (typeof TIP_PAYMENT_STATUS)[keyof typeof TIP_PAYMENT_STATUS];


