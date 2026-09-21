import { ProductSize } from "@prisma/client";
import prisma from "../config/prisma.js";

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

// Allowed sizes come straight from the Prisma enum; "3XL" (the DB value) is accepted as an alias of X3L
const ALLOWED_SIZES = Object.values(ProductSize);
const SIZE_ALIASES = { "3XL": ProductSize.X3L };

const PRISMA_ERRORS = {
    P2002: [409, "A record with this unique value already exists."],
    P2003: [400, "The operation conflicts with a related record."],
    P2025: [404, "Record not found."]
};

const serialize = (data) => JSON.parse(JSON.stringify(data, (_, value) =>
    typeof value === "bigint" ? Number(value) : value
));

const parseId = (id) => {
    const value = String(id ?? "");
    return /^\d+$/.test(value) ? BigInt(value) : null;
};

// True when a value was actually provided (not undefined, null or blank)
const isValid = (val) => val !== undefined && val !== null && String(val).trim() !== "";

// Sizes are stored as the ProductSize enum, so they must be upper-case enum names
const normalizeSize = (size) => {
    const value = String(size).trim().toUpperCase();
    return SIZE_ALIASES[value] ?? value;
};

const sendError = (res, status, message) =>
    res.status(status).json({ success: false, message });

const handleError = (res, error, context, message) => {
    console.error(`${context}:`, error);

    const mapped = PRISMA_ERRORS[error.code];
    if (mapped) {
        return sendError(res, mapped[0], mapped[1]);
    }

    if (error.name === "PrismaClientValidationError") {
        return sendError(res, 400, "Invalid data provided.");
    }

    return res.status(500).json({
        success: false,
        message,
        ...(process.env.NODE_ENV !== "production" && { error: error.message })
    });
};

const getPagination = (req) => {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);

    return {
        page,
        limit,
        offset: (page - 1) * limit,
        valid: Number.isInteger(page) && Number.isInteger(limit) && page >= 1 && limit >= 1
    };
};

const buildPaginationLinks = (basePath, { page, limit, total, extraQuery = "" }) => {
    const link = (target) => `${basePath}?page=${target}&limit=${limit}${extraQuery}`;

    return {
        self: link(page),
        next: page * limit < total ? link(page + 1) : null,
        prev: page > 1 ? link(page - 1) : null
    };
};

/* -------------------------------------------------------------------------- */
/*                                 Controllers                                */
/* -------------------------------------------------------------------------- */

/**
 * @method POST /api/v1/product-variants
 * @description Create a product variant
 * @access Private (Admin)
 */
const createProductVariant = async (req, res) => {
    try {
        const { product_id, color, size, price, stock_quantity } = req.body;

        // Validation
        const productId = parseId(product_id);

        if (!productId) {
            return sendError(res, 400, "Valid product ID is required.");
        }

        if (!color) {
            return sendError(res, 400, "Product colors required");
        }

        if (!(Number(price) > 0)) {
            return sendError(res, 400, "Valid price is required.");
        }

        if (
            stock_quantity === undefined ||
            stock_quantity === null ||
            !(Number(stock_quantity) >= 0)
        ) {
            return sendError(res, 400, "Valid stock quantity is required.");
        }

        const formattedSize = isValid(size) ? normalizeSize(size) : null;

        if (formattedSize && !ALLOWED_SIZES.includes(formattedSize)) {
            return sendError(
                res,
                400,
                `Invalid size '${size}'. Allowed sizes are: ${ALLOWED_SIZES.join(", ")}.`
            );
        }

        // Check product
        const product = await prisma.product.findFirst({
            where: { id: productId, deletedAt: null },
            select: { id: true, status: true, stockQuantity: true }
        });

        if (!product) {
            return sendError(res, 404, "Product not found.");
        }

        if (product.status !== "active") {
            return sendError(res, 400, "Cannot create variant for an inactive product.");
        }

        // Prevent duplicate variant
        const exists = await prisma.productVariant.findFirst({
            where: { productId, colors: color },
            select: { id: true }
        });

        if (exists) {
            return sendError(res, 409, "This variant already exists.");
        }

        // Insert variant
        const variant = await prisma.productVariant.create({
            data: {
                productId,
                colors: color,
                sizes: formattedSize,
                price,
                stockQuantity: Number(stock_quantity)
            }
        });

        return res.status(201).json({
            success: true,
            message: "Product variant created successfully.",
            created_varient: serialize(variant),
            links: {
                self: `/api/v1/product-variants/${variant.id}`,
                product: `/api/v1/products/${product_id}`,
                all_variants: `/api/v1/products/${product_id}/variants`
            }
        });
    } catch (error) {
        return handleError(res, error, "Create Product Variant Error", "Failed to create product variant.");
    }
};

/**
 * @method GET /api/v1/product-variants/details
 * @description Get all product variants with product details
 * @access Private (Admin)
 */
const getAllProductVariantsWithProductDetails = async (req, res) => {
    try {
        const { product_id } = req.query;
        const { page, limit, offset, valid } = getPagination(req);

        if (!valid) {
            return sendError(res, 400, "Page and limit must be greater than 0.");
        }

        const productId = product_id ? parseId(product_id) : undefined;

        if (product_id && !productId) {
            return sendError(res, 400, "Valid product ID is required.");
        }

        const where = {
            deletedAt: null,
            product: { deletedAt: null },
            ...(productId && { productId })
        };

        const [total, variants] = await Promise.all([
            prisma.productVariant.count({ where }),
            prisma.productVariant.findMany({
                where,
                orderBy: { id: "desc" },
                skip: offset,
                take: limit,
                include: { product: { select: { productName: true, status: true } } }
            })
        ]);

        const formattedVariants = variants.map(({ product, ...variant }) => ({
            ...variant,
            product_name: product.productName,
            product_status: product.status
        }));

        return res.status(200).json({
            success: true,
            message: "Product variants retrieved successfully.",
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            Total_vatient_with_productDetails: serialize(formattedVariants),
            links: buildPaginationLinks("/api/v1/product-variants", { page, limit, total })
        });
    } catch (error) {
        return handleError(res, error, "Get All Product Variants Error", "Failed to retrieve product variants.");
    }
};

/**
 * @method GET /api/v1/product-variants
 * @description Get all product variants (optionally filtered by product ID)
 * @access Private (Admin)
 */
const getAllProductVariants = async (req, res) => {
    try {
        res.set("Cache-Control", "public, max-age=60");
        const { product_id } = req.query;
        const { page, limit, offset, valid } = getPagination(req);

        if (!valid) {
            return sendError(res, 400, "Page and limit must be greater than 0.");
        }

        const productId = product_id ? parseId(product_id) : undefined;

        if (product_id && !productId) {
            return sendError(res, 400, "Valid product ID is required.");
        }

        const where = productId ? { productId } : {};

        const [total, variants] = await Promise.all([
            prisma.productVariant.count({ where }),
            prisma.productVariant.findMany({
                where,
                orderBy: { id: "desc" },
                skip: offset,
                take: limit
            })
        ]);

        return res.status(200).json({
            success: true,
            message: "Product variants retrieved successfully.",
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            all_product_varients: serialize(variants),
            links: buildPaginationLinks("/api/v1/product-variants", {
                page,
                limit,
                total,
                extraQuery: product_id ? `&product_id=${product_id}` : ""
            })
        });
    } catch (error) {
        return handleError(res, error, "Get All Product Variants Error", "Failed to retrieve product variants.");
    }
};

/**
 * @method GET /api/v1/product-variants/:id
 * @description Get a product variant by its ID
 * @access Private (Admin)
 */
const getProductVariantById = async (req, res) => {
    try {
        const { id } = req.params;
        const variantId = parseId(id);

        if (!variantId) {
            return sendError(res, 400, "Valid variant ID is required.");
        }

        const variant = await prisma.productVariant.findUnique({
            where: { id: variantId }
        });

        if (!variant) {
            return sendError(res, 404, "Product variant not found.");
        }

        return res.status(200).json({
            success: true,
            message: "Product variant retrieved successfully.",
            product_varient: serialize(variant),
            links: {
                self: `/api/v1/product-variants/${variant.id}`,
                product: `/api/v1/products/${variant.productId}`,
                all_variants: `/api/v1/products/${variant.productId}/variants`
            }
        });
    } catch (error) {
        return handleError(res, error, "Get Product Variant By ID Error", "Failed to retrieve product variant.");
    }
};

/**
 * @method GET /api/v1/products/:productId/variants
 * @description Get all variants of a product
 * @access Private (Admin)
 */
const getVariantsByProductId = async (req, res) => {
    try {
        const { productId } = req.params;
        const parsedProductId = parseId(productId);

        if (!parsedProductId) {
            return sendError(res, 400, "A valid numeric Product ID is required.");
        }

        // Check product existence
        const product = await prisma.product.findUnique({
            where: { id: parsedProductId },
            select: { id: true }
        });

        if (!product) {
            return sendError(res, 404, "Product not found.");
        }

        const variants = await prisma.productVariant.findMany({
            where: { productId: parsedProductId },
            orderBy: { id: "asc" }
        });

        if (!variants.length) {
            return res.status(404).json({
                success: false,
                message: "No variants found for this product.",
                data: []
            });
        }

        return res.status(200).json({
            success: true,
            message: "Product variants retrieved successfully.",
            count: variants.length,
            varients: serialize(variants),
            links: {
                self: `/api/v1/products/${productId}/variants`,
                product: `/api/v1/products/${productId}`
            }
        });
    } catch (error) {
        return handleError(res, error, "Get Variants By Product ID Error", "Failed to retrieve product variants.");
    }
};

/**
 * @method PATCH /api/v1/product-variants/:id
 * @description Update a product variant
 * @access Private (Admin)
 */
const updateProductVariant = async (req, res) => {
    try {
        const { id } = req.params;
        const { color, size, price, stock_quantity } = req.body;
        const variantId = parseId(id);

        if (!variantId) {
            return sendError(res, 400, "Valid variant ID is required.");
        }

        // Check variant exists
        const variant = await prisma.productVariant.findUnique({
            where: { id: variantId }
        });

        if (!variant) {
            return sendError(res, 404, "Product variant not found.");
        }

        // Validation
        if (!isValid(color) && !isValid(size) && !isValid(price) && !isValid(stock_quantity)) {
            return sendError(
                res,
                400,
                "At least one valid field (color, size, price, stock_quantity) is required to update."
            );
        }

        if (isValid(size) && !ALLOWED_SIZES.includes(normalizeSize(size))) {
            return sendError(
                res,
                400,
                `Invalid size '${size}'. Allowed sizes are: ${ALLOWED_SIZES.join(", ")}.`
            );
        }

        if (isValid(price) && !(Number(price) > 0)) {
            return sendError(res, 400, "Price must be greater than 0.");
        }

        if (isValid(stock_quantity) && !(Number(stock_quantity) >= 0)) {
            return sendError(res, 400, "Stock quantity cannot be negative.");
        }

        // Check duplicate variant (color + size combination)
        const targetColor = isValid(color) ? String(color).trim() : variant.colors;
        const targetSize = isValid(size) ? normalizeSize(size) : variant.sizes;

        if (
            (isValid(color) && targetColor !== variant.colors) ||
            (isValid(size) && targetSize !== variant.sizes)
        ) {
            const exists = await prisma.productVariant.findFirst({
                where: {
                    productId: variant.productId,
                    colors: targetColor,
                    sizes: targetSize,
                    NOT: { id: variantId }
                },
                select: { id: true }
            });

            if (exists) {
                return sendError(
                    res,
                    409,
                    `A variant with color '${targetColor}' and size '${targetSize}' already exists for this product.`
                );
            }
        }

        // Build update data
        const data = {};

        if (isValid(color)) data.colors = targetColor;
        if (isValid(size)) data.sizes = targetSize;
        if (isValid(price)) data.price = Number(price);
        if (isValid(stock_quantity)) data.stockQuantity = Number(stock_quantity);

        const updated = await prisma.productVariant.update({
            where: { id: variantId },
            data
        });

        return res.status(200).json({
            success: true,
            message: "Product variant updated successfully.",
            updated_varient: serialize(updated),
            links: {
                self: `/api/v1/product-variants/${id}`,
                product: `/api/v1/products/${updated.productId}`,
                all_variants: `/api/v1/products/${updated.productId}/variants`
            }
        });
    } catch (error) {
        return handleError(res, error, "Update Product Variant Error", "Failed to update product variant.");
    }
};

/**
 * @method DELETE /api/v1/product-variants/:id
 * @description Delete a product variant
 * @access Private (Admin)
 */
const deleteProductVariant = async (req, res) => {
    try {
        const { id } = req.params;
        const variantId = parseId(id);

        if (!variantId) {
            return sendError(res, 400, "Valid variant ID is required.");
        }

        // Check variant exists
        const variant = await prisma.productVariant.findUnique({
            where: { id: variantId },
            select: { id: true }
        });

        if (!variant) {
            return sendError(res, 404, "Product variant not found.");
        }

        await prisma.productVariant.delete({ where: { id: variantId } });

        return res.status(200).json({
            success: true,
            message: "Product variant deleted successfully.",
            links: {
                all_variants: "/api/v1/product-variants"
            }
        });
    } catch (error) {
        return handleError(res, error, "Delete Product Variant Error", "Failed to delete product variant.");
    }
};

export {
    createProductVariant,
    getAllProductVariants,
    getProductVariantById,
    getVariantsByProductId,
    getAllProductVariantsWithProductDetails,
    updateProductVariant,
    deleteProductVariant
};
