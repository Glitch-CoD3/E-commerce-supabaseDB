"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from "react";

import { getCartCount } from "./cart.service.js";
import { useAuth } from "./authContext.js";

const CartContext = createContext(undefined);

export const CartProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [cartCount, setCartCount] = useState(0);

  const fetchCartCount = useCallback(async () => {
    try {
      const res = await getCartCount();

      if (!res.success) {
        throw new Error("Failed to fetch cart count");
      }

      setCartCount(res.count);
    } catch (err) {
      setCartCount(0);

      // 401 just means "not logged in / session expired", not a real error
      if (err?.response?.status !== 401) {
        console.error("Failed to fetch cart count:", err);
      }
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;   // wait until we know who the user is

    if (!user) {
      setCartCount(0);         // guest, or just logged out
      return;
    }

    fetchCartCount();
  }, [authLoading, user, fetchCartCount]);

  const value = useMemo(
    () => ({
      cartCount,
      refreshCartCount: fetchCartCount,
    }),
    [cartCount, fetchCartCount]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }

  return context;
};