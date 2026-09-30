"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useUpdateQuery } from "../hooks/useUpdateQuery";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
];

const Filter = () => {
  const searchParams = useSearchParams();
  const updateQuery = useUpdateQuery();

  const sortBy = searchParams.get("sortBy") ?? "newest";
  const inStock = searchParams.get("inStock") === "true";

  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? "");
  const [priceError, setPriceError] = useState("");

  useEffect(() => {
    setMinPrice(searchParams.get("minPrice") ?? "");
    setMaxPrice(searchParams.get("maxPrice") ?? "");
  }, [searchParams]);

  const applyPrice = (e) => {
    e.preventDefault();
    const min = minPrice === "" ? null : Number(minPrice);
    const max = maxPrice === "" ? null : Number(maxPrice);

    if ((min !== null && (Number.isNaN(min) || min < 0)) ||
        (max !== null && (Number.isNaN(max) || max < 0))) {
      return setPriceError("Enter valid prices.");
    }
    if (min !== null && max !== null && min > max) {
      return setPriceError("Min price can't be higher than max price.");
    }

    setPriceError("");
    updateQuery({ minPrice: min, maxPrice: max });
  };

  const clearAll = () => {
    setPriceError("");
    updateQuery({
      search: null,
      minPrice: null,
      maxPrice: null,
      inStock: null,
      sortBy: null,
    });
  };

  const hasActiveFilters = ["search", "minPrice", "maxPrice", "inStock", "sortBy"].some(
    (k) => searchParams.has(k)
  );

  return (
    <div className="flex flex-wrap items-end justify-between gap-4 text-sm text-gray-500 my-6">
      <div className="flex flex-wrap items-end gap-4">
        <form onSubmit={applyPrice} className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="minPrice">Min price</label>
            <input
              id="minPrice"
              type="number"
              min="0"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="ring-1 ring-gray-200 shadow-md p-1 rounded-sm w-24"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="maxPrice">Max price</label>
            <input
              id="maxPrice"
              type="number"
              min="0"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="ring-1 ring-gray-200 shadow-md p-1 rounded-sm w-24"
            />
          </div>
          <button type="submit" className="ring-1 ring-gray-200 shadow-md px-3 py-1 rounded-sm">
            Apply
          </button>
        </form>

        <label className="flex items-center gap-2 pb-1">
          <input
            type="checkbox"
            checked={inStock}
            onChange={(e) => updateQuery({ inStock: e.target.checked ? "true" : null })}
          />
          In stock only
        </label>

        {hasActiveFilters && (
          <button type="button" onClick={clearAll} className="underline pb-1">
            Clear filters
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span>Sort by:</span>
        <select
          id="sort"
          value={sortBy}
          onChange={(e) => updateQuery({ sortBy: e.target.value })}
          className="ring-1 ring-gray-200 shadow-md p-1 rounded-sm"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {priceError && <p className="w-full text-red-500">{priceError}</p>}
    </div>
  );
};

export default Filter;