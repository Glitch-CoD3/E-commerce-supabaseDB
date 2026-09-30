"use client";

import { LucideShoppingCart, Loader2 } from "lucide-react";
import Image from "next/image.js";
import Link from "next/link.js";
import { useMemo, useState } from "react";
import { addToCart } from "../services/cart.service.js";
import { useCart } from "@/services/cartContext.js";

const ProductCard = ({ product,  index = 0 }) => {
  // Ensure sizes and colors are valid non-null string arrays
  const availableSizes = useMemo(() => {
    const sizes = Array.isArray(product.sizes) ? product.sizes : [];
    return sizes.filter((size) => size !== null && size !== undefined && size !== "");
  }, [product.sizes]);

  const availableColors = useMemo(() => {
    const colors = Array.isArray(product.colors) ? product.colors : [];
    return colors.filter((color) => color !== null && color !== undefined && color !== "");
  }, [product.colors]);

  const [productTypes, setProductTypes] = useState({
    size: availableSizes[0] ?? "",
    color: availableColors[0] ?? "",
  });

  const [isAdding, setIsAdding] = useState(false);
  const { refreshCartCount } = useCart();

  // Safe parsing helper
  const parseJsonArray = (data) => {
    try {
      if (typeof data === "string") return JSON.parse(data);
      if (Array.isArray(data)) return data;
      return [];
    } catch {
      return [];
    }
  };

  const variantIds = useMemo(
    () => parseJsonArray(product.variant_ids),
    [product.variant_ids]
  );

  const prices = useMemo(
    () => parseJsonArray(product.variant_prices).map(Number),
    [product.variant_prices]
  );

  const stocks = useMemo(
    () => parseJsonArray(product.variant_stocks).map(Number),
    [product.variant_stocks]
  );

  // Calculate variant index matching BOTH size and color
  const getVariantIndex = (selectedSize, selectedColor) => {
    if (availableSizes.length === 0 || availableColors.length === 0) {
      const colorIdx = availableColors.indexOf(selectedColor);
      const sizeIdx = availableSizes.indexOf(selectedSize);
      return colorIdx !== -1 ? colorIdx : sizeIdx !== -1 ? sizeIdx : 0;
    }

    const sizeIndex = availableSizes.indexOf(selectedSize);
    const colorIndex = availableColors.indexOf(selectedColor);

    if (sizeIndex === -1 || colorIndex === -1) return 0;

    const calculatedIndex = sizeIndex * availableColors.length + colorIndex;
    return calculatedIndex < variantIds.length ? calculatedIndex : colorIndex;
  };

  const currentVariantIndex = getVariantIndex(
    productTypes.size,
    productTypes.color
  );

  const currentVariantId = variantIds[currentVariantIndex];
  const currentPrice =
    prices[currentVariantIndex] ?? Number(product.price || 0);
  const currentStock = stocks[currentVariantIndex] ?? 0;
  const isSelectedVariantOutOfStock = currentStock <= 0;

  const handleProductTypes = ({ type, value }) => {
    setProductTypes((prev) => ({
      ...prev,
      [type]: value,
    }));
  };

  const handleAddToCart = async () => {
    if (isSelectedVariantOutOfStock || isAdding) return;

    try {
      setIsAdding(true);

      const cartInput = {
        product_id: product.id,
        product_variant_id: currentVariantId ?? undefined,
        quantity: 1,
      };

      await addToCart(cartInput);
      await refreshCartCount();
    } catch (error) {
      console.error("Failed to add product to cart:", error);
    } finally {
      setIsAdding(false);
    }
  };

  // Safely retrieve product image
  const productImage =
    product.images?.[productTypes.color] ||
    (Array.isArray(product.images) ? product.images[0] : null) ||
    "/placeholder.png";

  return (
    <div className="shadow-lg rounded-lg overflow-hidden flex flex-col bg-white">
      <Link
        href={`/products/details/${product.id}`}
        className="relative h-72 w-full overflow-hidden block bg-gray-100"
      >
        <Image
          src={productImage}
          alt={product.name || product.productName || "Product image"}
          fill
          sizes="(min-width: 1536px) 25vw, (min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
          priority={index < 4}
          className="object-cover hover:scale-105 transition-transform duration-300"
        />

        {product.brand_name && (
          <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm">
            {product.brand_name}
          </span>
        )}

        {isSelectedVariantOutOfStock ? (
          <span className="absolute top-3 right-3 bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm">
            Out of Stock
          </span>
        ) : currentStock <= 5 ? (
          <span className="absolute top-3 right-3 bg-amber-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm">
            Only {currentStock} left
          </span>
        ) : null}
      </Link>

      <div className="flex flex-col gap-4 p-4">
        <div>
          <h1 className="text-[17px] font-semibold tracking-tight text-gray-900 line-clamp-1">
            {product.name}
          </h1>
          <p className="text-sm text-gray-500 line-clamp-2">
            {product.shortDescription}
          </p>
        </div>

        {(availableSizes.length > 0 || availableColors.length > 0) && (
          <div className="flex items-center justify-between gap-4 text-xs">
            {/* Sizes */}
            {availableSizes.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Size</span>
                <select
                  name="size"
                  id={`size-${product.id}`}
                  value={productTypes.size}
                  className="ring ring-gray-300 px-2 py-1 rounded-md cursor-pointer"
                  onChange={(e) =>
                    handleProductTypes({
                      type: "size",
                      value: e.target.value,
                    })
                  }
                >
                  {availableSizes.map((size, index) => (
                    <option key={`${size}-${index}`} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Colors */}
            {availableColors.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Colors</span>
                <div className="flex items-center gap-1">
                  {availableColors.map((color, index) => {
                    const colorIdx = getVariantIndex(
                      productTypes.size,
                      color
                    );
                    const colorStock = stocks[colorIdx] ?? 0;
                    const isColorOutOfStock = colorStock <= 0;

                    return (
                      <button
                        type="button"
                        key={`${color}-${index}`}
                        onClick={() =>
                          handleProductTypes({
                            type: "color",
                            value: color,
                          })
                        }
                        title={`${String(color).toUpperCase()} (${colorStock} in stock)`}
                        className={`relative border-2 ${productTypes.color === color
                            ? "border-gray-500"
                            : "border-gray-300"
                          } rounded-full p-[1.2px] cursor-pointer`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full ${isColorOutOfStock ? "opacity-30" : "opacity-100"
                            }`}
                          style={{ backgroundColor: color }}
                        />

                        {isColorOutOfStock && (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <span className="w-full h-[1.5px] bg-red-500 rotate-45 transform" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stock Label */}
        <div className="text-xs">
          {isSelectedVariantOutOfStock ? (
            <span className="text-red-500 font-medium">
              Variant Out of Stock
            </span>
          ) : (
            <span className="text-emerald-600 font-medium">
              In Stock ({currentStock} available)
            </span>
          )}
        </div>

        {/* Price & Action */}
        <div className="flex items-center justify-between">
          <p className="font-medium text-base">
            TK.{currentPrice.toFixed(2)}
          </p>

          <button
            onClick={handleAddToCart}
            disabled={isSelectedVariantOutOfStock || isAdding}
            className={`flex gap-2 items-center ring-1 ring-gray-200 shadow-lg rounded-md px-2 py-1 text-sm transition-all duration-300 ${isSelectedVariantOutOfStock || isAdding
                ? "bg-gray-200 text-gray-400 cursor-not-allowed ring-0 shadow-none"
                : "cursor-pointer hover:text-white hover:bg-black"
              }`}
          >
            {isAdding ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <LucideShoppingCart className="w-5 h-5" />
            )}

            {isSelectedVariantOutOfStock
              ? "Sold Out"
              : isAdding
                ? "Adding..."
                : "Add To Cart"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;