"use client";

import { updateOrderStatus, updatePaymentStatus } from "@/src/services/order.service";
import { useState, useEffect } from "react";
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  MapPin,
  Phone,
  Mail,
  Copy,
  Check,
  User,
  CreditCard,
  Loader2,
  RotateCcw,
  Printer
} from "lucide-react";
import { formatRelativeTime } from '../../services/timeformate';

const STATUS_CONFIG = {
  pending: { label: "Pending", badgeClass: "bg-amber-50 text-amber-700 ring-amber-600/20 print:bg-amber-100 print:text-amber-800", Icon: Clock },
  processing: { label: "Processing", badgeClass: "bg-blue-50 text-blue-700 ring-blue-700/10 print:bg-blue-100 print:text-blue-800", Icon: Package },
  shipped: { label: "Shipped", badgeClass: "bg-indigo-50 text-indigo-700 ring-indigo-700/10 print:bg-indigo-100 print:text-indigo-800", Icon: Truck },
  delivered: { label: "Delivered", badgeClass: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 print:bg-emerald-100 print:text-emerald-800", Icon: CheckCircle2 },
  confirmed: { label: "Confirmed", badgeClass: "bg-blue-50 text-blue-700 ring-blue-700/10 print:bg-blue-100 print:text-blue-800", Icon: CheckCircle2 },
  cancelled: { label: "Cancelled", badgeClass: "bg-rose-50 text-rose-700 ring-rose-600/10 print:bg-rose-100 print:text-rose-800", Icon: XCircle },
  returned: { label: "Returned", badgeClass: "bg-purple-50 text-purple-700 ring-purple-600/10 print:bg-purple-100 print:text-purple-800", Icon: RotateCcw },

  // Payment Status Enums
  PAID: { label: "Paid", badgeClass: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 print:bg-emerald-100 print:text-emerald-800", Icon: CheckCircle2 },
  UNPAID: { label: "Unpaid", badgeClass: "bg-rose-50 text-rose-700 ring-rose-600/10 print:bg-rose-100 print:text-rose-800", Icon: XCircle },

  paid: { label: "Paid", badgeClass: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 print:bg-emerald-100 print:text-emerald-800", Icon: CheckCircle2 },
  unpaid: { label: "Unpaid", badgeClass: "bg-rose-50 text-rose-700 ring-rose-600/10 print:bg-rose-100 print:text-rose-800", Icon: XCircle }
};

const formatCurrency = (value) => {
  const n = Number(value ?? 0);
  return `৳${n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (isoString) => {
  if (!isoString) return "—";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
};

function StatusBadge({ status }) {
  const key = String(status || "pending");
  const config = STATUS_CONFIG[key] || STATUS_CONFIG[key.toLowerCase()] || STATUS_CONFIG.pending;
  const { Icon } = config;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${config.badgeClass}`}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
}

function CopyableOrderNumber({ value }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Ignore copy errors
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-950 transition-colors bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md active:scale-95 duration-150 cursor-pointer print:bg-transparent print:p-0 print:text-slate-900"
      title="Click to copy order ID"
    >
      <span>{value}</span>
      <span className="print:hidden">
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}

export default function OrderDetails(props) {
  const order = props?.order?.[0] || props?.order || {};
  const items = props?.items || [];
  const shippingAddress = props?.shippingAddress || {};
  const customer = props?.customer || {};
  const productsVarient = props?.productsVarients || {};

  const id = order?.id;
  const initialPaymentStatus = order?.payment_status || "UNPAID";
  const orderNumber = order?.order_number || (order?.id ? `ORD-#${order.id}` : "N/A");
  const createdAt = order?.created_at || new Date().toISOString();
  const initialStatus = order?.status || order?.order_status || "pending";

  const subtotal = Number(order?.total_amount || 0);
  const discount = Number(order?.discount_amount || 0);
  const shippingFee = Number(order?.shipping_charge || 0);
  const net = Number(order?.net_amount || 0);

  const [currentStatus, setCurrentStatus] = useState(initialStatus);
  const [currentPaymentStatus, setCurrentPaymentStatus] = useState(initialPaymentStatus);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (order?.status) setCurrentStatus(order?.status);
    if (order?.payment_status) setCurrentPaymentStatus(order?.payment_status);
  }, [order?.status, order?.payment_status]);

  const onPaymentChange = async (newStatus) => {
    if (!id || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      await updatePaymentStatus(id, newStatus);
      setCurrentPaymentStatus(newStatus);
      if (props.onUpdatePaymentStatus) await props.onUpdatePaymentStatus(newStatus);
    } catch (error) {
      console.error("Failed to update payment status:", error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const onOrderChange = async (newStatus) => {
    if (!id || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      await updateOrderStatus(id, newStatus);
      setCurrentStatus(newStatus);
      if (props.onUpdateOrderStatus) await props.onUpdateOrderStatus(newStatus);
    } catch (error) {
      console.error("Failed to update order status:", error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getItemImage = (item) => item?.image_url;

  const getVariantData = (item) => {
    const variantId = item?.product_variant_id;
    const variantObj = productsVarient?.[variantId]?.product_varient;
    return {
      color: variantObj?.colors || null,
      size: variantObj?.sizes || null
    };
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-full w-full overflow-hidden rounded-2xl border border-slate-600 bg-slate-700 shadow-2xl flex flex-col justify-between text-slate-100 print:bg-white print:text-slate-900 print:border-none print:shadow-none print:rounded-none">

      {/* Top Wrapper for Content */}
      <div className="flex-1">
        {/* Header */}
        <div className="border-b border-slate-600 bg-slate-800/80 p-6 sm:p-8 backdrop-blur-md print:bg-white print:border-slate-300 print:p-0 print:pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center justify-between sm:justify-start gap-4 mb-3">
                <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl print:text-slate-900 print:text-3xl">
                  INVOICE
                </h1>
                
                {/* Print Button (Hidden in Print View) */}
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-sky-400 active:scale-95 transition-all print:hidden cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  Print Invoice
                </button>
              </div>

              {/* Labeled Badges */}
              <div className="flex flex-wrap items-center gap-4 mb-3">
                <div className="flex items-center gap-2 text-xs text-slate-300 print:text-slate-700">
                  <span className="font-semibold text-slate-400 print:text-slate-600 uppercase tracking-wider text-[10px]">Order Status:</span>
                  <StatusBadge status={currentStatus} />
                </div>
                {currentPaymentStatus && (
                  <div className="flex items-center gap-2 text-xs text-slate-300 print:text-slate-700">
                    <span className="font-semibold text-slate-400 print:text-slate-600 uppercase tracking-wider text-[10px]">Payment Status:</span>
                    <StatusBadge status={currentPaymentStatus} />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-300 print:text-slate-700">
                  <span>Placed on {formatDate(createdAt)}</span>
                  <span className="text-slate-500">•</span>
                  <CopyableOrderNumber value={orderNumber} />
                </div>
                <span className="text-xs text-sky-300 font-semibold pl-0.5 print:hidden">
                  ({formatRelativeTime(createdAt)})
                </span>
              </div>
            </div>

            {/* Action Dropdowns (Hidden in Print View) */}
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 self-start sm:self-auto bg-slate-800 border border-slate-600 p-2.5 rounded-xl shadow-md print:hidden">
              {/* Payment Status Dropdown */}
              <div className="flex flex-col gap-1">
                <label htmlFor="paymentStatusSelect" className="text-[10px] font-extrabold tracking-wider text-sky-300 uppercase flex items-center gap-1">
                  Payment Status
                  {updatingStatus && <Loader2 className="h-2.5 w-2.5 animate-spin text-sky-300" />}
                </label>
                <select
                  id="paymentStatusSelect"
                  disabled={updatingStatus}
                  value={String(currentPaymentStatus).toUpperCase()}
                  onChange={(e) => onPaymentChange(e.target.value)}
                  className="rounded-lg bg-slate-900 border border-slate-500 px-2.5 py-1.5 text-xs font-bold text-white shadow-xs focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30 capitalize cursor-pointer disabled:opacity-50 transition-all"
                >
                  {['UNPAID', 'PAID'].map((st) => (
                    <option key={st} value={st} className="bg-slate-800 text-white">
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              {/* Order Status Dropdown */}
              <div className="flex flex-col gap-1">
                <label htmlFor="orderStatusSelect" className="text-[10px] font-extrabold tracking-wider text-sky-300 uppercase flex items-center gap-1">
                  Order Status
                  {updatingStatus && <Loader2 className="h-2.5 w-2.5 animate-spin text-sky-300" />}
                </label>
                <select
                  id="orderStatusSelect"
                  disabled={updatingStatus}
                  value={String(currentStatus).toLowerCase()}
                  onChange={(e) => onOrderChange(e.target.value)}
                  className="rounded-lg bg-slate-900 border border-slate-500 px-2.5 py-1.5 text-xs font-bold text-white shadow-xs focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/30 capitalize cursor-pointer disabled:opacity-50 transition-all"
                >
                  {['pending', 'confirmed', 'processing', 'shipped', 'delivered'].map((st) => (
                    <option key={st} value={st} className="bg-slate-800 text-white">
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

          </div>
        </div>

        {/* Items Section */}
        <div className="p-6 sm:p-8 print:p-0 print:py-6">
          <h2 className="text-base font-bold text-white mb-4 tracking-wide print:text-slate-900">
            Items Ordered ({items.length || 0})
          </h2>

          {/* Desktop & Print Table */}
          <div className="hidden sm:block print:block overflow-x-auto w-full">
            <table className="w-full text-left text-sm text-slate-200 print:text-slate-800">
              <thead className="border-b border-slate-600 bg-slate-800/60 text-xs font-bold uppercase tracking-wider text-slate-300 print:bg-slate-100 print:text-slate-700 print:border-slate-300">
                <tr>
                  <th scope="col" className="py-3 px-4">Item</th>
                  <th scope="col" className="py-3 px-4">Variant</th>
                  <th scope="col" className="py-3 px-4 text-center">Qty</th>
                  <th scope="col" className="py-3 px-4 text-right">Price</th>
                  <th scope="col" className="py-3 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-600/60 print:divide-slate-200">
                {items.map((item, idx) => {
                  const name = item?.product_name || "Unnamed Product";
                  const image = getItemImage(item);
                  const price = Number(item?.price || 0);
                  const qty = Number(item?.quantity || 1);
                  const itemTotal = Number(item?.total_amount || 0);
                  const { color, size } = getVariantData(item);

                  return (
                    <tr key={item?.id || idx} className="group hover:bg-slate-600/40 transition-colors print:hover:bg-transparent">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-4">
                          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-slate-500 bg-slate-800 print:border-slate-300 print:h-10 print:w-10">
                            {image ? (
                              <img src={image} alt={name} className="h-full w-full object-cover object-center" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-slate-400">
                                <Package className="h-6 w-6 print:h-4 print:w-4" />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-white group-hover:text-sky-300 transition-colors print:text-slate-900">
                              {name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-slate-300 print:text-slate-700">
                        {color || size ? (
                          <div className="flex flex-col gap-0.5 text-xs">
                            {color && (
                              <span>
                                Color: <strong className="text-white font-medium print:text-slate-900">{color}</strong>
                              </span>
                            )}
                            {size && (
                              <span>
                                Size: <strong className="text-white font-medium print:text-slate-900">{size}</strong>
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center font-bold text-slate-100 print:text-slate-900">{qty}</td>
                      <td className="py-4 px-4 text-right text-slate-300 print:text-slate-700">{formatCurrency(price)}</td>
                      <td className="py-4 px-4 text-right font-bold text-white print:text-slate-900">{formatCurrency(itemTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile View (Hidden in Print View so Table is used instead) */}
          <div className="divide-y divide-slate-600/60 sm:hidden print:hidden">
            {items.map((item, idx) => {
              const name = item?.product_name || "Unnamed Product";
              const image = getItemImage(item);
              const price = Number(item?.price || 0);
              const qty = Number(item?.quantity || 1);
              const itemTotal = Number(item?.total_amount || 0);
              const { color, size } = getVariantData(item);

              return (
                <div key={item?.id || idx} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-500 bg-slate-800">
                    {image ? (
                      <img src={image} alt={name} className="h-full w-full object-cover object-center" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-400">
                        <Package className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white leading-snug">{name}</p>
                      {(color || size) && (
                        <div className="mt-1 text-xs text-slate-300 flex items-center gap-2">
                          {color && <span>Color: <strong className="text-white">{color}</strong></span>}
                          {color && size && <span>•</span>}
                          {size && <span>Size: <strong className="text-white">{size}</strong></span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-slate-300">
                        Qty: <span className="font-bold text-white">{qty}</span> × {formatCurrency(price)}
                      </span>
                      <span className="font-bold text-sky-300 text-sm">{formatCurrency(itemTotal)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lower Details */}
      <div className="border-t border-slate-600 bg-slate-800/80 p-6 sm:p-8 w-full print:bg-white print:border-slate-300 print:p-0 print:pt-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 print:grid-cols-2">
          <div className="space-y-6">

            {/* Shipping Address */}
            <div>
              <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-2 print:text-slate-700">
                <MapPin className="h-4 w-4 text-sky-300 print:text-slate-700" /> Shipping Address
              </h3>
              <div className="rounded-xl border border-slate-600 bg-slate-800 p-4 text-sm text-slate-200 shadow-sm print:border-slate-300 print:bg-white print:text-slate-800">
                <p className="font-semibold text-white print:text-slate-900">
                  {shippingAddress?.full_address || "No address provided"}
                </p>
                <p className="text-slate-300 mt-0.5 print:text-slate-600">
                  {[shippingAddress?.city, shippingAddress?.state].filter(Boolean).join(", ")}
                  {shippingAddress?.zip_code ? ` - ${shippingAddress.zip_code}` : ""}
                </p>
              </div>
            </div>

            {/* Customer Information */}
            <div>
              <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-2 print:text-slate-700">
                <User className="h-4 w-4 text-sky-300 print:text-slate-700" /> Customer Information
              </h3>
              <div className="rounded-xl border border-slate-600 bg-slate-800 p-4 text-sm text-slate-200 shadow-sm space-y-2 print:border-slate-300 print:bg-white print:text-slate-800">
                <p className="font-semibold text-white print:text-slate-900">
                  {customer?.full_name || "Guest Customer"}
                </p>
                {customer?.phone_number && (
                  <p className="flex items-center gap-2 text-slate-300 print:text-slate-700">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400 print:text-slate-500" />
                    <span>{customer.phone_number}</span>
                  </p>
                )}
                {customer?.email && (
                  <p className="flex items-center gap-2 text-slate-300 print:text-slate-700">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400 print:text-slate-500" />
                    <span>{customer.email}</span>
                  </p>
                )}
              </div>
            </div>

          </div>

          {/* Summary Section - Highlighted Card */}
          <div className="flex flex-col justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-sky-300 mb-2 print:text-slate-700">
                <CreditCard className="h-4 w-4 text-sky-300 print:text-slate-700" /> Order Summary
              </h3>
              <div className="rounded-xl border-2 border-sky-400/40 bg-slate-800/90 p-5 shadow-lg space-y-3.5 print:border-slate-300 print:bg-slate-50 print:shadow-none">
                <div className="flex justify-between text-sm font-medium text-slate-200 print:text-slate-700">
                  <span>Subtotal</span>
                  <span className="font-bold text-white print:text-slate-900">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm font-medium text-slate-200 print:text-slate-700">
                  <span>Discount</span>
                  <span className="font-bold text-emerald-400 print:text-emerald-700">- {formatCurrency(discount)}</span>
                </div>
                <div className="flex justify-between text-sm font-medium text-slate-200 print:text-slate-700">
                  <span>Shipping Fee</span>
                  <span className="font-bold text-white print:text-slate-900">{formatCurrency(shippingFee)}</span>
                </div>
                <div className="pt-3 border-t-2 border-slate-600 print:border-slate-300 flex justify-between items-center">
                  <span className="text-base font-extrabold text-white print:text-slate-900">Total Paid</span>
                  <span className="text-xl font-black text-sky-300 tracking-tight print:text-slate-900">{formatCurrency(net)}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}