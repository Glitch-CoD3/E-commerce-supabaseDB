"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Categories from "./Categories";
import Filter from "./Filter";
import ProductCard from "./ProductCard.jsx";
import { getAllProducts } from "../services/product.service.js";
import { useUpdateQuery } from "../hooks/useUpdateQuery.js";

const FILTER_KEYS = ["search", "minPrice", "maxPrice", "inStock", "sortBy", "page"];
const PAGE_SIZE = { products: 12, Homepage: 8 };

const ProductList = ({ category, params }) => {
  const searchParams = useSearchParams();
  const updateQuery = useUpdateQuery();
  const isProductsPage = params === "products";

  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const qs = searchParams.toString();

  // Build the API query. The homepage ignores URL filters.
  const query = useMemo(() => {
    const q = { limit: PAGE_SIZE[params] ?? 12 };
    if (category && category !== "all") q.categorySlug = category;

    if (isProductsPage) {
      const current = new URLSearchParams(qs);
      FILTER_KEYS.forEach((key) => {
        const value = current.get(key);
        if (value) q[key] = value;
      });
    }
    return q;
  }, [qs, category, params, isProductsPage]);

  useEffect(() => {
    let cancelled = false; // ignore stale responses if filters change quickly

    const fetchProducts = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await getAllProducts(query);
        if (cancelled) return;
        setProducts(response.all_products ?? []);
        setMeta(response.meta ?? null);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to fetch products:", err);
        setProducts([]);
        setError("Something went wrong while loading products.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchProducts();
    return () => {
      cancelled = true;
    };
  }, [query]);

  const currentPage = meta?.current_page ?? 1;
  const totalPages = meta?.total_pages ?? 1;

  return (
    <div className="w-full">
      <Categories />

      {isProductsPage && <Filter />}

      {loading ? (
        <p className="text-center text-gray-500 py-16">Loading products...</p>
      ) : error ? (
        <p className="text-center text-red-500 py-16">{error}</p>
      ) : products.length === 0 ? (
        <p className="text-center text-gray-500 py-16">
          No products found. Try changing your search or filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-12">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {isProductsPage && totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-10 text-sm">
          <button
            disabled={currentPage <= 1}
            onClick={() => updateQuery({ page: currentPage - 1 })}
            className="px-3 py-1 ring-1 ring-gray-200 rounded-sm disabled:opacity-40"
          >
            Previous
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => updateQuery({ page: currentPage + 1 })}
            className="px-3 py-1 ring-1 ring-gray-200 rounded-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {params === "Homepage" && (
        <Link
          href={category ? `/products?category=${category}` : "/products"}
          className="flex justify-end mt-4 underline text-sm text-gray-500"
        >
          View All Products
        </Link>
      )}
    </div>
  );
};

export default ProductList;