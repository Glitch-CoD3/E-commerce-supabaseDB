'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation.js';

import { getOrderDetailsByOrderId } from '../../../../../services/order.service.js';
import OrderDetails from '../../../../../components/admin_dashboard/OrderDetails.jsx';

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();

  const orderId = params?.id;

  const [orderDetails, setOrderDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orderId) return;

    let isMounted = true;

    const fetchOrderDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await getOrderDetailsByOrderId(orderId);

        if (!isMounted) return;

        if (!response?.success) {
          throw new Error(response?.message || 'Failed to fetch order details');
        }

        setOrderDetails(response.order_details);
      } catch (err) {
        if (isMounted) {
          setError(err?.message || 'Failed to fetch order details');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchOrderDetails();

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  // Loading State
  if (loading) {
    return (
      <div className="flex min-h-100 flex-col items-center justify-center space-y-3 text-slate-400">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <p className="text-xs font-medium">Loading order #{orderId}...</p>
      </div>
    );
  }

  // Error State
  if (error || !orderDetails) {
    return (
      <div className="mx-auto my-12 max-w-md rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-center space-y-4">
        <p className="text-xs font-medium text-rose-400">
          {error || 'Order details not found.'}
        </p>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition cursor-pointer"
        >
          ← Back to Orders
        </button>
      </div>
    );
  }

  const { order, customer, items, shippingAddress } = orderDetails;

  return (
    <div className="min-h-screen w-full flex flex-col p-4 sm:p-6 space-y-6 bg-slate-600 text-slate-100">
      {/* Top Header / Back Button */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-800 pb-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-all cursor-pointer"
        >
          ← Back to Orders
        </button>
        <span className="font-mono text-xs text-slate-400">
          ID: {orderId}
        </span>
      </div>

      {/* View Component Call Container */}
      <div className="flex-1 w-full min-h-0 flex flex-col">
        <OrderDetails
          order={order}
          items={items}
          shippingAddress={shippingAddress}
          customer={customer}
        />
      </div>
    </div>
  );
}