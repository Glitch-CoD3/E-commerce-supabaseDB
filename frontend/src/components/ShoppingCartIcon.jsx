"use client";

import { ShoppingCart } from "lucide-react";
import Link from "next/link.js";
import { useCart } from "../services/cartContext.js";

const ShoppingCartIcon = () => {
  const { cartCount } = useCart();

 return (
    <Link href="/cart" className="relative">
      <ShoppingCart className="w-4 h-4 text-gray-600" />

      <span className="absolute -top-3 -right-3 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-xs font-medium text-gray-600">
        {cartCount}
      </span>
    </Link>
  );
};

export default ShoppingCartIcon;