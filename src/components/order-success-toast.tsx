'use client';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

export default function OrderSuccessToast() {
  const hasShownToast = useRef(false);

  useEffect(() => {
    if (hasShownToast.current) return;

    const urlParams = new URLSearchParams(window.location.search);
    const orderSuccess = urlParams.get('orderSuccess');
    const _orderId = urlParams.get('orderId');
    const _paymentId = urlParams.get('paymentId');

    if (orderSuccess === 'true') {
      hasShownToast.current = true;

            toast.success('Payment Processing', {
              description: 'Your payment is being processed. You will receive confirmation once it\'s complete.',
              duration: 4000,
        className: 'border-amber-200 bg-white text-black shadow-lg',
        style: {
          border: '1px solid #fbbf24',
          backgroundColor: 'white',
          color: 'black',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        },
      });

      // Clean up URL parameters
      const url = new URL(window.location.href);
      url.searchParams.delete('orderSuccess');
      url.searchParams.delete('orderId');
      url.searchParams.delete('paymentId');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  return null;
}
