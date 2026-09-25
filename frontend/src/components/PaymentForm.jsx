"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  createOrder,
  getShippingAddressByAddressId,
  getOrderByQueryId,
} from "../services/order.service.js";

const PaymentForm = () => {
  const searchParams = useSearchParams();
  const addressId = searchParams.get("addressId");

  const [addressDetails, setAddressDetails] = useState(null);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [addressError, setAddressError] = useState("");

  const [senderNumber, setSenderNumber] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bkash");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createOrderResponse, setCreateOrderResponse] = useState(null);

  // 1. Fetch Shipping Address
  useEffect(() => {
    if (!addressId) {
      setAddressDetails(null);
      setAddressError("No shipping address selected. Please go back to Step 2.");
      return;
    }

    const parsedAddressId = Number(addressId);
    if (!Number.isInteger(parsedAddressId) || parsedAddressId <= 0) {
      setAddressError("Invalid shipping address ID.");
      return;
    }

    let isCancelled = false;

    const fetchAddress = async () => {
      try {
        setLoadingAddress(true);
        setAddressError("");

        const res = await getShippingAddressByAddressId(parsedAddressId);

        if (isCancelled) return;

        // Flexible resolution for API payload structure
        const address =
          res?.address || res?.data?.address || res?.data || (res?.id ? res : null);

        if (address && typeof address === "object") {
          setAddressDetails(address);
        } else {
          setAddressError("Could not load address details.");
          setAddressDetails(null);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error("Fetch Address Error:", err);
          setAddressError(
            err?.response?.data?.message || "Could not load address details."
          );
          setAddressDetails(null);
        }
      } finally {
        if (!isCancelled) {
          setLoadingAddress(false);
        }
      }
    };

    fetchAddress();

    return () => {
      isCancelled = true;
    };
  }, [addressId]);

  // 2. Handle Order Creation
  const handleOrderSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    if (!addressId || !addressDetails) {
      alert("No shipping address selected. Please go back to step 2.");
      return;
    }

    const cleanSenderNumber = senderNumber.trim();
    const cleanTransactionId = transactionId.trim();

    if (!cleanSenderNumber || !cleanTransactionId) {
      alert("Please provide both sender number and transaction ID.");
      return;
    }

    const parsedAddressId = Number(addressId);

    setIsSubmitting(true);

    const payload = {
      address_id: parsedAddressId,
      full_address: addressDetails.full_address || "",
      state: addressDetails.state || "",
      city: addressDetails.city || "",
      zip: addressDetails.zip_code || "",
      payment_method: paymentMethod,
      sender_number: cleanSenderNumber,
      transaction_id: cleanTransactionId,
    };

    try {
      const res = await createOrder(payload);

      const fetchedOrderId =
        res?.data?.orderId || res?.orderId || res?.data?.id || res?.id;

      if (!fetchedOrderId) {
        alert(res?.message || "Failed to create order. Please try again.");
        return;
      }

      // Fetch created order details
      const createdOrder = await getOrderByQueryId(fetchedOrderId);
      setCreateOrderResponse(createdOrder);
    } catch (error) {
      console.error("Payment Submission Error:", error);
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "An error occurred while creating the order.";
      alert(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Display Shipping Address Preview */}
      <div className="p-3 bg-gray-50 border rounded-lg text-xs space-y-1">
        <p className="font-semibold text-gray-700">Shipping Address Details:</p>

        {loadingAddress && (
          <p className="text-gray-500 animate-pulse">Loading address details...</p>
        )}

        {!loadingAddress && addressError && (
          <p className="text-red-500 font-medium">{addressError}</p>
        )}

        {!loadingAddress && addressDetails && (
          <div>
            <p className="font-medium text-gray-800">
              {addressDetails.full_address}
            </p>
            <p className="text-gray-600">
              {addressDetails.city}, {addressDetails.state} -{" "}
              {addressDetails.zip_code}
            </p>
            {addressDetails.phone_number && (
              <p className="text-gray-500">
                Phone: {addressDetails.phone_number}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Payment Form */}
      <form onSubmit={handleOrderSubmit} className="space-y-4">
        <div className="flex gap-4 text-xs font-medium">
          {["bkash", "nagad", "rocket"].map((method) => (
            <label
              key={method}
              className="flex items-center gap-1 cursor-pointer capitalize"
            >
              <input
                type="radio"
                name="paymentMethod"
                value={method}
                checked={paymentMethod === method}
                onChange={(e) => setPaymentMethod(e.target.value)}
              />
              {method}
            </label>
          ))}
        </div>

        <input
          type="text"
          placeholder="Sender Number (017...)"
          value={senderNumber}
          onChange={(e) => setSenderNumber(e.target.value)}
          className="border p-2 rounded w-full text-sm"
          required
        />

        <input
          type="text"
          placeholder="Transaction ID (e.g. 9J78A2KL)"
          value={transactionId}
          onChange={(e) => setTransactionId(e.target.value)}
          className="border p-2 rounded w-full text-sm"
          required
        />

        <button
          type="submit"
          disabled={isSubmitting || loadingAddress || !addressDetails}
          className="w-full bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white p-2 rounded-lg text-sm font-medium transition cursor-pointer disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Processing Order..." : "Confirm Order"}
        </button>
      </form>

      {/* Success Confirmation Card */}
      {createOrderResponse && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs space-y-1 text-green-800">
          <p className="font-semibold">Order Placed Successfully!</p>
          <p>
            Order ID: #
            {createOrderResponse?.data?.id ||
              createOrderResponse?.order_result?.order_details?.id ||
              createOrderResponse?.id}
          </p>
        </div>
      )}
    </div>
  );
};

export default PaymentForm;