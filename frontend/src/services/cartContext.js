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

const CartContext = createContext(undefined);

export const CartProvider = ({ children }) => {
  const [cartCount, setCartCount] = useState(0);

  const fetchCartCount = useCallback(async () => {
    try {
      const res = await getCartCount();

      if (!res.success) {
        throw new Error("Failed to fetch cart count");
      }

      setCartCount(res.count);
    } catch (err) {
      console.error("Failed to fetch cart count:", err);
      setCartCount(0);
    }
  }, []);

  useEffect(() => {
    fetchCartCount();
  }, [fetchCartCount]);

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