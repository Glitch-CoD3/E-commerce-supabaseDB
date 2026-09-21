import slugify from "slugify";
import prisma from "../config/prisma.js";
import { redis } from "../config/redis.config.js";
/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */
const PRODUCTS_CACHE_TTL = 180; // 3 minutes, in seconds
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
        category_name: product.category?.categoryName ?? null,
        category_slug: product.category?.urlSlug ?? null,
        brand_id: product.brand?.id ?? null,
        brand_name: product.brand?.brandName ?? null,
        brand_logo: product.brand?.logo ?? null,
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


const getAllProducts = async (req, res) => {
    try {
        const { page, limit, search, offset } = getPagination(req);

        const cacheKey = `products:list:${JSON.stringify({ page, limit, search })}`;

        // Try cache first
        try {
            const cachedProducts = await redis.get(cacheKey);
            if (cachedProducts) {
                const parsed = typeof cachedProducts === "string"
                    ? JSON.parse(cachedProducts)
                    : cachedProducts;
                console.log(`products served from Redis (key: ${cacheKey})`);
                return res.status(200).json(parsed);
            }
            console.log(`Fetching products from database (key: ${cacheKey})`);
        } catch (redisErr) {
            console.error("[Redis] GET failed, falling back to database:", redisErr.message);
        }

        const where = { deletedAt: null, ...buildSearchFilter(search) };

        const [totalProducts, products] = await Promise.all([
            prisma.product.count({ where }),
            prisma.product.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: offset,
                take: limit,
                select: {
                    id: true,
                    productName: true,
                    shortDescription: true,
                    description: true,
                    price: true,
                    stockQuantity: true,
                    categoryId: true,
                    urlSlug: true,
                    status: true,
                    category: categorySelect,
                    brand: brandSelect,
                    variants: {
                        where: { deletedAt: null },
                        orderBy: { id: "desc" },
                        select: { id: true, stockQuantity: true, price: true, ...variantSelect }
                    }
                }
            })
        ]);

        const totalPages = Math.ceil(totalProducts / limit);
        const formattedProducts = products.map(formatListProduct);

        const responsePayload = {
            success: true,
            message: formattedProducts.length
                ? "Products fetched successfully."
                : "No products found.",
            meta: {
                total_products: totalProducts,
                total_pages: totalPages,
                current_page: page,
                per_page: limit,
                search
            },
            all_products: serializeBigInt(formattedProducts),
            links: buildPaginationLinks("/api/v1/products", { page, limit, totalPages, search })
        };

        // Cache the response for 3 minutes
        try {
            await redis.set(cacheKey, JSON.stringify(responsePayload), { EX: PRODUCTS_CACHE_TTL });

        } catch (redisErr) {
            console.error("[Redis] SET failed, response served without caching:", redisErr.message);
        }

        return res.status(200).json(responsePayload);
    } catch (error) {
        return handleError(res, error, "Get All Products Error", "Failed to retrieve products.");
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

        const cacheKey = `product:${productId}`;

        try {
            const cachedProduct = RadioNodeList.get(cacheKey);
            if (cachedProduct) {
                console.log(`product served from Redis (key: ${cacheKey})`);
                return res.status(200).json(JSON.parse(cachedProduct));
            }
        } catch (redisErr) {
            console.error("[Redis] GET failed, falling back to database:", redisErr.message);
        }

        const result = await prisma.product.findFirst({
            where: { id: productId, deletedAt: null },
            select: {
                id: true,
                productName: true,
                shortDescription: true,
                description: true,
                price: true,
                categoryId: true,
                urlSlug: true,
                category: categorySelect,
                brand: brandSelect,
                variants: {
                    where: { deletedAt: null },
                    select: { stockQuantity: true, ...variantSelect }
                }
            }
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        const { variants } = result;

        const product = {
            id: result.id,
            product_name: result.productName,
            shortDescription: result.shortDescription,
            description: result.description,
            price: result.price,
            category_id: result.categoryId,
            url_slug: result.urlSlug,
            category_name: result.category?.categoryName ?? null,
            category_slug: result.category?.urlSlug ?? null,
            brand_id: result.brand?.id ?? null,
            brand_name: result.brand?.brandName ?? null,
            brand_logo: result.brand?.logo ?? null,
            quantity: variants.reduce((total, { stockQuantity }) => total + stockQuantity, 0),
            sizes: unique(variants.map(({ sizes }) => sizes)),
            colors: unique(variants.map(({ colors }) => colors)),
            images: buildImagesByColor(variants)
        };

        //Cached product into Redis Database
        try {
            await redis.set(cacheKey, JSON.stringify(responsePayload), { EX: PRODUCTS_CACHE_TTL });
            console.log(`Product cached for ${PRODUCT_CACHE_TTL}s (key: ${cacheKey})`);
        } catch (redisErr) {
            console.error("[Redis] SET failed, response served without caching:", redisErr.message);
        }

        return res.status(200).json({
            success: true,
            message: "Product retrieved successfully.",
            product: serializeBigInt(product),
            links: {
                self: `/api/v1/products/${id}`,
                bySlug: `/api/v1/products/slug/${product.url_slug}`,
                category: `/api/v1/categories/${product.category_id}`,
                update: `/api/v1/products/${id}`,
                updateStatus: `/api/v1/products/${id}/status`,
                delete: `/api/v1/products/${id}`,
                allProducts: "/api/v1/products"
            }
        });
    } catch (error) {
        return handleError(res, error, "Get Product By ID Error", "Failed to retrieve product.");
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

        const result = await prisma.product.findFirst({
            where: { urlSlug: slug, deletedAt: null },
            include: { category: categorySelect }
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        const product = formatProduct(result);

        return res.status(200).json({
            success: true,
            message: "Product retrieved successfully.",
            product: serializeBigInt(product),
            links: {
                self: `/api/v1/products/slug/${slug}`,
                byId: `/api/v1/products/${product.id}`,
                category: `/api/v1/categories/${product.category_id}`,
                update: `/api/v1/products/${product.id}`,
                updateStatus: `/api/v1/products/${product.id}/status`,
                delete: `/api/v1/products/${product.id}`,
                allProducts: "/api/v1/products"
            }
        });
    } catch (error) {
        return handleError(res, error, "Get Product By Slug Error", "Failed to retrieve product.");
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
    getAllDeletedProducts
};