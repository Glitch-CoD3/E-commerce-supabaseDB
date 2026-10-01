"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "react-toastify";
import {
  ChevronRight,
  Heart,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  Check,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined || value === "") return [];
  return [value];
};

const unique = (list) => [...new Set(list)];

const formatPrice = (value) =>
  `TK. ${Number(value || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const cleanImageSrc = (value) => {
  if (typeof value !== "string") return null;
  const src = value.replace(/^"+|"+$/g, "").trim();
  return /^(https?:\/\/|\/)/.test(src) ? src : null;
};

const buildVariants = (product) => {
  // Preferred: real variants array from the API
  if (Array.isArray(product?.variants) && product.variants.length > 0) {
    return product.variants.map((v) => ({
      id: v.id,
      size: v.size ?? null,
      color: v.color ?? null,
      price: v.price ?? product?.price ?? 0,
      stock: Number(v.stock ?? 0),
    }));
  }

  // Fallback: flat arrays (paired by index)
  const sizes = toArray(product?.sizes);
  const colors = toArray(product?.colors);
  const ids = toArray(product?.variant_ids);
  const prices = toArray(product?.variant_prices);
  const stocks = toArray(product?.variant_stocks);

  const count = Math.max(
    ids.length,
    prices.length,
    stocks.length,
    Number(product?.total_variants) || 0
  );

  const pick = (list, i) => (list.length === 1 ? list[0] : list[i]);

  return Array.from({ length: count }, (_, i) => ({
    id: ids[i] ?? i,
    size: pick(sizes, i) ?? null,
    color: pick(colors, i) ?? null,
    price: prices[i] ?? product?.price ?? 0,
    stock: Number(stocks[i] ?? 0),
  }));
};

const buildImages = (images) => {
  if (Array.isArray(images)) {
    return images
      .map((img, i) => ({
        key: img.id ?? i,
        color: img.color ?? null,
        url: cleanImageSrc(img.imageUrl ?? img.image_url ?? img.url),
      }))
      .filter((img) => img.url);
  }
  if (images && typeof images === "object") {
    return Object.entries(images)
      .map(([color, url]) => ({ key: color, color, url: cleanImageSrc(url) }))
      .filter((img) => img.url);
  }
  return [];
};

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

const ProductDetail = ({ product, onAddToCart }) => {
  const images = useMemo(() => buildImages(product?.images), [product]);

  const allSizes = useMemo(
    () => toArray(product?.sizes).filter((s) => s !== null && s !== undefined && s !== ""),
    [product?.sizes]
  );
  const allColors = useMemo(
    () => toArray(product?.colors).filter((c) => c !== null && c !== undefined && c !== ""),
    [product?.colors]
  );

  const parseJsonArray = (data) => {
    try {
      if (typeof data === "string") return JSON.parse(data);
      if (Array.isArray(data)) return data;
      return [];
    } catch {
      return [];
    }
  };

  const handleThumbnailClick = (img, index) => {
    setActiveImage(index);
    if (img.color && allColors.includes(img.color)) {
      setColor(img.color); // this updates the variant id, price and stock
    }
  };

  const variantIds = useMemo(() => parseJsonArray(product?.variant_ids), [product?.variant_ids]);
  const prices = useMemo(() => parseJsonArray(product?.variant_prices).map(Number), [product?.variant_prices]);
  const stocks = useMemo(() => parseJsonArray(product?.variant_stocks).map(Number), [product?.variant_stocks]);

  const [size, setSize] = useState(allSizes[0] ?? null);
  const [color, setColor] = useState(allColors[0] ?? null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [copied, setCopied] = useState(false);

  // Same index logic as your working component
  const getVariantIndex = (selectedSize, selectedColor) => {
    if (allSizes.length === 0 || allColors.length === 0) {
      const colorIdx = allColors.indexOf(selectedColor);
      const sizeIdx = allSizes.indexOf(selectedSize);
      return colorIdx !== -1 ? colorIdx : sizeIdx !== -1 ? sizeIdx : 0;
    }

    const sizeIndex = allSizes.indexOf(selectedSize);
    const colorIndex = allColors.indexOf(selectedColor);
    if (sizeIndex === -1 || colorIndex === -1) return 0;

    const calculatedIndex = sizeIndex * allColors.length + colorIndex;
    return calculatedIndex < variantIds.length ? calculatedIndex : colorIndex;
  };

  const currentVariantIndex = getVariantIndex(size, color);
  const currentVariantId = variantIds[currentVariantIndex];

  const price = prices[currentVariantIndex] ?? Number(product?.price || 0);
  const stock = stocks[currentVariantIndex] ?? Number(product?.quantity ?? 0);
  const isOutOfStock = stock <= 0;

  // Used by the existing JSX for the crossed-out colors and sizes
  const isColorAvailable = (c) => (stocks[getVariantIndex(size, c)] ?? 0) > 0;
  const isSizeAvailable = (s) => (stocks[getVariantIndex(s, color)] ?? 0) > 0;

  // Plain setters, so the JSX can use setColor / setSize or these
  const handleSelectColor = (c) => setColor(c);
  const handleSelectSize = (s) => setSize(s);

  useEffect(() => {
    const index = images.findIndex((img) => img.color === color);
    setActiveImage(index >= 0 ? index : 0);
  }, [color, images]);

  useEffect(() => {
    setQuantity(1);
  }, [currentVariantId]);

  useEffect(() => {
    if (stock > 0 && quantity > stock) setQuantity(stock);
  }, [stock, quantity]);

  const currentImage = images[activeImage] ?? images[0];

  const handleAddToCart = async () => {
    if (isOutOfStock || isAdding) return;

    if (typeof onAddToCart !== "function") {
      console.warn("ProductDetail: pass an onAddToCart prop to enable the cart.");
      return;
    }

    setIsAdding(true);
    try {
      await onAddToCart({
        productId: product.id,
        variantId: currentVariantId ?? null, // a single id, like 12 or 11
        quantity,
      });
      toast.success("Added to cart successfully!");
    } catch (error) {
      console.error("Add to cart failed:", error);
      toast.error("Could not add this item. Please try again.");
    } finally {
      setIsAdding(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product?.name,
          url: window.location.href,
        });
      } catch (e) {
        // user cancelled or share failed
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.info("Product link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!product) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 text-center px-4">
        <p className="text-lg font-medium text-slate-500">Product details unavailable.</p>
        <Link
          href="/products"
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          Explore All Products
        </Link>
      </div>
    );
  }

  const name = product.name || product.productName || "Product";
  const brandName = product.brand_name;
  const brandLogo = cleanImageSrc(product.brand_logo);
  const categoryName = product.category_name;
  const categorySlug = product.category_slug;

  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: name,
    image: images.map((i) => i.url),
    description: product.description || product.shortDescription,
    sku: currentVariantId || product.id,
    brand: brandName ? { "@type": "Brand", name: brandName } : undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "BDT",
      price: price,
      availability: isOutOfStock
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
    },
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8 pb-24 lg:pb-12">
      {/* Dynamic SEO JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="mb-4 sm:mb-8 overflow-x-auto">
        <ol className="flex items-center gap-1.5 sm:gap-2 text-xs font-medium text-slate-500 whitespace-nowrap">
          <li>
            <Link href="/" className="transition hover:text-slate-900">
              Home
            </Link>
          </li>
          <li>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          </li>
          <li>
            <Link href="/products" className="transition hover:text-slate-900">
              Products
            </Link>
          </li>
          {categoryName && categorySlug && (
            <>
              <li>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </li>
              <li>
                <Link
                  href={`/products?category=${categorySlug}`}
                  className="transition hover:text-slate-900"
                >
                  {categoryName}
                </Link>
              </li>
            </>
          )}
          <li>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
          </li>
          <li className="truncate max-w-[150px] sm:max-w-xs font-semibold text-slate-900" aria-current="page">
            {name}
          </li>
        </ol>
      </nav>

      {/* Main Product Showcase */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
        {/* ------------------------- Image Gallery ------------------------- */}
        <div className="lg:col-span-7">
          <div className="sticky top-6 flex flex-col-reverse gap-3 md:flex-row md:gap-4">
            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex flex-row gap-2.5 overflow-x-auto pb-2 md:pb-0 md:flex-col md:overflow-y-auto max-h-[500px] scrollbar-none">
                {images.map((img, index) => (
                  <button
                    key={img.key}
                    type="button"
                    onClick={() => handleThumbnailClick(img, index)}
                    aria-label={`View image ${index + 1}`}
                    className={`relative h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-200 ${index === activeImage
                      ? "border-slate-900 shadow-md ring-2 ring-slate-900/10"
                      : "border-slate-200 opacity-70 hover:opacity-100"
                      }`}
                  >
                    <Image
                      src={img.url}
                      alt={`${name} thumbnail ${index + 1}`}
                      fill
                      sizes="(max-width: 640px) 64px, 80px"
                      className="object-cover object-center"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Main Image Container */}
            <div className="relative aspect-square w-full flex-1 overflow-hidden rounded-2xl bg-slate-50 border border-slate-100 shadow-sm">
              {currentImage ? (
                <Image
                  src={currentImage.url}
                  alt={name}
                  fill
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-contain object-center transition-transform duration-500 hover:scale-105"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
                  <p className="text-sm font-medium">No Image Preview Available</p>
                </div>
              )}

              {/* Status Badges */}
              <div className="absolute left-3 top-3 sm:left-4 sm:top-4 flex flex-col gap-2 z-10">
                {isOutOfStock && (
                  <span className="rounded-full bg-rose-500/90 px-2.5 py-1 text-[11px] sm:text-xs font-semibold text-white backdrop-blur-md shadow-sm">
                    Out of Stock
                  </span>
                )}
                {stock > 0 && stock <= 5 && (
                  <span className="rounded-full bg-amber-500/90 px-2.5 py-1 text-[11px] sm:text-xs font-semibold text-white backdrop-blur-md shadow-sm">
                    Low Stock: {stock} left
                  </span>
                )}
              </div>

              {/* Quick Actions Overlay */}
              <div className="absolute right-3 top-3 sm:right-4 sm:top-4 flex flex-col gap-2 z-10">
                <button
                  onClick={() => setIsWishlisted(!isWishlisted)}
                  aria-label="Add to Wishlist"
                  className="group rounded-full bg-white/90 p-2 sm:p-2.5 text-slate-700 shadow-sm backdrop-blur-md transition hover:bg-white hover:text-rose-500"
                >
                  <Heart
                    className={`h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:scale-110 ${isWishlisted ? "fill-rose-500 text-rose-500" : ""
                      }`}
                  />
                </button>
                <button
                  onClick={handleShare}
                  aria-label="Share product"
                  className="group rounded-full bg-white/90 p-2 sm:p-2.5 text-slate-700 shadow-sm backdrop-blur-md transition hover:bg-white hover:text-slate-900"
                >
                  {copied ? (
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                  ) : (
                    <Share2 className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:scale-110" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------- Details Column ------------------------- */}
        <div className="flex flex-col justify-between lg:col-span-5">
          <div className="space-y-5 sm:space-y-6">
            {/* Header / Brand info */}
            <div>
              {brandName && (
                <div className="mb-1.5 flex items-center gap-2">
                  {brandLogo && (
                    <Image
                      src={brandLogo}
                      alt={brandName}
                      width={20}
                      height={20}
                      className="h-4 w-4 sm:h-5 sm:w-5 rounded-full object-cover"
                    />
                  )}
                  <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                    {brandName}
                  </span>
                </div>
              )}

              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {name}
              </h1>

              {/* Quick Ratings */}
              <div className="mt-2.5 flex items-center gap-2 sm:gap-3 flex-wrap">
                <div className="flex items-center text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-amber-400" />
                  ))}
                </div>
                <span className="text-xs font-medium text-slate-600">
                  4.9 (128 reviews)
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-medium text-emerald-600">Verified Quality</span>
              </div>
            </div>

            {/* Price Tag */}
            <div className="flex items-baseline justify-between rounded-xl bg-slate-50 p-3.5 sm:p-4 border border-slate-100">
              <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                {formatPrice(price)}
              </span>
            </div>

            {product.shortDescription && (
              <p className="text-xs sm:text-sm leading-relaxed text-slate-600">
                {product.shortDescription}
              </p>
            )}

            {/* Colors Selection */}
            {allColors.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-semibold text-slate-900">Color</span>
                  <span className="font-medium text-slate-500 capitalize">{color || "Select Color"}</span>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {allColors.map((c) => {
                    const available = isColorAvailable(c);
                    const isSelected = color === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        aria-label={`Select color ${c}`}
                        className={`group relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full transition-all ${isSelected
                          ? "ring-2 ring-slate-900 ring-offset-2"
                          : "hover:scale-105"
                          }`}
                      >
                        <span
                          className={`h-6 w-6 sm:h-7 sm:w-7 rounded-full border border-slate-200/60 shadow-inner ${!available ? "opacity-30" : ""
                            }`}
                          style={{ backgroundColor: c }}
                        />
                        {!available && (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <span className="h-0.5 w-full rotate-45 bg-rose-500" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sizes Selection */}
            {allSizes.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-semibold text-slate-900">Size</span>
                  <button type="button" className="text-xs font-medium text-indigo-600 hover:underline">
                    Size Guide
                  </button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {allSizes.map((s) => {
                    const available = isSizeAvailable(s);
                    const isSelected = size === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSize(s)}
                        className={`flex items-center justify-center rounded-xl py-2 sm:py-2.5 text-xs sm:text-sm font-semibold transition-all ${isSelected
                          ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                          : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                          } ${!available ? "line-through opacity-40" : ""}`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity Adjuster & Add To Cart (Desktop/Tablet Layout) */}
            <div className="space-y-2.5 pt-2">
              <span className="text-xs sm:text-sm font-semibold text-slate-900">Quantity</span>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="flex items-center justify-between sm:justify-start rounded-xl border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={isOutOfStock || quantity <= 1}
                    aria-label="Decrease quantity"
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:opacity-40"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-12 text-center text-sm font-semibold text-slate-900 tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
                    disabled={isOutOfStock || quantity >= stock}
                    aria-label="Increase quantity"
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={isOutOfStock || isAdding}
                  className={`hidden sm:flex flex-1 items-center justify-center gap-2 rounded-xl py-3 px-6 text-sm font-bold shadow-lg transition-all duration-200 active:scale-[0.98] ${isOutOfStock || isAdding
                    ? "cursor-not-allowed bg-slate-200 text-slate-400 shadow-none"
                    : "bg-slate-900 text-white shadow-slate-900/20 hover:bg-slate-800 hover:shadow-slate-900/30"
                    }`}
                >
                  {isAdding ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ShoppingCart className="h-5 w-5" />
                  )}
                  {isOutOfStock ? "Sold Out" : isAdding ? "Adding..." : "Add to Cart"}
                </button>
              </div>
            </div>

            {/* Value Highlights */}
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-100 bg-slate-50/50 p-3 sm:p-4 text-center">
              <div className="flex flex-col items-center gap-1 p-1">
                <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700">Fast Shipping</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-1">
                <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700">Authentic Guarantee</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-1">
                <RotateCcw className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-700">7 Days Return</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------- Detailed Information ------------------------- */}
      <div className="mt-12 sm:mt-16 border-t border-slate-200 pt-8 sm:pt-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Description Block */}
          <div className="space-y-4 sm:space-y-6 lg:col-span-7">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">Product Overview</h2>
            {product.description ? (
              <div className="prose prose-slate max-w-none text-xs sm:text-sm leading-relaxed text-slate-600">
                <p className="whitespace-pre-line">{product.description}</p>
              </div>
            ) : (
              <p className="text-xs sm:text-sm text-slate-500">No additional details available for this product.</p>
            )}
          </div>

          {/* Specifications Sidebar */}
          <div className="space-y-4 sm:space-y-6 lg:col-span-5">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">Specifications</h2>
            <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-xs sm:text-sm">
              {brandName && (
                <div className="flex justify-between py-2.5">
                  <dt className="text-slate-500">Brand</dt>
                  <dd className="font-semibold text-slate-900">{brandName}</dd>
                </div>
              )}
              {categoryName && (
                <div className="flex justify-between py-2.5">
                  <dt className="text-slate-500">Category</dt>
                  <dd className="font-semibold text-slate-900">{categoryName}</dd>
                </div>
              )}
              <div className="flex justify-between py-2.5">
                <dt className="text-slate-500">Stock Availability</dt>
                <dd className={`font-semibold ${isOutOfStock ? "text-rose-600" : "text-emerald-600"}`}>
                  {isOutOfStock ? "Out of Stock" : `${stock} Units Available`}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* ------------------------- Add Here User Query comment about product ------------------------- */}


      {/* Floating Sticky CTA Bar for Mobile Only */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 p-3 sm:p-4 backdrop-blur-lg sm:hidden shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium text-slate-500">Total Price</p>
            <p className="text-base font-bold text-slate-900">{formatPrice(price)}</p>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock || isAdding}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-md active:scale-95 disabled:opacity-50"
          >
            {isAdding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShoppingCart className="h-4 w-4" />
            )}
            {isOutOfStock ? "Sold Out" : "Add to Cart"}
          </button>
        </div>
      </div>
    </section>
  );
};

export default ProductDetail;