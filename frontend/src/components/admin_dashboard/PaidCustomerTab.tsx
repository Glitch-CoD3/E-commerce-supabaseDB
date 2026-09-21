'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { getAllPaidCustomers } from '../../services/order.service';
import { PaidCustomer } from '../../type';

type PaginationMeta = {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
};

type PaidCustomerTabProps = {
  initialCustomers?: PaidCustomer[];
  tableHeaderBg: string;
  borderRow: string;
};

// Formatted customer interface for O(1) render lookups
type ProcessedCustomer = PaidCustomer & {
  formattedDate: string;
  fullAddress: string;
  mobileAddress: string;
  totalPaidAmount: string;
  uniqueKey: string;
};

export default function PaidCustomerTab({
  initialCustomers,
  tableHeaderBg,
  borderRow,
}: PaidCustomerTabProps) {
  const [customers, setCustomers] = useState<PaidCustomer[]>(initialCustomers || []);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(!initialCustomers?.length);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Guard ref to ensure initial fetch runs strictly once on mount
  const isFetchedRef = useRef(false);

  // Fetch initial page or handle pagination
  const fetchCustomers = useCallback(async (pageNum: number, isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Pass target page number to API service
      const response = await getAllPaidCustomers(pageNum);

      const newCustomers = response?.data || response || [];
      const meta = response?.pagination || null;

      if (meta) {
        setPagination(meta);
      }

      if (isLoadMore) {
        setCustomers((prev) => [...prev, ...newCustomers]);
      } else {
        setCustomers(newCustomers);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load paid customer data.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Strict initial fetch controller
  useEffect(() => {
    if (!initialCustomers?.length && !isFetchedRef.current) {
      isFetchedRef.current = true;
      fetchCustomers(1);
    }
  }, [initialCustomers, fetchCustomers]);

  const handleLoadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchCustomers(nextPage, true);
  }, [page, fetchCustomers]);

  // Performance Optimization: Pre-calculate all formatted strings once in a single loop
  const processedCustomers: ProcessedCustomer[] = useMemo(() => {
    return customers.map((c) => {
      const formattedDate = c.lastOrderDate
        ? new Date(c.lastOrderDate).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        : 'N/A';

      const fullAddress = [
        c.shippingAddress,
        c.shippingCity,
        c.shippingState,
        c.shippingZipCode,
      ]
        .filter(Boolean)
        .join(', ');

      const mobileAddress = [c.shippingAddress, c.shippingCity, c.shippingState]
        .filter(Boolean)
        .join(', ');

      const totalPaidAmount = parseFloat(c.totalPaid || '0').toFixed(2);

      return {
        ...c,
        formattedDate,
        fullAddress,
        mobileAddress,
        totalPaidAmount,
        uniqueKey: `${c.customerId}-${c.emailAddress}`,
      };
    });
  }, [customers]);

  const hasMorePages = useMemo(() => {
    return pagination ? page < pagination.totalPages : false;
  }, [pagination, page]);

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
        Loading paid customers...
      </div>
    );
  }

  if (error && customers.length === 0) {
    return (
      <div className="p-6 text-center text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl">
        {error}
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* ================= DESKTOP & LAPTOP VIEW (TABLE) ================= */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className={`text-xs uppercase font-bold border-b ${tableHeaderBg}`}>
            <tr>
              <th className="p-3">Customer Info</th>
              <th className="p-3">Contact</th>
              <th className="p-3">Shipping Address</th>
              <th className="p-3">Last Order Date</th>
              <th className="p-3 text-center">Paid Orders</th>
              <th className="p-3 text-right">Total Paid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/30">
            {processedCustomers.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-xs text-slate-400">
                  No paid customers found yet.
                </td>
              </tr>
            ) : (
              processedCustomers.map((c) => (
                <tr key={c.uniqueKey} className={`hover:bg-indigo-500/5 ${borderRow}`}>
                  <td className="p-3 font-bold text-slate-100">
                    <div>{c.customerName}</div>
                    <span className="text-[10px] font-normal text-slate-400">ID: #{c.customerId}</span>
                  </td>
                  <td className="p-3 text-xs">
                    <div className="text-indigo-400 font-mono">{c.emailAddress}</div>
                    {c.mobileNumber && (
                      <div className="text-slate-400 text-[11px] font-mono mt-0.5">{c.mobileNumber}</div>
                    )}
                  </td>
                  <td className="p-3 text-xs text-slate-400 max-w-xs truncate" title={c.fullAddress}>
                    {c.fullAddress || 'N/A'}
                  </td>
                  <td className="p-3 text-xs text-slate-300 font-mono">{c.formattedDate}</td>
                  <td className="p-3 text-center font-semibold">
                    <span className="inline-block px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 text-xs font-mono">
                      {c.totalPaidOrders}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono font-black text-emerald-400">
                    ${c.totalPaidAmount}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ================= MOBILE VIEW (CARDS) ================= */}
      <div className="block md:hidden space-y-3">
        {processedCustomers.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 border border-slate-800 rounded-xl">
            No paid customers found yet.
          </div>
        ) : (
          processedCustomers.map((c) => (
            <div
              key={c.uniqueKey}
              className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3"
            >
              <div className="flex items-start justify-between gap-2 border-b border-slate-800/60 pb-2">
                <div>
                  <h4 className="font-bold text-slate-100 text-sm">{c.customerName}</h4>
                  <div className="text-xs text-indigo-400 font-mono">{c.emailAddress}</div>
                  {c.mobileNumber && (
                    <div className="text-[11px] text-slate-400 font-mono">{c.mobileNumber}</div>
                  )}
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Paid Customer
                </span>
              </div>

              <div className="text-xs text-slate-400">
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Shipping Address</span>
                <p className="line-clamp-2">{c.mobileAddress || 'N/A'}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                <div className="bg-slate-800/40 p-2 rounded-lg col-span-1">
                  <span className="text-slate-400 block text-[10px] uppercase">Orders</span>
                  <span className="font-mono font-bold text-indigo-300">{c.totalPaidOrders}</span>
                </div>
                <div className="bg-slate-800/40 p-2 rounded-lg col-span-1">
                  <span className="text-slate-400 block text-[10px] uppercase">Last Order</span>
                  <span className="font-mono text-slate-200 text-[11px]">{c.formattedDate}</span>
                </div>
                <div className="bg-slate-800/40 p-2 rounded-lg col-span-1">
                  <span className="text-slate-400 block text-[10px] uppercase">Total Paid</span>
                  <span className="font-mono font-black text-emerald-400 text-xs">
                    ${c.totalPaidAmount}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ================= SEE MORE BUTTON ================= */}
      {hasMorePages && (
        <div className="flex flex-col items-center justify-center pt-2 pb-4">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-5 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-medium text-xs transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loadingMore ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin" />
                <span>Loading more...</span>
              </>
            ) : (
              <span>See More Customers</span>
            )}
          </button>

          {pagination && (
            <span className="text-[11px] text-slate-500 mt-2">
              Showing {customers.length} of {pagination.totalCount} customers
            </span>
          )}
        </div>
      )}
    </div>
  );
}