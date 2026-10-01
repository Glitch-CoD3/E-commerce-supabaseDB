import slugify from "slugify";
import { Prisma } from '@prisma/client'
import prisma from "../config/prisma.js";
import { redis } from "../config/redis.config.js";
import { PRODUCTS_CACHE_TTL } from "../constants.js"
import { generateProductListCacheKey as generateCacheKey } from "../utils/productHashCrypto.js";
/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

const PRISMA_ERRORS = {
    P2002: [409, "A record with this unique value already exists."],
    P2003: [400, "A related record referenced in the request does not exist."],
    P2025: [404, "Record not found."]
};

const serializeBigInt = (data) => JSON.parse(JSON.stringify(data, (_, value) =>
    typeof value === "bigint" ? Number(value) : value
));

const parseId = (id) => {
    const value = String(id ?? "");
    return /^\d+$/.test(value) ? BigInt(value) : null;
};

const generateSlug = (name) => slugify(name, {
    lower: true,
    strict: true,
    trim: true
});

const getPagination = (req) => {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const search = String(req.query.search || "");

    return { page, limit, search, offset: (page - 1) * limit };
};

const buildSearchFilter = (search) => search
    ? {
        OR: [
            { productName: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { urlSlug: { contains: search, mode: "insensitive" } }
        ]
    }
    : {};

const buildPaginationLinks = (basePath, { page, limit, totalPages, search }) => {
    const link = (target) =>
        `${basePath}?page=${target}&limit=${limit}&search=${encodeURIComponent(search)}`;

    return {
        self: link(page),
        first: link(1),
        last: link(totalPages),
        previous: page > 1 ? link(page - 1) : null,
        next: page < totalPages ? link(page + 1) : null
    };
};

const handleError = (res, error, context, message) => {
    console.error(`${context}:`, error);

    const mapped = PRISMA_ERRORS[error.code];
    if (mapped) {
        return res.status(mapped[0]).json({ success: false, message: mapped[1] });
    }

    if (error.name === "PrismaClientValidationError") {
        return res.status(400).json({
            success: false,
            message: "Invalid data provided."
        });
    }

    return res.status(500).json({
        success: false,
        message,
        ...(process.env.NODE_ENV !== "production" && { error: error.message })
    });
};

const unique = (values) => [
    ...new Map(values.map((value) => [JSON.stringify(value), value])).values()
];

// Maps each variant colour to its image URL
const buildImagesByColor = (variants) => variants.reduce((images, variant) => {
    variant.images.forEach(({ imageUrl }) => {
        images[variant.colors] = imageUrl;
    });
    return images;
}, {});

const categorySelect = { select: { categoryName: true, urlSlug: true } };
const brandSelect = { select: { id: true, brandName: true, logo: true } };

const variantSelect = {
    sizes: true,
    colors: true,
    images: { where: { deletedAt: null }, select: { imageUrl: true } }
};

// Flat product row + category (snake_case response shape)
const formatProduct = (product) => ({
    id: product.id,
    category_id: product.categoryId,
    brand_id: product.brandId,
    product_name: product.productName,
    url_slug: product.urlSlug,
    description: product.description,
    short_description: product.shortDescription,
    price: product.price,
    stock_quantity: product.stockQuantity,
    status: product.status,
    created_at: product.createdAt,
    updated_at: product.updatedAt,
    deleted_at: product.deletedAt,
    category_name: product.category?.categoryName ?? null,
    category_slug: product.category?.urlSlug ?? null
});

// Product with brand and aggregated variant data
const formatListProduct = (product) => {
    const { variants } = product;

    return {
        id: product.id,
        name: product.productName,
        shortDescription: product.shortDescription,
        description: product.description,
        price: product.price,
        stock_quantity: product.stockQuantity,
        category_id: product.categoryId,
        url_slug: product.urlSlug,
        status: product.status,
        category_name: product.categoryName ?? null,
        category_slug: product.categorySlug ?? null,
        brand_id: product.brandId ?? null,
        brand_name: product.brandName ?? null,
        brand_logo: product.brandLogo ?? null,
        total_variants: variants.length,
        variant_ids: variants.map(({ id }) => id),
        sizes: variants.map(({ sizes }) => sizes),
        colors: variants.map(({ colors }) => colors),
        images: buildImagesByColor(variants),
        variant_stocks: variants.map(({ stockQuantity }) => stockQuantity),
        variant_prices: variants.map(({ price }) => price)
    };
};

/* -------------------------------------------------------------------------- */
/*                                 Controllers                                */
/* -------------------------------------------------------------------------- */

/**
 * @method POST /api/v1/products
 * @description Create a new product
 * @access Private (Admin)
 */
const createProduct = async (req, res) => {
    try {
        const {
            category_id,
            brand_id,
            product_name,
            short_description,
            description,
            price,
            stock_quantity
        } = req.body;

        if (!category_id || !product_name || !price || !brand_id) {
            return res.status(400).json({
                success: false,
                message: "Category Id, Brand Id, product name, price and stock quantity are required."
            });
        }

        if (stock_quantity === undefined || !(Number(stock_quantity) >= 0)) {
            return res.status(400).json({
                success: false,
                message: "Stock quantity is required and must never be negative."
            });
        }

        const categoryId = parseId(category_id);
        const brandId = parseId(brand_id);

        if (!categoryId || !brandId) {
            return res.status(400).json({
                success: false,
                message: "Category Id and Brand Id must be valid numbers."
            });
        }

        // Check category exists
        const category = await prisma.category.findUnique({
            where: { id: categoryId },
            select: { id: true }
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found."
            });
        }

        // Check brand exists
        const brand = await prisma.brand.findUnique({
            where: { id: brandId },
            select: { id: true, brandName: true }
        });

        if (!brand) {
            return res.status(404).json({
                success: false,
                message: "Brand not found."
            });
        }

        const brand_name = brand.brandName;

        // Generate a unique slug
        let slug = generateSlug(product_name);

        const existingSlug = await prisma.product.findFirst({
            where: { urlSlug: slug },
            select: { id: true }
        });

        if (existingSlug) {
            slug = `${slug}-${Date.now()}`;
        }

        const productStatus = Number(stock_quantity) > 0 ? "active" : "inactive";

        const createdProduct = await prisma.product.create({
            data: {
                categoryId,
                brandId,
                productName: product_name,
                urlSlug: slug,
                description: description || "",
                shortDescription: short_description || "",
                price,
                stockQuantity: Number(stock_quantity),
                status: productStatus
            },
            select: { id: true }
        });

        const id = Number(createdProduct.id);

        return res.status(201).json({
            success: true,
            message: "Product created successfully.",
            created_product: {
                id,
                category_id,
                brand_id,
                brand_name,
                product_name,
                url_slug: slug,
                description,
                short_description,
                price,
                stock_quantity,
                status: productStatus
            },
            links: {
                self: `/api/v1/products/${id}`,
                bySlug: `/api/v1/products/slug/${slug}`,
                update: `/api/v1/products/${id}`,
                delete: `/api/v1/products/${id}`,
                allProducts: "/api/v1/products"
            }
        });
    } catch (error) {
        return handleError(res, error, "Create Product Error", "Failed to create product.");
    }
};

/**
 * @method GET /api/v1/products
 * @description Retrieve all products (with pagination and search) including
 *              brand, category and aggregated variant data
 * @access Public
 */

//Raw sql Query For Read data
const getAllProducts = async (req, res) => {
    try {
        // Browser / CDN cache
        res.set("Cache-Control", "public, max-age=60");

        const { page, limit, search, offset } = getPagination(req);

        const {
            categoryId,
            categorySlug,
            categoryName,
            brandId,
            minPrice,
            maxPrice,
            inStock,
            slug,
            productName,
            sortBy,
        } = req.query;


        // =========================================================
        // 1. Generate Deterministic Redis Cache Key
        // =========================================================

        const cacheParams = {
            page,
            limit,
            search,
            categoryId,
            categorySlug,
            categoryName,
            brandId,
            minPrice,
            maxPrice,
            inStock,
            slug,
            productName,
            sortBy,
        };

        const cacheKey = generateCacheKey(cacheParams);

        // =========================================================
        // 2. Redis get cached response if available
        // =========================================================

        try {
            const cachedData = await redis.get(cacheKey);

            if (cachedData) {
                const parsed =
                    typeof cachedData === "string"
                        ? JSON.parse(cachedData)
                        : cachedData;

                console.log(`[Redis] HIT ${cacheKey}`);

                return res.status(200).json(parsed);
            }

            console.log(`[Redis] MISS ${cacheKey}`);
        } catch (redisError) {
            // Redis failure must NOT break product API
            console.error(
                `[Redis] GET failed: ${redisError.message}`
            );
        }

        // =========================================================
        // 3. Build Dynamic WHERE Clauses
        // =========================================================

        const whereClauses = [Prisma.sql`p.deleted_at IS NULL`];

        // General search: product name, short description, description
        if (search) {
            const searchTerm = `%${search}%`;

            whereClauses.push(
                Prisma.sql`(
                    p.product_name ILIKE ${searchTerm}
                    OR p.short_description ILIKE ${searchTerm}
                    OR p.description ILIKE ${searchTerm}
                )`
            );
        }

        // Product name
        if (productName) {
            whereClauses.push(
                Prisma.sql`p.product_name ILIKE ${`%${productName}%`}`
            );
        }

        // Product slug  (?slug=iphone-15-pro)
        if (slug) {
            whereClauses.push(Prisma.sql`p.url_slug = ${slug}`);
        }

        // Category ID
        if (categoryId) {
            const parsedCategoryId = parseInt(categoryId, 10);

            if (!Number.isNaN(parsedCategoryId)) {
                whereClauses.push(
                    Prisma.sql`p.category_id = ${parsedCategoryId}`
                );
            }
        }

        // Category slug  (?categorySlug=watch)
        if (categorySlug) {
            whereClauses.push(
                Prisma.sql`LOWER(c.url_slug) = LOWER(${categorySlug})`
            );

            // Optional: also include products from child categories.
            // Replace the clause above with this one and change `parent_id`
            // to your real parent column name.
            //
            // whereClauses.push(Prisma.sql`(
            //     LOWER(c.url_slug) = LOWER(${categorySlug})
            //     OR c.parent_id = (
            //         SELECT id FROM categories
            //         WHERE LOWER(url_slug) = LOWER(${categorySlug})
            //           AND deleted_at IS NULL
            //     )
            // )`);
        }

        // Category name  (?categoryName=Electronics)
        if (categoryName) {
            whereClauses.push(
                Prisma.sql`c.category_name ILIKE ${`%${categoryName}%`}`
            );
        }

        // Brand ID
        if (brandId) {
            const parsedBrandId = parseInt(brandId, 10);

            if (!Number.isNaN(parsedBrandId)) {
                whereClauses.push(Prisma.sql`p.brand_id = ${parsedBrandId}`);
            }
        }

        // Minimum price  (?minPrice=500)
        if (minPrice !== undefined && minPrice !== "") {
            const parsedMinPrice = parseFloat(minPrice);

            if (!Number.isNaN(parsedMinPrice)) {
                whereClauses.push(Prisma.sql`p.price >= ${parsedMinPrice}`);
            }
        }

        // Maximum price  (?maxPrice=5000)
        if (maxPrice !== undefined && maxPrice !== "") {
            const parsedMaxPrice = parseFloat(maxPrice);

            if (!Number.isNaN(parsedMaxPrice)) {
                whereClauses.push(Prisma.sql`p.price <= ${parsedMaxPrice}`);
            }
        }

        // In stock
        if (inStock === "true") {
            whereClauses.push(Prisma.sql`p.stock_quantity > 0`);
        }

        // Combine WHERE conditions
        const whereSql = Prisma.sql`WHERE ${Prisma.join(
            whereClauses,
            " AND "
        )}`;

        // =========================================================
        // 4. Sorting (id tiebreaker keeps pagination stable)
        // =========================================================

        let orderBySql;

        switch (sortBy) {
            case "oldest":
                orderBySql = Prisma.sql`ORDER BY p.created_at ASC, p.id ASC`;
                break;

            case "price_asc":
                orderBySql = Prisma.sql`ORDER BY p.price ASC, p.id ASC`;
                break;

            case "price_desc":
                orderBySql = Prisma.sql`ORDER BY p.price DESC, p.id DESC`;
                break;

            case "newest":
            default:
                orderBySql = Prisma.sql`ORDER BY p.created_at DESC, p.id DESC`;
        }

        // =========================================================
        // 5. Count + Product Query in Parallel
        // =========================================================

        const [countResult, products] = await Promise.all([
            prisma.$queryRaw`
                SELECT COUNT(*)::int AS total
                FROM products p

                LEFT JOIN categories c
                    ON c.id = p.category_id
                    AND c.deleted_at IS NULL

                ${whereSql}
            `,

            prisma.$queryRaw`
                SELECT
                    p.id,
                    p.product_name        AS "productName",
                    p.short_description   AS "shortDescription",
                    p.description,
                    p.price,
                    p.stock_quantity      AS "stockQuantity",
                    p.category_id         AS "categoryId",
                    p.brand_id            AS "brandId",
                    p.url_slug            AS "urlSlug",
                    p.status,
                    p.created_at          AS "createdAt",
                    p.updated_at          AS "updatedAt",

                    -- Category information
                    c.category_name       AS "categoryName",
                    c.url_slug            AS "categorySlug",

                    -- Brand information
                    b.brand_name          AS "brandName",
                    b.logo                AS "brandLogo",

                    -- Product variants
                    COALESCE(
                        (
                            SELECT jsonb_agg(
                                jsonb_build_object(
                                    'id', v.id,
                                    'stockQuantity', v.stock_quantity,
                                    'price', v.price,
                                    'colors', v.colors,
                                    'sizes', v.sizes,
                                    'images',
                                    (
                                        SELECT COALESCE(
                                            jsonb_agg(
                                                jsonb_build_object(
                                                    'id', i.id,
                                                    'imageUrl', i.image_url,
                                                    'sortOrder', i.sort_order
                                                )
                                                ORDER BY i.sort_order ASC
                                            ),
                                            '[]'::jsonb
                                        )
                                        FROM variant_images i
                                        WHERE
                                            i.product_variant_id = v.id
                                            AND i.deleted_at IS NULL
                                    )
                                )
                                ORDER BY v.id DESC
                            )
                            FROM product_variants v
                            WHERE
                                v.product_id = p.id
                                AND v.deleted_at IS NULL
                        ),
                        '[]'::jsonb
                    ) AS variants

                FROM products p

                LEFT JOIN categories c
                    ON c.id = p.category_id
                    AND c.deleted_at IS NULL

                LEFT JOIN brands b
                    ON b.id = p.brand_id

                ${whereSql}

                ${orderBySql}

                OFFSET ${offset}
                LIMIT ${limit}
            `,
        ]);

        // =========================================================
        // 6. Pagination
        // =========================================================

        const totalProducts = countResult[0]?.total || 0;
        const totalPages = Math.ceil(totalProducts / limit);

        // =========================================================
        // 7. Format Products
        // =========================================================

        const formattedProducts =
            typeof formatListProduct === "function"
                ? products.map(formatListProduct)
                : products;

        // =========================================================
        // 8. Serialize BigInt
        // =========================================================

        const serializedProducts =
            typeof serializeBigInt === "function"
                ? serializeBigInt(formattedProducts)
                : formattedProducts;

        // =========================================================
        // 9. Response Payload
        // =========================================================

        const activeFilters = {
            search,
            productName,
            slug,
            categoryId,
            categorySlug,
            categoryName,
            brandId,
            minPrice,
            maxPrice,
            inStock,
            sortBy,
        };

        const responsePayload = {
            success: true,

            message: serializedProducts.length
                ? "Products fetched successfully."
                : "No products found matching the criteria.",

            meta: {
                total_products: totalProducts,
                total_pages: totalPages,
                current_page: page,
                per_page: limit,
                filters: activeFilters,
            },

            all_products: serializedProducts,

            links:
                typeof buildPaginationLinks === "function"
                    ? buildPaginationLinks("/api/v1/products", {
                        page,
                        limit,
                        totalPages,
                        ...activeFilters,
                    })
                    : null,
        };

        // =========================================================
        // 10. Store Response in Redis
        // =========================================================

        try {
            await redis.set(cacheKey, JSON.stringify(responsePayload),
                {
                    ex: PRODUCTS_CACHE_TTL.LIST,
                }
            );

            console.log(`[Redis] SET ${cacheKey}`);
        } catch (redisError) {
            console.error(
                `[Redis] SET failed: ${redisError.message}`
            );
        }

        // =========================================================
        // 11. Send Response
        // =========================================================

        return res.status(200).json(responsePayload);
    } catch (error) {
        console.error("[Controller Error] getAllProducts failed:", error);

        if (typeof handleError === "function") {
            return handleError(
                res,
                error,
                "Get All Products Error",
                "Failed to retrieve filtered products."
            );
        }

        return res.status(500).json({
            success: false,
            message:
                "An internal server error occurred while retrieving products.",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};


/**
 * @method GET /api/v1/products/:id
 * @description Retrieve a product by its ID with images, colors, brand everything
 * @access Public
 */


const getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        const productId = parseId(id);

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "Valid product ID is required."
            });
        }

        // =========================================================
        // 1. Generate Redis cache key
        // =========================================================

        const cacheKey = `products:item:${productId}`;

        // =========================================================
        // 2. Try Redis cache
        // =========================================================

        try {
            const cachedProduct = await redis.get(cacheKey);

            if (cachedProduct) {
                const parsedProduct =
                    typeof cachedProduct === "string"
                        ? JSON.parse(cachedProduct)
                        : cachedProduct;

                console.log(`[Redis] Product Cache HIT: ${cacheKey}`);

                return res.status(200).json(parsedProduct);
            }

            console.log(`[Redis] Product Cache MISS: ${cacheKey}`);
        } catch (redisErr) {
            // Redis failure should NOT break the API.
            console.error(
                `[Redis] Product GET failed: ${redisErr.message}`
            );
        }

        // =========================================================
        // 3. Cache MISS → Query PostgreSQL
        // =========================================================

        const rows = await prisma.$queryRaw`
    SELECT
        p.id,
        p.product_name         AS product_name,
        p.short_description    AS short_description,
        p.description,
        p.price,
        p.status               AS status,
        p.category_id          AS category_id,
        p.url_slug             AS url_slug,

        c.category_name        AS category_name,
        c.url_slug             AS category_slug,

        b.id                   AS brand_id,
        b.brand_name           AS brand_name,
        b.logo                 AS brand_logo,

        COALESCE(
            json_agg(
                json_build_object(
                    'id', v.id,
                    'sizes', v.sizes,
                    'colors', v.colors,
                    'price', v.price,
                    'stockQuantity', v.stock_quantity,
                    'images', (
                        SELECT COALESCE(
                            json_agg(
                                json_build_object(
                                    'id', i.id,
                                    'imageUrl', i.image_url,
                                    'sortOrder', i.sort_order
                                )
                                ORDER BY i.sort_order ASC
                            ),
                            '[]'::json
                        )
                        FROM variant_images i
                        WHERE
                            i.product_variant_id = v.id
                            AND i.deleted_at IS NULL
                    )
                )
                ORDER BY v.id DESC
            ) FILTER (WHERE v.id IS NOT NULL),
            '[]'::json
        ) AS variants

    FROM products p
    LEFT JOIN categories c
        ON c.id = p.category_id
        AND c.deleted_at IS NULL
    LEFT JOIN brands b
        ON b.id = p.brand_id
    LEFT JOIN product_variants v
        ON v.product_id = p.id
        AND v.deleted_at IS NULL
    WHERE
        p.id = ${productId}
        AND p.deleted_at IS NULL
    GROUP BY p.id, c.id, b.id
    LIMIT 1
`;

        const result = rows[0] ?? null;

        // =========================================================
        // 4. Product not found
        // =========================================================

        if (!result) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        // =========================================================
        // 5. Format product
        // =========================================================

        const variants = result.variants ?? [];

        const product = {
            brand_id: result.brand_id ?? null,
            brand_logo: result.brand_logo ?? null,
            brand_name: result.brand_name ?? null,

            category_id: result.category_id,
            category_name: result.category_name ?? null,
            category_slug: result.category_slug ?? null,

            colors: unique(variants.map(({ colors }) => colors)),

            description: result.description,
            id: result.id,

            images: buildImagesByColor(variants),

            name: result.product_name,
            price: String(result.price),
            shortDescription: result.short_description,

            sizes: unique(variants.map(({ sizes }) => sizes)),

            status: result.status,

            stock_quantity: variants.reduce(
                (total, { stockQuantity }) => total + Number(stockQuantity ?? 0),
                0
            ),

            total_variants: variants.length,
            url_slug: result.url_slug,

            variant_ids: variants.map(({ id }) => id),
            variant_prices: variants.map(({ price }) => Number(price)),
            variant_stocks: variants.map(({ stockQuantity }) => Number(stockQuantity))
        };

        // =========================================================
        // 6. Serialize BigInt
        // =========================================================

        const serializedProduct = serializeBigInt(product);

        // =========================================================
        // 7. Build response
        // =========================================================

        const responsePayload = {
            success: true,
            message: "Product retrieved successfully.",

            product: serializedProduct,

            links: {
                self: `/api/v1/products/${id}`,

                bySlug:
                    `/api/v1/products/slug/${serializedProduct.url_slug}`,

                category:
                    `/api/v1/categories/${serializedProduct.category_id}`,

                update:
                    `/api/v1/products/${id}`,

                updateStatus:
                    `/api/v1/products/${id}/status`,

                delete:
                    `/api/v1/products/${id}`,

                allProducts:
                    "/api/v1/products"
            }
        };

        // =========================================================
        // 8. Store individual product in Redis
        // =========================================================

        try {
            await redis.set(
                cacheKey,
                JSON.stringify(responsePayload),
                {
                    ex: PRODUCTS_CACHE_TTL.PRODUCT
                }
            );

            console.log(
                `[Redis] Product Cache SET: ${cacheKey}`
            );
        } catch (redisErr) {
            // Redis failure should NOT break the API.
            console.error(
                `[Redis] Product SET failed: ${redisErr.message}`
            );
        }

        // =========================================================
        // 9. Return response
        // =========================================================

        return res.status(200).json(responsePayload);

    } catch (error) {
        return handleError(
            res,
            error,
            "Get Product By ID Error",
            "Failed to retrieve product."
        );
    }
};


/**
 * @method GET /api/v1/products/slug/:slug
 * @description Retrieve a product by its URL slug
 * @access Public
 */

const getProductBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        if (!slug) {
            return res.status(400).json({
                success: false,
                message: "Product slug is required."
            });
        }

        // =========================================================
        // 1. Generate Redis cache key
        // =========================================================

        const cacheKey = `products:slug:${slug}`;

        // =========================================================
        // 2. Try Redis cache
        // =========================================================

        try {
            const cachedProduct = await redis.get(cacheKey);

            if (cachedProduct) {
                const parsedProduct =
                    typeof cachedProduct === "string"
                        ? JSON.parse(cachedProduct)
                        : cachedProduct;

                console.log(
                    `[Redis] Product Slug Cache HIT: ${cacheKey}`
                );

                return res.status(200).json(parsedProduct);
            }

            console.log(
                `[Redis] Product Slug Cache MISS: ${cacheKey}`
            );
        } catch (redisErr) {
            // Redis failure should NOT break the API.
            console.error(
                `[Redis] Slug GET failed: ${redisErr.message}`
            );
        }

        // =========================================================
        // 3. Cache MISS → Database
        // =========================================================

        const result = await prisma.product.findFirst({
            where: {
                urlSlug: slug,
                deletedAt: null
            },
            include: {
                category: categorySelect
            }
        });

        // =========================================================
        // 4. Product not found
        // =========================================================

        if (!result) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        // =========================================================
        // 5. Format product
        // =========================================================

        const product = formatProduct(result);

        const serializedProduct = serializeBigInt(product);

        // =========================================================
        // 6. Build response
        // =========================================================

        const responsePayload = {
            success: true,

            message: "Product retrieved successfully.",

            product: serializedProduct,

            links: {
                self: `/api/v1/products/slug/${slug}`,

                byId:
                    `/api/v1/products/${serializedProduct.id}`,

                category:
                    `/api/v1/categories/${serializedProduct.category_id}`,

                update:
                    `/api/v1/products/${serializedProduct.id}`,

                updateStatus:
                    `/api/v1/products/${serializedProduct.id}/status`,

                delete:
                    `/api/v1/products/${serializedProduct.id}`,

                allProducts:
                    "/api/v1/products"
            }
        };

        // =========================================================
        // 7. Store in Redis
        // =========================================================

        try {
            await redis.set(
                cacheKey,
                JSON.stringify(responsePayload),
                {
                    ex: PRODUCTS_CACHE_TTL.SLUG
                }
            );

            console.log(
                `[Redis] Product Slug Cache SET: ${cacheKey}`
            );
        } catch (redisErr) {
            // Redis failure should NOT break the API.
            console.error(
                `[Redis] Slug SET failed: ${redisErr.message}`
            );
        }

        // =========================================================
        // 8. Return response
        // =========================================================

        return res.status(200).json(responsePayload);

    } catch (error) {
        return handleError(
            res,
            error,
            "Get Product By Slug Error",
            "Failed to retrieve product."
        );
    }
};


// Request field -> Prisma field (fields allowed for PATCH)
const allowedFields = {
    category_id: "categoryId",
    product_name: "productName",
    description: "description",
    short_description: "shortDescription",
    price: "price",
    stock_quantity: "stockQuantity",
    status: "status"
};

/**
 * @method PATCH /api/v1/products/:id
 * @description Update a product by its ID
 * @access Private (Admin)
 */
const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const productId = parseId(id);

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "Valid product ID is required."
            });
        }

        // Check product exists
        const existingProduct = await prisma.product.findFirst({
            where: { id: productId, deletedAt: null }
        });

        if (!existingProduct) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        const data = {};

        for (const [field, column] of Object.entries(allowedFields)) {
            // Skip fields not included in request
            if (!Object.prototype.hasOwnProperty.call(req.body, field)) {
                continue;
            }

            const value = req.body[field];

            switch (field) {
                case "category_id": {
                    const categoryId = parseId(value);

                    const category = categoryId && await prisma.category.findFirst({
                        where: { id: categoryId, deletedAt: null },
                        select: { id: true }
                    });

                    if (!category) {
                        return res.status(404).json({
                            success: false,
                            message: "Category not found."
                        });
                    }

                    data.categoryId = categoryId;
                    break;
                }

                case "product_name": {
                    data.productName = value;

                    if (value !== existingProduct.productName) {
                        let slug = generateSlug(value);

                        const slugExists = await prisma.product.findFirst({
                            where: { urlSlug: slug, NOT: { id: productId } },
                            select: { id: true }
                        });

                        if (slugExists) {
                            slug = `${slug}-${Date.now()}`;
                        }

                        data.urlSlug = slug;
                    }
                    break;
                }

                case "price":
                case "stock_quantity":
                    data[column] = Number(value);
                    break;

                default:
                    data[column] = value;
            }
        }

        if (!Object.keys(data).length) {
            return res.status(400).json({
                success: false,
                message: "No fields provided for update."
            });
        }

        const updatedProduct = await prisma.product.update({
            where: { id: productId },
            data: { ...data, updatedAt: new Date() },
            include: { category: categorySelect }
        });

        const updated_product = formatProduct(updatedProduct);

        return res.status(200).json({
            success: true,
            message: "Product updated successfully.",
            updated_product: serializeBigInt(updated_product),
            links: {
                self: `/api/v1/products/${id}`,
                by_slug: `/api/v1/products/slug/${updated_product.url_slug}`,
                category: `/api/v1/categories/${updated_product.category_id}`,
                all_products: "/api/v1/products",
                delete: `/api/v1/products/${id}`
            }
        });
    } catch (error) {
        return handleError(res, error, "Update Product Error", "Failed to update product.");
    }
};

/**
 * @method DELETE /api/v1/products/:id
 * @description Soft delete a product by its ID
 * @access Private (Admin)
 */
const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const productId = parseId(id);

        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "Valid product ID is required."
            });
        }

        // Check if product exists
        const product = await prisma.product.findFirst({
            where: { id: productId, deletedAt: null },
            select: { id: true, productName: true }
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        // Soft delete
        const deletedAt = new Date();

        await prisma.product.update({
            where: { id: productId },
            data: { deletedAt }
        });

        return res.status(200).json({
            success: true,
            message: "Product deleted successfully.",
            deleted_product: {
                id: Number(id),
                product_name: product.productName,
                deleted_at: deletedAt.toISOString()
            },
            links: {
                allProducts: "/api/v1/products",
                create: "/api/v1/products/create-product"
            }
        });
    } catch (error) {
        return handleError(res, error, "Delete Product Error", "Failed to delete product.");
    }
};

const allowedStatuses = ["inactive", "active", "discontinued"];

/**
 * @method PATCH /api/v1/products/:id/status
 * @description Update the status of a product
 * @access Private (Admin)
 */
const updateProductStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const productId = parseId(id);

        // Validate product ID
        if (!productId) {
            return res.status(400).json({
                success: false,
                message: "Valid product ID is required."
            });
        }

        // Validate status
        if (typeof status !== "string" || status.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Product status is required."
            });
        }

        const normalizedStatus = status.trim().toLowerCase();

        if (!allowedStatuses.includes(normalizedStatus)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Allowed values are: ${allowedStatuses.join(", ")}`
            });
        }

        // Check product exists
        const product = await prisma.product.findFirst({
            where: { id: productId, deletedAt: null },
            select: { id: true, status: true }
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        // Check if status is already the same
        if (product.status === normalizedStatus) {
            return res.status(200).json({
                success: true,
                message: "Product status is already up to date.",
                data: {
                    id: Number(id),
                    status: product.status
                }
            });
        }

        // Update status
        await prisma.product.update({
            where: { id: productId },
            data: { status: normalizedStatus, updatedAt: new Date() }
        });

        return res.status(200).json({
            success: true,
            message: "Product status updated successfully.",
            updated_status: {
                id: Number(id),
                status: normalizedStatus
            },
            links: {
                self: `/api/v1/products/${id}`,
                product: `/api/v1/products/${id}`,
                update: `/api/v1/products/${id}`,
                delete: `/api/v1/products/${id}`,
                allProducts: "/api/v1/products"
            }
        });
    } catch (error) {
        return handleError(res, error, "Update Product Status Error", "Failed to update product status.");
    }
};

/**
 * @method GET /api/v1/products/category/:categoryId
 * @description Retrieve all products belonging to a category
 * @access Public
 */
const getProductsByCategoryId = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const { page, limit, search, offset } = getPagination(req);
        const parsedCategoryId = parseId(categoryId);

        if (!parsedCategoryId) {
            return res.status(400).json({
                success: false,
                message: "Valid category ID is required."
            });
        }

        // Check category exists
        const category = await prisma.category.findUnique({
            where: { id: parsedCategoryId },
            select: { id: true, categoryName: true }
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found."
            });
        }

        const where = {
            categoryId: parsedCategoryId,
            deletedAt: null,
            ...buildSearchFilter(search)
        };

        const [totalProducts, products] = await Promise.all([
            prisma.product.count({ where }),
            prisma.product.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: offset,
                take: limit,
                include: { category: categorySelect }
            })
        ]);

        const totalPages = Math.ceil(totalProducts / limit);
        const basePath = `/api/v1/products/category/${categoryId}`;

        return res.status(200).json({
            success: true,
            message: products.length
                ? "Products retrieved successfully."
                : "No products found in this category.",
            meta: {
                category_id: Number(categoryId),
                category_name: category.categoryName,
                total_products: totalProducts,
                total_pages: totalPages,
                current_page: page,
                per_page: limit,
                search
            },
            products: serializeBigInt(products.map(formatProduct)),
            links: {
                category: `/api/v1/categories/${categoryId}`,
                allProducts: "/api/v1/products",
                ...buildPaginationLinks(basePath, { page, limit, totalPages, search })
            }
        });
    } catch (error) {
        return handleError(res, error, "Get Products By Category Error", "Failed to retrieve category products.");
    }
};

/**
 * @method GET /api/v1/products/deleted
 * @description Get all soft deleted products
 * @access Private (Admin)
 */
const getAllDeletedProducts = async (req, res) => {
    try {
        const { page, limit, search, offset } = getPagination(req);

        const where = { deletedAt: { not: null }, ...buildSearchFilter(search) };

        const [totalProducts, products] = await Promise.all([
            prisma.product.count({ where }),
            prisma.product.findMany({
                where,
                orderBy: { deletedAt: "desc" },
                skip: offset,
                take: limit,
                include: { category: categorySelect }
            })
        ]);

        const totalPages = Math.ceil(totalProducts / limit);

        return res.status(200).json({
            success: true,
            message: products.length
                ? "Deleted products fetched successfully."
                : "No deleted products found.",
            meta: {
                total_deleted_products: totalProducts,
                total_pages: totalPages,
                current_page: page,
                per_page: limit,
                search
            },
            All_deleted_product: serializeBigInt(products.map(formatProduct)),
            links: buildPaginationLinks("/api/v1/products/deleted", { page, limit, totalPages, search })
        });
    } catch (error) {
        return handleError(res, error, "Get Deleted Products Error", "Failed to retrieve deleted products.");
    }
};



export {
    createProduct,
    getAllProducts,
    getProductById,
    getProductBySlug,
    updateProduct,
    updateProductStatus,
    deleteProduct,
    getProductsByCategoryId,
    getAllDeletedProducts,

};