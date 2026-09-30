"use client";

import { use, useEffect, useState } from "react";
import ProductDetail from "@/components/ProductDetail.jsx";
import { getProductById } from "@/services/product.service.js";
import { addToCart } from "@/services/cart.service.js";
import { useCart } from "@/services/cartContext.js";

const ProductDetailsPage = ({ params }) => {
  const { id } = use(params);
  const { refreshCartCount } = useCart();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await getProductById(id);
        // console.log("Product response:", response);

        
        const item = response?.product ;

        if (!cancelled) setProduct(item ?? null);
      } catch (err) {
        console.error("Failed to load product:", err);
        if (!cancelled) setError("Something went wrong while loading this product.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return <p className="py-16 text-center text-gray-500">Loading product...</p>;
  }
  if (error) {
    return <p className="py-16 text-center text-red-500">{error}</p>;
  }
  if (!product) {
    return <p className="py-16 text-center text-gray-500">Product not found.</p>;
  }

  return (
    <ProductDetail
      product={product}
      onAddToCart={async ({ productId, variantId }) => {
        const cartInput = {
          product_id: productId,
          product_variant_id: variantId ?? undefined,
          quantity: 1,
        };

        await addToCart(cartInput);
        await refreshCartCount();
      }}
    />
  );
};

export default ProductDetailsPage;