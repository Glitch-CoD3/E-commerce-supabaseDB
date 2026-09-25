import { redis } from "../config/redis.config.js";
import prisma from "../config/prisma.js";

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */
const CART_CACHE_TTL = 180;
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

const getUserId = (req) => parseId(req.user?.id);

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

const cartSelect = {
    id: true,
    productId: true,
    productVariantId: true,
    quantity: true,
    createdAt: true,
    updatedAt: true
};

// Prisma camelCase -> snake_case response shape
const formatCartItem = (item) => ({
    id: item.id,
    user_id: item.userId,
    product_id: item.productId,
    product_variant_id: item.productVariantId,
    quantity: item.quantity,
    created_at: item.createdAt,
    updated_at: item.updatedAt
});

/* -------------------------------------------------------------------------- */
/*                                 Controllers                                */
/* -------------------------------------------------------------------------- */

/**
 * @method POST /api/v1/cart
 * @description Add a product to the authenticated user's cart. If the product already exists, increase its quantity.
 * @access Private (Authenticated User)
 */
const addToCart = async (req, res) => {
    try {
        const user_id = getUserId(req);

        if (!user_id) {
            return sendError(res, 401, "Authentication required.");
        }

        let { product_id, product_variant_id, quantity = 1 } = req.body;

        const productId = parseId(product_id);
        const variantId = product_variant_id ? parseId(product_variant_id) : null;

        quantity = Number(quantity);

        // Validate input
        if (!productId) {
            return sendError(res, 400, "Product ID is required.");
        }

        if (product_variant_id && !variantId) {
            return sendError(res, 400, "Valid product variant ID is required.");
        }

        if (!Number.isInteger(quantity) || quantity < 1) {
            return sendError(res, 400, "Quantity must be at least 1.");
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
            return sendError(res, 400, "This product is currently unavailable.");
        }

        // Check variant (optional)
        if (variantId) {
            const variant = await prisma.productVariant.findFirst({
                where: { id: variantId, deletedAt: null },
                select: { id: true, productId: true, stockQuantity: true }
            });

            if (!variant) {
                return sendError(res, 404, "Product variant not found.");
            }

            if (variant.productId !== productId) {
                return sendError(res, 400, "Variant does not belong to the selected product.");
            }
        }

        // Check existing cart item
        const cartItem = await prisma.cart.findFirst({
            where: {
                userId: user_id,
                productId,
                productVariantId: variantId
            },
            select: { id: true }
        });

        // Update existing cart item
        if (cartItem) {
            const updated = await prisma.cart.update({
                where: { id: cartItem.id },
                data: { quantity: { increment: quantity }, updatedAt: new Date() }
            });

            return res.status(200).json({
                success: true,
                message: "Cart updated successfully.",
                data: serialize(formatCartItem(updated)),
                links: {
                    self: `/api/v1/cart/${updated.id}`,
                    all_cart_items: "/api/v1/cart"
                }
            });
        }

        // Insert new cart item
        const newItem = await prisma.cart.create({
            data: {
                userId: user_id,
                productId,
                productVariantId: variantId,
                quantity
            }
        });

        return res.status(201).json({
            success: true,
            message: "Product added to cart successfully.",
            data: serialize(formatCartItem(newItem)),
            links: {
                self: `/api/v1/cart/${newItem.id}`,
                all_cart_items: "/api/v1/cart"
            }
        });
    } catch (error) {
        return handleError(res, error, "Add To Cart Error", "Failed to add product to cart.");
    }
};

/**
 * @method GET /api/v1/cart
 * @description Retrieve all cart items for the authenticated user.
 * @access Private (Authenticated User)
 */

const getCart = async (req, res) => {
    try {
        const user_id = getUserId(req);

        if (!user_id) {
            return sendError(res, 401, "Authentication required.");
        }


        const cart = await prisma.cart.findMany({
            where: { userId: user_id },
            orderBy: { createdAt: "desc" },
            select: cartSelect
        });

        const responsePayload = {
            success: true,
            count: cart.length,
            data: serialize(cart.map(formatCartItem)),
            links: {
                add_to_cart: "/api/v1/cart",
                clear_cart: "/api/v1/cart"
            }
        };
        

    return res.status(200).json(responsePayload);
    } catch (error) {
        return handleError(res, error, "Get Cart Error", "Failed to retrieve cart.");
    }
};

/**
 * @method GET /api/v1/cart/:id
 * @description Retrieve a specific cart item by its ID for the authenticated user.
 * @access Private (Authenticated User)
 */
const getCartItemById = async (req, res) => {
    try {
        const user_id = getUserId(req);
        const { id } = req.params;
        const cartId = parseId(id);

        if (!user_id) {
            return sendError(res, 401, "Authentication required.");
        }

        if (!cartId) {
            return sendError(res, 400, "Valid cart item ID is required.");
        }

        const result = await prisma.$queryRaw`
            SELECT
                c.id,
                c.user_id,
                c.quantity,
                c.created_at,
                c.updated_at,

                jsonb_build_object(
                    'id', p.id,
                    'productName', p.product_name,
                    'urlSlug', p.url_slug,
                    'description', p.description,
                    'shortDescription', p.short_description,
                    'price', p.price,
                    'stockQuantity', p.stock_quantity,
                    'status', p.status,

                    'category',
                    CASE
                        WHEN cat.id IS NULL THEN NULL
                        ELSE jsonb_build_object(
                            'id', cat.id,
                            'categoryName', cat.category_name,
                            'urlSlug', cat.url_slug
                        )
                    END,

                    'brand',
                    CASE
                        WHEN b.id IS NULL THEN NULL
                        ELSE jsonb_build_object(
                            'id', b.id,
                            'brandName', b.brand_name
                        )
                    END
                ) AS product,

                CASE
                    WHEN pv.id IS NULL THEN NULL
                    ELSE jsonb_build_object(
                        'id', pv.id,
                        'productId', pv.product_id,
                        'colors', pv.colors,
                        'sizes', pv.sizes,
                        'price', pv.price,
                        'stockQuantity', pv.stock_quantity,

                        'images',
                        COALESCE(
                            (
                                SELECT jsonb_agg(
                                    jsonb_build_object(
                                        'id', vi.id,
                                        'imageUrl', vi.image_url,
                                        'sortOrder', vi.sort_order
                                    )
                                    ORDER BY vi.sort_order ASC
                                )
                                FROM variant_images vi
                                WHERE vi.product_variant_id = pv.id
                                  AND vi.deleted_at IS NULL
                            ),
                            '[]'::jsonb
                        )
                    )
                END AS variant

            FROM carts c

            LEFT JOIN products p
                ON p.id = c.product_id

            LEFT JOIN categories cat
                ON cat.id = p.category_id

            LEFT JOIN brands b
                ON b.id = p.brand_id

            LEFT JOIN product_variants pv
                ON pv.id = c.product_variant_id

            WHERE c.id = ${cartId}
              AND c.user_id = ${user_id}

            LIMIT 1
        `;

        if (result.length === 0) {
            return sendError(res, 404, "Cart item not found.");
        }

        return res.status(200).json({
            success: true,
            data: serialize(result[0]),
            links: {
                self: `/api/v1/cart/${id}`,
                cart: "/api/v1/cart"
            }
        });

    } catch (error) {
        return handleError(
            res,
            error,
            "Get Cart Item Error",
            "Failed to retrieve cart item."
        );
    }
};

/**
 * @method PATCH /api/v1/cart/:id
 * @description Update the quantity of a specific cart item.
 * @access Private (Authenticated User)
 */
const updateCartQuantity = async (req, res) => {
    try {
        const user_id = getUserId(req);
        const { id } = req.params;
        const cartId = parseId(id);
        const quantity = Number(req.body.quantity);

        if (!user_id) {
            return sendError(res, 401, "Authentication required.");
        }

        if (!cartId) {
            return sendError(res, 400, "Valid cart item ID is required.");
        }

        if (!Number.isInteger(quantity) || quantity < 1) {
            return sendError(res, 400, "Quantity must be greater than 0.");
        }

        // Check cart item exists and belongs to the user
        const cart = await prisma.cart.findFirst({
            where: { id: cartId, userId: user_id },
            select: { id: true }
        });

        if (!cart) {
            return sendError(res, 404, "Cart item not found.");
        }

        const updatedCart = await prisma.cart.update({
            where: { id: cartId },
            data: { quantity, updatedAt: new Date() },
            select: { ...cartSelect, userId: true }
        });

        return res.status(200).json({
            success: true,
            message: "Cart quantity updated successfully.",
            data: serialize(formatCartItem(updatedCart)),
            links: {
                self: `/api/v1/cart/${id}`,
                cart: "/api/v1/cart"
            }
        });
    } catch (error) {
        return handleError(res, error, "Update Cart Quantity Error", "Failed to update cart quantity.");
    }
};

/**
 * @method DELETE /api/v1/cart/:id
 * @description Remove a specific item from the authenticated user's cart.
 * @access Private (Authenticated User)
 */
const removeCartItem = async (req, res) => {
    try {
        const user_id = getUserId(req);
        const { id } = req.params;
        const cartId = parseId(id);

        if (!user_id) {
            return sendError(res, 401, "Authentication required.");
        }

        if (!cartId) {
            return sendError(res, 400, "Valid cart item ID is required.");
        }

        // Delete only if the item belongs to the user
        const { count } = await prisma.cart.deleteMany({
            where: { id: cartId, userId: user_id }
        });

        if (!count) {
            return sendError(res, 404, "Cart item not found.");
        }

        return res.status(200).json({
            success: true,
            message: "Cart item removed successfully.",
            links: {
                cart: "/api/v1/cart"
            }
        });
    } catch (error) {
        return handleError(res, error, "Remove Cart Item Error", "Failed to remove cart item.");
    }
};

/**
 * @method DELETE /api/v1/cart
 * @description Remove all items from the authenticated user's cart.
 * @access Private (Authenticated User)
 */
const clearCart = async (req, res) => {
    try {
        const user_id = getUserId(req);

        if (!user_id) {
            return sendError(res, 401, "Authentication required.");
        }

        const { count } = await prisma.cart.deleteMany({
            where: { userId: user_id }
        });

        return res.status(200).json({
            success: true,
            message: "Cart cleared successfully.",
            deleted_items: count,
            links: {
                cart: "/api/v1/cart"
            }
        });
    } catch (error) {
        return handleError(res, error, "Clear Cart Error", "Failed to clear cart.");
    }
};


const getCartCount = async (req, res) => {
    try {
        const user_id = getUserId(req);

        if (!user_id) {
            return sendError(res, 401, "Authentication required.");
        }

        const count = await prisma.cart.count({
            where: {
                userId: user_id
            }
        });

        return res.status(200).json({
            success: true,
            count
        });

    } catch (error) {
        return handleError(
            res,
            error,
            "Get Cart Count Error",
            "Failed to retrieve cart count."
        );
    }
};


const fetchCart = async (req, res) => {
    try {
        const user_id = getUserId(req);

        if (!user_id) {
            return sendError(res, 401, "Authentication required.");
        }

        const cart = await prisma.$queryRaw`
            SELECT
                c.id,
                c.user_id,
                c.quantity,
                c.created_at,
                c.updated_at,

                jsonb_build_object(
                    'id', p.id,
                    'productName', p.product_name,
                    'urlSlug', p.url_slug,
                    'description', p.description,
                    'shortDescription', p.short_description,
                    'price', p.price,
                    'stockQuantity', p.stock_quantity,
                    'status', p.status,

                    'category',
                    CASE
                        WHEN cat.id IS NULL THEN NULL
                        ELSE jsonb_build_object(
                            'id', cat.id,
                            'categoryName', cat.category_name,
                            'urlSlug', cat.url_slug
                        )
                    END,

                    'brand',
                    CASE
                        WHEN b.id IS NULL THEN NULL
                        ELSE jsonb_build_object(
                            'id', b.id,
                            'brandName', b.brand_name
                        )
                    END
                ) AS product,

                CASE
                    WHEN pv.id IS NULL THEN NULL
                    ELSE jsonb_build_object(
                        'id', pv.id,
                        'productId', pv.product_id,
                        'colors', pv.colors,
                        'sizes', pv.sizes,
                        'price', pv.price,
                        'stockQuantity', pv.stock_quantity,

                        'images',
                        COALESCE(
                            (
                                SELECT jsonb_agg(
                                    jsonb_build_object(
                                        'id', vi.id,
                                        'imageUrl', vi.image_url,
                                        'sortOrder', vi.sort_order
                                    )
                                    ORDER BY vi.sort_order ASC
                                )
                                FROM variant_images vi
                                WHERE vi.product_variant_id = pv.id
                                  AND vi.deleted_at IS NULL
                            ),
                            '[]'::jsonb
                        )
                    )
                END AS variant

            FROM carts c

            LEFT JOIN products p
                ON p.id = c.product_id

            LEFT JOIN categories cat
                ON cat.id = p.category_id

            LEFT JOIN brands b
                ON b.id = p.brand_id

            LEFT JOIN product_variants pv
                ON pv.id = c.product_variant_id

            WHERE c.user_id = ${user_id}

            ORDER BY c.created_at DESC
        `;

        return res.status(200).json({
            success: true,
            count: cart.length,
            data: serialize(cart),
            links: {
                add_to_cart: "/api/v1/cart",
                clear_cart: "/api/v1/cart"
            }
        });

    } catch (error) {
        return handleError(
            res,
            error,
            "Get Cart Error",
            "Failed to retrieve cart."
        );
    }
};


export {
    addToCart,
    getCart,
    getCartItemById,
    updateCartQuantity,
    removeCartItem,
    clearCart,
    getCartCount,
    fetchCart //share 
};
