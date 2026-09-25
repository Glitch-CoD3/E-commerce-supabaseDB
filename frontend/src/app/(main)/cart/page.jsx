"use client";

import PaymentForm from "../../../components/PaymentForm.jsx";
import ShippingForm from "../../../components/ShippingFrom.jsx";
import {
  Loader2,
  Trash2,
  Minus,
  Plus,
  ArrowRight,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation.js";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Image from "next/image.js";
import { toast } from "react-toastify";
import { handleApiError } from "../../../services/handleApiError.js";

import {
  FetchCart,
  updateCartQuantity,
  removeCartItem,
  clearCart,
} from "../../../services/cart.service.js";
import { getme } from "../../../services/user.service.js";
import { getUserShippingAddress } from "../../../services/order.service.js";

const steps = [
  { id: 1, title: "Shopping Cart" },
  { id: 2, title: "Shipping Address" },
  { id: 3, title: "Payment Method" },
];

const INSIDE_DHAKA_FEE = 120;
const OUTSIDE_DHAKA_FEE = 70;

const isDhakaAddress = ({ state } = {}) =>
  (state || "").trim().toLowerCase() === "dhaka";

const CartPage = () => {
  const [shippingForm, setShippingForm] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [isClearing, setIsClearing] = useState(false);

  const [defaultAddress, setDefaultAddress] = useState(null);
  const [addressLoading, setAddressLoading] = useState(true);

  const [cooldown, setCooldown] = useState(0);
  const isFetchingCart = useRef(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const activeStep = parseInt(searchParams.get("step") || "1", 10);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const fetchCart = useCallback(async () => {
    if (isFetchingCart.current) return;

    try {
      isFetchingCart.current = true;
      setLoading(true);

      const res = await FetchCart();
      const rawItems = Array.isArray(res) ? res : res?.data || [];

      const populatedItems = rawItems.map((item) => {
        const imageUrl = item.variant?.images?.[0]?.imageUrl || null;

        return {
          ...item,
          productData: item.product || null,
          variantDetails: item.variant || null,
          imageUrl,
        };
      });

      setCartItems(populatedItems);
    } catch (error) {
      handleApiError(error, {
        onRateLimit: (sec) => setCooldown(sec),
      });

      setCartItems([]);
    } finally {
      isFetchingCart.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  useEffect(() => {
    let isMounted = true;

    const fetchAddress = async () => {
      try {
        setAddressLoading(true);
        const userRes = await getme();
        const userId = userRes?.user?.id;

        if (!userId) {
          if (isMounted) setDefaultAddress(null);
          return;
        }

        const res = await getUserShippingAddress(userId);
        const addresses = Array.isArray(res) ? res : res?.data || res?.addresses || [];
        const defaultAddr = addresses.find((a) => a.is_default) ?? addresses[0] ?? null;

        if (isMounted) setDefaultAddress(defaultAddr);
      } catch (error) {
        handleApiError(error, { onRateLimit: (sec) => setCooldown(sec) });
        if (isMounted) setDefaultAddress(null);
      } finally {
        if (isMounted) setAddressLoading(false);
      }
    };

    fetchAddress();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpdateQuantity = async (id, currentQuantity, change) => {
    if (cooldown > 0) return;

    const newQuantity = currentQuantity + change;
    if (newQuantity < 1) return;

    try {
      setUpdatingItemId(id);
      await updateCartQuantity(id, { quantity: newQuantity });
      await fetchCart();
      toast.success("Quantity updated!");
    } catch (error) {
      handleApiError(error, { onRateLimit: (sec) => setCooldown(sec) });
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleDeleteItem = async (id) => {
    if (cooldown > 0) return;

    try {
      setUpdatingItemId(id);
      await removeCartItem(id);
      await fetchCart();
      toast.success("Item removed from cart");
    } catch (error) {
      handleApiError(error, { onRateLimit: (sec) => setCooldown(sec) });
    } finally {
      setUpdatingItemId(null);
    }
  };

  const handleClearCart = async () => {
    if (cooldown > 0) return;

    try {
      setIsClearing(true);
      await clearCart();
      await fetchCart();
      toast.success("Cart cleared");
    } catch (error) {
      handleApiError(error, { onRateLimit: (sec) => setCooldown(sec) });
    } finally {
      setIsClearing(false);
    }
  };

  const subtotal = useMemo(() => {
    return cartItems.reduce((acc, item) => {
      const priceVal = item.variantDetails?.price ?? 0;
      const priceNum = typeof priceVal === "number" ? priceVal : parseFloat(priceVal) || 0;
      return acc + priceNum * item.quantity;
    }, 0);
  }, [cartItems]);

  const discount = 0;

  const effectiveAddress = useMemo(() => {
    if (shippingForm) {
      return {
        city: shippingForm.city,
        state: shippingForm.state,
        full_address: shippingForm.address,
      };
    }
    return defaultAddress;
  }, [shippingForm, defaultAddress]);

  const isDhaka = useMemo(() => {
    if (!effectiveAddress) return null;
    return isDhakaAddress(effectiveAddress);
  }, [effectiveAddress]);

  const shippingFee = useMemo(() => {
    if (cartItems.length === 0 || isDhaka === null) return 0;
    return isDhaka ? INSIDE_DHAKA_FEE : OUTSIDE_DHAKA_FEE;
  }, [cartItems.length, isDhaka]);

  const totalAmount = useMemo(() => {
    return Math.max(0, subtotal - discount + shippingFee);
  }, [subtotal, discount, shippingFee]);

  return (
    <div className="mt-6 sm:mt-10 lg:mt-12 flex flex-col items-center gap-6 sm:gap-8 max-w-6xl mx-auto px-4 sm:px-6">
      <h1 className="text-xl sm:text-2xl font-medium text-center">Your Shopping Cart</h1>

      {/* STEPS — horizontally scrollable on very narrow screens instead of wrapping/breaking */}
      <div className="w-full overflow-x-auto">
        <div className="flex items-center justify-center gap-6 sm:gap-10 lg:gap-16 min-w-max mx-auto px-2">
          {steps.map((step) => (
            <div
              className={`flex items-center gap-2 pb-3 sm:pb-4 border-b-2 shrink-0 ${
                step.id === activeStep ? "border-gray-800" : "border-gray-200"
              }`}
              key={step.id}
            >
              <div
                className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full text-white text-xs sm:text-sm flex items-center justify-center shrink-0 ${
                  step.id === activeStep ? "bg-gray-800" : "bg-gray-400"
                }`}
              >
                {step.id}
              </div>
              <p
                className={`text-xs sm:text-sm whitespace-nowrap ${
                  step.id === activeStep ? "text-gray-800" : "text-gray-400"
                }`}
              >
                {step.title}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN GRID — right column (summary) shows FIRST on mobile so users
          see the total without scrolling past the whole product list;
          reorders to left-first on lg+ via the order utilities below */}
      <div className="w-full flex flex-col-reverse lg:flex-row gap-5 sm:gap-6 lg:gap-8">
        {/* LEFT COLUMN */}
        <div className="w-full lg:w-7/12 shadow-lg border border-gray-100 p-4 sm:p-6 lg:p-8 rounded-xl lg:rounded-lg flex flex-col gap-6 sm:gap-8">
          {activeStep === 1 && (
            <>
              {cartItems.length > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={handleClearCart}
                    disabled={isClearing || cooldown > 0}
                    className="flex items-center gap-2 text-xs text-red-500 hover:text-red-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isClearing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    Clear Cart
                  </button>
                </div>
              )}

              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-600" />
                </div>
              ) : cartItems.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Your cart is empty.</p>
              ) : (
                cartItems.map((item) => {
                  const product = item.productData;
                  const variant = item.variantDetails;
                  const itemPrice = parseFloat(variant?.price ?? product?.price ?? "0");
                  const rawStock = variant?.stockQuantity ?? product?.stockQuantity;
                  const availableStock = rawStock !== undefined ? Number(rawStock) : Infinity;

                  return (
                    <div
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-4 last:border-0"
                      key={item.id}
                    >
                      <div className="flex gap-4 sm:gap-6">
                        <div className="relative w-20 h-20 sm:w-28 sm:h-28 bg-gray-50 rounded-lg overflow-hidden shrink-0">
                          {item.imageUrl ? (
                            <Image
                              src={item.imageUrl}
                              alt={product?.productName || "Product image"}
                              fill
                              className="object-contain"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center text-[10px] sm:text-xs text-gray-400 text-center px-1">
                              No Image
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col justify-between max-w-[180px] sm:max-w-xs">
                          <div>
                            <p className="text-sm font-medium line-clamp-2">
                              {product?.productName || `Product #${item.product_id}`}
                            </p>

                            <div className="mt-1 space-y-0.5">
                              {variant?.sizes && (
                                <p className="text-xs text-gray-500">
                                  Size: <span className="font-medium text-gray-700">{variant.sizes}</span>
                                </p>
                              )}
                              {variant?.colors && (
                                <p className="text-xs text-gray-500">
                                  Color: <span className="font-medium text-gray-700">{variant.colors}</span>
                                </p>
                              )}
                              {availableStock !== Infinity && (
                                <p className="text-xs text-gray-500">
                                  Stock: <span className="font-medium text-gray-700">{availableStock}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          {/* QUANTITY CONTROLS */}
                          <div className="flex items-center gap-3 mt-3">
                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity, -1)}
                              disabled={item.quantity <= 1 || updatingItemId === item.id || cooldown > 0}
                              className="w-7 h-7 sm:w-6 sm:h-6 rounded bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>

                            <span className="text-xs font-semibold w-4 text-center">
                              {updatingItemId === item.id ? (
                                <Loader2 className="w-3 h-3 animate-spin inline" />
                              ) : (
                                item.quantity
                              )}
                            </span>

                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity, 1)}
                              disabled={
                                updatingItemId === item.id ||
                                item.quantity >= availableStock ||
                                cooldown > 0
                              }
                              className="w-7 h-7 sm:w-6 sm:h-6 rounded bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <p className="font-medium mt-2 text-sm">
                            TK {(itemPrice * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        disabled={updatingItemId === item.id || cooldown > 0}
                        className="self-end sm:self-auto w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 transition-all text-red-400 flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                      >
                        {updatingItemId === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </>
          )}

          {activeStep === 2 && <ShippingForm setShippingForm={setShippingForm} />}

          {activeStep === 3 &&
            (shippingForm ? (
              <PaymentForm shippingForm={shippingForm} cartItems={cartItems} subtotal={subtotal} />
            ) : (
              <p className="text-red-500">Please fill in the shipping form to continue.</p>
            ))}
        </div>

        {/* RIGHT COLUMN — Cart Details */}
        <div className="w-full lg:w-5/12 shadow-lg border border-gray-100 p-5 sm:p-6 lg:p-8 rounded-xl lg:rounded-2xl flex flex-col gap-5 sm:gap-6 h-max lg:sticky lg:top-6">
          <h2 className="font-semibold text-base sm:text-lg text-gray-900">Cart Details</h2>

          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center text-sm">
              <p className="text-gray-500">Subtotal</p>
              <p className="font-medium text-gray-800">TK {subtotal.toFixed(2)}</p>
            </div>

            <div className="flex justify-between items-center text-sm">
              <p className="text-gray-500">Discount</p>
              <p className="font-medium text-gray-800">TK {discount.toFixed(2)}</p>
            </div>
          </div>

          {/* Delivery Zone Indicator */}
          {cartItems.length > 0 && (
            <div className="flex flex-col gap-2.5 pt-1">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <MapPin className="w-3.5 h-3.5" />
                  Delivery Location
                </p>
                {!addressLoading && effectiveAddress && (
                  <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                    Auto-detected
                  </span>
                )}
              </div>

              {addressLoading && !shippingForm ? (
                <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Detecting your zone...
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Inside Dhaka", fee: INSIDE_DHAKA_FEE, active: isDhaka === true },
                    { label: "Outside Dhaka", fee: OUTSIDE_DHAKA_FEE, active: isDhaka === false },
                  ].map((zone) => (
                    <div
                      key={zone.label}
                      className={`relative rounded-xl border px-2 sm:px-3 py-2.5 text-center transition-all ${
                        zone.active
                          ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600"
                          : "border-gray-200 bg-gray-50/60"
                      }`}
                    >
                      {zone.active && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 absolute top-1.5 right-1.5" />
                      )}
                      <p
                        className={`text-[11px] sm:text-xs font-semibold ${
                          zone.active ? "text-emerald-700" : "text-gray-400"
                        }`}
                      >
                        {zone.label}
                      </p>
                      <p
                        className={`text-sm font-bold mt-0.5 ${
                          zone.active ? "text-emerald-700" : "text-gray-300"
                        }`}
                      >
                        TK {zone.fee}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {!addressLoading && !effectiveAddress && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  No saved address found — add a shipping address to calculate the delivery fee.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-between items-center text-sm pt-1">
            <p className="text-gray-500">Shipping Fee</p>
            <p className="font-medium text-gray-800">TK {shippingFee.toFixed(2)}</p>
          </div>

          <hr className="border-gray-200" />

          <div className="flex justify-between items-center">
            <p className="text-gray-800 font-medium text-sm sm:text-base">Total Amount</p>
            <p className="font-bold text-lg sm:text-xl text-gray-900">TK {totalAmount.toFixed(2)}</p>
          </div>

          {activeStep === 1 && (
            <button
              onClick={() => router.push("/cart?step=2", { scroll: false })}
              disabled={cartItems.length === 0 || cooldown > 0}
              className="w-full bg-gray-900 hover:bg-black transition-colors duration-200 text-white p-3 rounded-xl cursor-pointer flex items-center justify-center gap-2 font-medium text-sm sm:text-base disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CartPage;