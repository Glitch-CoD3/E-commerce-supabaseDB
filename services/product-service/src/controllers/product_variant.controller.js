import prisma from "../config/prisma.js";

const serialize = (data) => JSON.parse(JSON.stringify(data, (_, value) =>
    typeof value === "bigint" ? Number(value) : value
));

/**
 * @method POST /api/v1/product-variants
 * @description Create a product variant
 * @access Private (Admin)
 */
const createProductVariant = async (req, res) => {
    try {
        const {
            product_id,
            color,
            size,
            price,
            stock_quantity
        } = req.body;

        // ===============================
        // Validation
        // ===============================
        if (!product_id) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required."
            });
        }

        if (!color) {
            return res.status(400).json({
                success: false,
                message: "Product colors required"
            });
        }


        if (price === undefined || price === null || Number(price) <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid price is required."
            });
        }

        if (
            stock_quantity === undefined ||
            stock_quantity === null ||
            Number(stock_quantity) < 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid stock quantity is required."
            });
        }

        // ===============================
        // Check Product
        // ===============================
        const product = await prisma.product.findFirst({
            where: { id: BigInt(product_id), deletedAt: null },
            select: { id: true, status: true, stockQuantity: true }
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        if (product.status !== "active") {
            return res.status(400).json({
                success: false,
                message: "Cannot create variant for an inactive product."
            });
        }

        // ===============================
        // Prevent Duplicate Variant
        // ===============================
        const exists = await prisma.productVariant.findFirst({
            where: { productId: BigInt(product_id), colors: color },
            select: { id: true }
        });
        if (exists) {
            return res.status(409).json({
                success: false,
                message: "This variant already exists."
            });
        }

        // ===============================
        // Insert Variant
        // ===============================
        const createdVariant = await prisma.productVariant.create({
            data: {
                productId: BigInt(product_id),
                colors: color,
                sizes: size || null,
                price,
                stockQuantity: Number(stock_quantity)
            }
        });

        // ===============================
        // Fetch Created Variant
        // ===============================
        const variant = createdVariant;

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
        console.error("Create Product Variant Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};

/**
 * @method GET /api/v1/product-variants/details
 * @description Get all product variants with Product details
 * @access Private (Admin)
 */
const getAllProductVariantsWithProductDetails = async (req, res) => {
    try {
        let { page, limit, product_id } = req.query;


        page = Number(page || 1);
        limit = Number(limit || 10);
        const offset = (page - 1) * limit;

        // ===============================
        // Validation
        // ===============================
        if (page < 1 || limit < 1) {
            return res.status(400).json({
                success: false,
                message: "Page and limit must be greater than 0."
            });
        }

        // ===============================
        // Build Query
        // ===============================
        const where = {
            deletedAt: null,
            ...(product_id ? { productId: BigInt(product_id) } : {})
        };

        // ===============================
        // Total Count
        // ===============================
        const total = await prisma.productVariant.count({
            where: { ...where, product: { deletedAt: null } }
        });

        // ===============================
        // Get Variants
        // ===============================
        const variants = await prisma.productVariant.findMany({
            where: { ...where, product: { deletedAt: null } },
            orderBy: { id: "desc" }, skip: offset, take: limit,
            include: { product: { select: { productName: true, status: true } } }
        });
        const formattedVariants = serialize(variants.map(({ product, ...variant }) => ({
            ...variant,
            product_name: product.productName,
            product_status: product.status
        })));

        // ===============================
        // Response
        // ===============================
        return res.status(200).json({
            success: true,
            message: "Product variants retrieved successfully.",
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            Total_vatient_with_productDetails: formattedVariants,
            links: {
                self: `/api/v1/product-variants?page=${page}&limit=${limit}`,
                next:
                    page * limit < total
                        ? `/api/v1/product-variants?page=${page + 1}&limit=${limit}`
                        : null,
                prev:
                    page > 1
                        ? `/api/v1/product-variants?page=${page - 1}&limit=${limit}`
                        : null
            }
        });

    } catch (error) {
        console.error("Get All Product Variants Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};


/**
 * @method GET /api/v1/product-variants/
 * @description Get all product variants with just Product id
 * @access Private (Admin)
 */
const getAllProductVariants = async (req, res) => {
    try {
        let { page, limit, product_id } = req.query;

        page = Number(page || 1);
        limit = Number(limit || 10);
        const offset = (page - 1) * limit;

        // Validation
        if (page < 1 || limit < 1) {
            return res.status(400).json({
                success: false,
                message: "Page and limit must be greater than 0."
            });
        }

        // Build Query
        const where = product_id ? { productId: BigInt(product_id) } : {};
        const total = await prisma.productVariant.count({ where });
        const variants = await prisma.productVariant.findMany({
            where, orderBy: { id: "desc" }, skip: offset, take: limit
        });

        // Response
        return res.status(200).json({
            success: true,
            message: "Product variants retrieved successfully.",
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            all_product_varients: serialize(variants), // Fixed typo from 'vatient' to 'variants'
            links: {
                self: `/api/v1/product-variants?page=${page}&limit=${limit}${product_id ? `&product_id=${product_id}` : ''}`,
                next:
                    page * limit < total
                        ? `/api/v1/product-variants?page=${page + 1}&limit=${limit}${product_id ? `&product_id=${product_id}` : ''}`
                        : null,
                prev:
                    page > 1
                        ? `/api/v1/product-variants?page=${page - 1}&limit=${limit}${product_id ? `&product_id=${product_id}` : ''}`
                        : null
            }
        });

    } catch (error) {
        console.error("Get All Product Variants Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};


const getProductVariantById = async (req, res) => {
    try {
        const { id } = req.params;

        // ===============================
        // Validation
        // ===============================
        if (!id || isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "Valid variant ID is required."
            });
        }

        // ===============================
        // Get Variant
        // ===============================
        const variant = await prisma.productVariant.findUnique({
            where: { id: BigInt(id) }
        });
        // ===============================
        // Check Exists
        // ===============================
        if (!variant) {
            return res.status(404).json({
                success: false,
                message: "Product variant not found."
            });
        }

        // ===============================
        // Response
        // ===============================
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
        console.error("Get Product Variant By ID Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};



const getVariantsByProductId = async (req, res) => {
    try {
        const { productId } = req.params;

        // ===========================
        // Validate Product ID
        // ===========================
        if (!productId || isNaN(Number(productId))) {
            return res.status(400).json({
                success: false,
                message: "A valid numeric Product ID is required."
            });
        }

        // ===========================
        // Check Product Existence
        // ===========================
        const product = await prisma.product.findUnique({
            where: { id: BigInt(productId) }, select: { id: true }
        });

        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found."
            });
        }

        // ===========================
        // Fetch All Variants
        // ===========================
        const variants = await prisma.productVariant.findMany({
            where: { productId: BigInt(productId) }, orderBy: { id: "asc" }
        });

        // Optional: Return empty array or 404 depending on your preferred API design
        if (variants.length === 0) {
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
        console.error("Get Variants By Product ID Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
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

        const {
            color,
            size,
            price,
            stock_quantity
        } = req.body;

        // ===========================
        // Check Variant Exists
        // ===========================
        const variant = await prisma.productVariant.findUnique({
            where: { id: BigInt(id) }
        });

        if (!variant) {
            return res.status(404).json({
                success: false,
                message: "Product variant not found."
            });
        }

        // ===========================
        // Helper: Check if value is truly provided
        // ===========================
        const isValid = (val) => val !== undefined && val !== null && String(val).trim() !== "";

        if (!isValid(color) && !isValid(size) && !isValid(price) && !isValid(stock_quantity)) {
            return res.status(400).json({
                success: false,
                message: "At least one valid field (color, size, price, stock_quantity) is required to update."
            });
        }

        // ===========================
        // Validate Size against Allowed List
        // ===========================
        const ALLOWED_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];

        if (isValid(size)) {
            const formattedSize = String(size).trim().toUpperCase();
            if (!ALLOWED_SIZES.includes(formattedSize)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid size '${size}'. Allowed sizes are: ${ALLOWED_SIZES.join(", ")}.`
                });
            }
        }

        if (isValid(price) && Number(price) <= 0) {
            return res.status(400).json({
                success: false,
                message: "Price must be greater than 0."
            });
        }

        if (isValid(stock_quantity) && Number(stock_quantity) < 0) {
            return res.status(400).json({
                success: false,
                message: "Stock quantity cannot be negative."
            });
        }

        // ===========================
        // Check Duplicate Variant (Color + Size Combination)
        // ===========================
        const targetColor = isValid(color) ? color.trim() : variant.colors;
        const targetSize = isValid(size) ? String(size).trim().toUpperCase() : variant.sizes;

        // Perform duplicate check if either color or size is being updated
        if ((isValid(color) && targetColor !== variant.colors) ||
            (isValid(size) && targetSize !== variant.sizes)) {
            const exists = await prisma.productVariant.findFirst({
                where: {
                    productId: variant.productId, colors: targetColor,
                    sizes: targetSize, NOT: { id: BigInt(id) }
                }, select: { id: true }
            });
            if (exists) {
                return res.status(409).json({
                    success: false,
                    message: `A variant with color '${targetColor}' and size '${targetSize}' already exists for this product.`
                });
            }
        }

        // ===========================
        // Dynamic Update Query
        // ===========================
        const data = {};

        if (isValid(color)) {
            data.colors = color.trim();
        }
        if (isValid(size)) {
            data.sizes = String(size).trim().toUpperCase();
        }
        if (isValid(price)) {
            data.price = Number(price);
        }
        if (isValid(stock_quantity)) {
            data.stockQuantity = Number(stock_quantity);
        }

        await prisma.productVariant.update({ where: { id: BigInt(id) }, data });

        // ===========================
        // Return Updated Variant
        // ===========================
        const updated = await prisma.productVariant.findUnique({ where: { id: BigInt(id) } });

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
        console.error("Update Product Variant Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
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

        // ===========================
        // Check Variant Exists
        // ===========================
        const variant = await prisma.productVariant.findUnique({
            where: { id: BigInt(id) }, select: { id: true }
        });

        if (!variant) {
            return res.status(404).json({
                success: false,
                message: "Product variant not found."
            });
        }

        // ===========================
        // Delete Variant
        // ===========================
        await prisma.productVariant.delete({ where: { id: BigInt(id) } });

        return res.status(200).json({
            success: true,
            message: "Product variant deleted successfully.",
            links: {
                all_variants: "/api/v1/product-variants"
            }
        });

    } catch (error) {
        console.error("Delete Product Variant Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
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