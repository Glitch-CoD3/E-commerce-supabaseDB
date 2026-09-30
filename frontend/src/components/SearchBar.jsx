"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const SearchBar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("search") ?? "");

  // Keep input in sync with the URL (back/forward, clear filters)
  useEffect(() => {
    setValue(searchParams.get("search") ?? "");
  }, [searchParams]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const term = value.trim();

    // Preserve existing filters only if we're already on the products page
    const params = new URLSearchParams(
      pathname === "/products" ? searchParams.toString() : ""
    );
    if (term) params.set("search", term);
    else params.delete("search");
    params.delete("page");

    const qs = params.toString();
    router.push(qs ? `/products?${qs}` : "/products");
  };

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className="hidden sm:flex items-center gap-2 rounded-md ring-1 ring-gray-200 px-2 py-1 shadow-md"
    >
      <button type="submit" aria-label="Search">
        <Search className="w-4 h-4 text-gray-500" />
      </button>
      <input
        id="search"
        name="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search..."
        className="text-sm outline-0"
      />
    </form>
  );
};

export default SearchBar;