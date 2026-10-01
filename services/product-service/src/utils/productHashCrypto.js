import crypto from "crypto";

export const generateProductListCacheKey = (params) => {
    const normalized = {
        page: Number(params.page) || 1,
        limit: Number(params.limit) || 10,
        search: params.search || "",
        categoryId: params.categoryId || "",
        categorySlug: params.categorySlug || "",
        categoryName: params.categoryName || "",
        brandId: params.brandId || "",
        minPrice: params.minPrice || "",
        maxPrice: params.maxPrice || "",
        inStock: params.inStock === "true",
        slug: params.slug || "",
        productName: params.productName || "",
        sortBy: params.sortBy || "newest",
    };

    const canonicalString = Object.entries(normalized)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${String(value)}`)
        .join("&");

    const hash = crypto
        .createHash("sha256")
        .update(canonicalString)
        .digest("hex")
        .slice(0, 32);

    return `products:list:${hash}`;
};