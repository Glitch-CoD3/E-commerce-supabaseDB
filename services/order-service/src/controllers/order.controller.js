import { Prisma, OrderStatus } from "@prisma/client";
import prisma from "../config/prisma.js";
import { getAllCart } from "../utils/axiosClient.js";
import { getProductsByIds, getProductByVariantId, getProductVarientImage } from "../utils/product.api.js";
import { getShippingAddress } from "../utils/getShippingAddress.api.js";

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */
import { handleError, sendError } from "../utils/handleError.js"
import { serialize, parseId, } from "../utils/validation.js"

const ORDER_STATUSES = Object.values(OrderStatus);
const PAYMENT_STATUSES = ["PENDING", "PAID", "UNPAID", "REFUNDED"];
const NON_CANCELLABLE_STATUSES = [
    OrderStatus.confirmed,
    OrderStatus.processing,
    OrderStatus.shipped,
    OrderStatus.delivered,
    OrderStatus.returned
];


const getUserId = (req) => parseId(req.user?.id);

const getToken = (req) => req.cookies?.refreshToken || req.headers.authorization?.split(" ")[1];

// Payment statuses are stored upper-case; order statuses are lower-case enum values
const normalize = (value) => String(value ?? "").trim().toUpperCase();
const normalizeOrderStatus = (value) => String(value ?? "").trim().toLowerCase();


const getPagination = (req, defaultLimit = 10) => {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || defaultLimit, 1);

    return { page, limit, offset: (page - 1) * limit };
};

const generateOrderNumber = () => `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const getShippingFee = (state) => (state?.toLowerCase() === "dhaka" ? 60 : 120);

// Product API responses use different keys depending on the endpoint
const getProductName = (product) => product.product_name ?? product.name;
const getProductStock = (product) => product.stock_quantity ?? product.quantity;

// Prisma camelCase -> snake_case response shapes
import { formatOrder, createOrderWithItems, formatShippingAddress, formatOrderItem } from "../utils/validation.js"

/* -------------------------------------------------------------------------- */
/*                               Customer orders                              */
/* -------------------------------------------------------------------------- */

/**
 * @method POST /api/v1/order
 * @description Create a new order for the authenticated user from their cart.
 * @access Private (Authenticated User)
 */
const createOrder = async (req, res) => {
    try {
        const user_id = getUserId(req);

        if (!user_id) {
            return sendError(res, 401, "Authentication required.");
        }

        const { full_address, state, city, zip } = req.body ?? {};

        if (!full_address || !state || !city) {
            return sendError(res, 400, "Full address, state and city are required");
        }

        const order_shipping_Address = { full_address, state, city, zip };
        const token = getToken(req);

        // 1. Get cart
        const carts = await getAllCart(token);

        if (!carts?.data?.length) {
            return sendError(res, 400, "Cart is empty");
        }

        // 2. Validate products (each product once, against the total quantity requested)
        const productIds = [...new Set(carts.data.map((item) => item.product_id))];
        const products = [];

        for (const id of productIds) {
            const product = await getProductsByIds(id, token);

            if (!product) {
                return sendError(res, 404, `Product ${id} not found`);
            }

            const requested = carts.data
                .filter((item) => item.product_id === id)
                .reduce((sum, item) => sum + item.quantity, 0);

            if (getProductStock(product) < requested) {
                return sendError(
                    res,
                    400,
                    `${getProductName(product)} has only ${getProductStock(product)} items in stock`
                );
            }

            products.push(product);
        }

        // 3. Create order items (variant price overrides base price)
        const orderItems = [];
        let lastVariantData = null; // Last fetched variant info, used in the response
        let lastVariantImageData = null;

        for (const cartItem of carts.data) {
            const product = products.find((p) => p.id === cartItem.product_id);

            if (!product) {
                return sendError(res, 404, `Product ${cartItem.product_id} not found`);
            }

            let variantPrice = product.price;

            if (cartItem.product_variant_id) {
                const varient = await getProductByVariantId(cartItem.product_variant_id, token);

                if (!varient?.product_varient) {
                    return sendError(res, 404, `Variant ${cartItem.product_variant_id} not found`);
                }

                lastVariantData = varient;
                lastVariantImageData = await getProductVarientImage(cartItem.product_variant_id, token);
                variantPrice = varient.product_varient.price;
            }

            const price = Number(variantPrice);

            orderItems.push({
                product_id: product.id,
                product_variant_id: cartItem.product_variant_id ?? null,
                product_name: getProductName(product),
                price,
                quantity: cartItem.quantity,
                total_amount: price * cartItem.quantity
            });
        }

        // 4. Calculate amounts
        const subtotal = orderItems.reduce((sum, item) => sum + item.total_amount, 0);

        const shippingAddresses = await getShippingAddress(user_id);


        if (!shippingAddresses) {
            return sendError(res, 404, "Shipping address not found");
        }

        const shippingAddress =
            shippingAddresses.find((address) => address.is_default) ??
            shippingAddresses[0];


        const ShippingState = order_shipping_Address.state || shippingAddress.state;
        const shippingFee = getShippingFee(ShippingState);
        const total = subtotal + shippingFee;


        // 5. Save order, items and shipping snapshot
        const order = await createOrderWithItems({
            user_id,
            orderNumber: generateOrderNumber(),
            orderItems,
            subtotal,
            shippingFee,
            total,
            shipping: {
                shippingAddressId: parseId(shippingAddress.id),
                fullAddress: order_shipping_Address.full_address || shippingAddress.full_address,
                state: order_shipping_Address.state || shippingAddress.state,
                city: order_shipping_Address.city || shippingAddress.city,
                zipCode: order_shipping_Address.zip || shippingAddress.zip_code,
                phoneNumber: order_shipping_Address.phone_number || shippingAddress.phone_number
            }
        });

        return res.status(201).json({
            success: true,
            message: "Order created successfully.",
            data: {
                orderId: Number(order.id),
                orderStatus: "PENDING_PAYMENT",
                paymentStatus: "UNPAID",
                totalAmount: total,
                varient: {
                    color: lastVariantData?.product_varient?.colors,
                    size: lastVariantData?.product_varient?.sizes,
                    price: lastVariantData?.product_varient?.price,
                    image: lastVariantImageData?.[0]?.image_url
                }
            }
        });
    } catch (error) {
        return handleError(res, error, "Create Order Error", "Failed to create order.");
    }
};

/**
 * @method POST /api/v1/buy-now
 * @description Directly order by clicking Buy Now button
 * @access Private (Authenticated User)
 */
const buyNowDirectly = async (req, res) => {
    try {
        const user_id = getUserId(req);

        if (!user_id) {
            return sendError(res, 401, "Authentication required.");
        }

        const { products, full_address, state, city, zip, phone_number } = req.body;

        // Validation
        if (!Array.isArray(products) || products.length === 0) {
            return sendError(res, 400, "Products are required.");
        }

        if (products.length > 20) {
            return sendError(res, 400, "Too many items in a single order.");
        }

        for (const item of products) {
            if (!item.product_id || (typeof item.product_id !== "number" && typeof item.product_id !== "string")) {
                return sendError(res, 400, "Each product requires a valid product_id.");
            }

            if (
                item.product_variant_id !== undefined &&
                item.product_variant_id !== null &&
                typeof item.product_variant_id !== "number" &&
                typeof item.product_variant_id !== "string"
            ) {
                return sendError(res, 400, "Invalid product_variant_id.");
            }

            if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
                return sendError(res, 400, `Invalid quantity for product ${item.product_id}.`);
            }
        }

        if (
            typeof full_address !== "string" || !full_address.trim() ||
            typeof state !== "string" || !state.trim() ||
            typeof city !== "string" || !city.trim()
        ) {
            return sendError(res, 400, "Full address, state and city are required.");
        }

        if (zip && !/^[A-Za-z0-9\- ]{3,12}$/.test(zip)) {
            return sendError(res, 400, "Invalid zip code format.");
        }

        const token = getToken(req);

        // Validate products (and variants, where specified)
        const orderItems = [];

        for (const item of products) {
            const product = await getProductsByIds(item.product_id, token);

            if (!product) {
                return sendError(res, 404, `Product ${item.product_id} not found`);
            }

            let variantData = null;
            let variantImage = null;

            if (item.product_variant_id) {
                const variant = await getProductByVariantId(item.product_variant_id, token);

                if (!variant?.product_varient) {
                    return sendError(res, 404, `Variant ${item.product_variant_id} not found`);
                }

                variantData = variant.product_varient;

                // Prevent a mismatched product_id / product_variant_id pair
                if (String(variantData.productId ?? variantData.product_id) !== String(product.id)) {
                    return sendError(
                        res,
                        400,
                        `Variant ${item.product_variant_id} does not belong to product ${item.product_id}`
                    );
                }

                // A missing image must not block checkout
                variantImage = await getProductVarientImage(item.product_variant_id, token);
            }

            // Stock check: the variant's own stock when specified, otherwise the product's
            const availableStock = variantData
                ? variantData.stockQuantity ?? variantData.stock_quantity
                : getProductStock(product);

            if (availableStock < item.quantity) {
                return sendError(res, 400, `${getProductName(product)} has only ${availableStock} in stock`);
            }

            // Variant price overrides base product price
            const unitPrice = Number(variantData?.price ?? product.price);

            // Variant image, then the base product's image for that color, then null
            const productImage =
                variantImage ||
                (variantData?.colors && product.images?.[variantData.colors]) ||
                null;

            orderItems.push({
                product_id: product.id,
                product_variant_id: variantData?.id ?? null,
                product_name: getProductName(product),
                product_image: productImage,
                variant_size: variantData?.sizes || null,
                variant_color: variantData?.colors || null,
                price: unitPrice,
                quantity: item.quantity,
                total_amount: unitPrice * item.quantity
            });
        }

        // Calculate amounts
        const subtotal = orderItems.reduce((sum, item) => sum + item.total_amount, 0);
        const shippingFee = getShippingFee(state);
        const total = subtotal + shippingFee;

        // Save order, items and shipping snapshot
        const orderNumber = generateOrderNumber();

        const order = await createOrderWithItems({
            user_id,
            orderNumber,
            orderItems,
            subtotal,
            shippingFee,
            total,
            shipping: {
                fullAddress: full_address.trim(),
                state: state.trim(),
                city: city.trim(),
                zipCode: zip || null,
                phoneNumber: phone_number || ""
            }
        });

        return res.status(201).json({
            success: true,
            message: "Order created successfully.",
            data: {
                orderId: Number(order.id),
                orderNumber,
                orderStatus: "PENDING",
                paymentStatus: "UNPAID",
                totalAmount: total
            }
        });
    } catch (error) {
        return handleError(
            res,
            error,
            "buyNowDirectly Error",
            "Something went wrong while placing your order. Please try again."
        );
    }
};

/**
 * @description Get the authenticated user's orders (paginated) with items and shipping address
 * @access Private (Authenticated User)
 */
const getOrdersByUserId = async (req, res) => {
    try {
        const user_id = getUserId(req);

        if (!user_id) {
            return sendError(res, 401, "Authentication required.");
        }

        const { page, limit, offset } = getPagination(req);
        const where = { userId: user_id };

        const [orders, totalCount] = await Promise.all([
            prisma.order.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: offset,
                take: limit
            }),
            prisma.order.count({ where })
        ]);

        // Items and shipping addresses are batched, not fetched per order
        const orderIds = orders.map((order) => order.id);

        const [items, shippingAddresses] = await Promise.all([
            prisma.orderItem.findMany({ where: { orderId: { in: orderIds } } }),
            prisma.orderShippingAddress.findMany({ where: { orderId: { in: orderIds } } })
        ]);

        const result = orders.map((order) => ({
            ...formatOrder(order),
            items: items.filter((item) => item.orderId === order.id).map(formatOrderItem),
            shipping_address: formatShippingAddress(
                shippingAddresses.find((address) => address.orderId === order.id)
            ) || null
        }));

        return res.status(200).json({
            success: true,
            message: orders.length ? "Orders retrieved successfully." : "No orders found.",
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.ceil(totalCount / limit)
            },
            data: serialize(result)
        });
    } catch (error) {
        return handleError(res, error, "Get Orders By User ID Error", "Failed to retrieve orders.");
    }
};

/**
 * @method GET /api/v1/orders/:orderId
 * @description Get one of the authenticated user's orders by order id
 * @access Private (Authenticated User)
 */
const getOrderByOrderId = async (req, res) => {
    try {
        const user_id = getUserId(req);

        if (!user_id) {
            return sendError(res, 401, "Authentication required.");
        }

        // Accept orderId from params (/orders/:orderId) OR query (/orders?orderId=4)
        const orderId = parseId(req.params.orderId || req.query.orderId);

        if (!orderId) {
            return sendError(res, 400, "Order ID is required");
        }

        const order = await prisma.order.findFirst({
            where: { id: orderId, userId: user_id }
        });

        if (!order) {
            return sendError(res, 404, "Order not found");
        }

        const [items, shippingAddress] = await Promise.all([
            prisma.orderItem.findMany({ where: { orderId }, orderBy: { id: "asc" } }),
            prisma.orderShippingAddress.findFirst({ where: { orderId } })
        ]);

        return res.status(200).json({
            success: true,
            message: "Order fetched successfully",
            order_result: serialize({
                order_details: formatOrder(order),
                Order_items: items.map(formatOrderItem),
                shipping_address: formatShippingAddress(shippingAddress) || null
            })
        });
    } catch (error) {
        return handleError(res, error, "Get Order By ID Error", "Failed to fetch order.");
    }
};

/**
 * @method PATCH /api/v1/order/:orderId/cancel
 * @description User can cancel their own order
 * @access Private (Authenticated User)
 */
const order_cancel = async (req, res) => {
    try {
        const { orderId } = req.params;
        const userId = getUserId(req);
        const parsedOrderId = parseId(orderId);

        if (!userId) {
            return sendError(res, 401, "Authentication required.");
        }

        if (!parsedOrderId) {
            return sendError(res, 400, "Order ID is required");
        }

        // Check order
        const order = await prisma.order.findFirst({
            where: { id: parsedOrderId, userId },
            select: { id: true, status: true }
        });

        if (!order) {
            return sendError(res, 404, "Order not found");
        }

        // Check current status
        const currentStatus = normalizeOrderStatus(order.status);

        if (currentStatus === OrderStatus.cancelled) {
            return sendError(res, 400, "Order is already cancelled");
        }

        if (NON_CANCELLABLE_STATUSES.includes(currentStatus)) {
            return sendError(res, 400, `Cannot cancel a ${currentStatus} order`);
        }

        // Cancel order
        await prisma.order.update({
            where: { id: parsedOrderId },
            data: { status: OrderStatus.cancelled, updatedAt: new Date() }
        });

        return res.status(200).json({
            success: true,
            message: "Order cancelled successfully",
            orderId
        });
    } catch (error) {
        return handleError(res, error, "Order Cancel Error", "Failed to cancel order.");
    }
};

/* -------------------------------------------------------------------------- */
/*                                Admin orders                                */
/* -------------------------------------------------------------------------- */

/**
 * @method PATCH /api/v1/orders/:orderId/status
 * @description Update order status (pending, confirmed, processing, shipped, delivered, cancelled)
 * @access Private (Admin)
 */
const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        const parsedOrderId = parseId(orderId);

        if (!parsedOrderId) {
            return sendError(res, 400, "Order ID is required");
        }

        const normalizedStatus = normalizeOrderStatus(status);

        if (typeof status !== "string" || !ORDER_STATUSES.includes(normalizedStatus)) {
            return sendError(res, 400, `Invalid status. Allowed values are: ${ORDER_STATUSES.join(", ")}`);
        }

        // Check order (cancelled orders cannot be updated)
        const order = await prisma.order.findUnique({
            where: { id: parsedOrderId },
            select: { id: true, status: true }
        });

        if (!order || order.status === OrderStatus.cancelled) {
            return sendError(res, 404, "Order not found");
        }

        await prisma.order.update({
            where: { id: parsedOrderId },
            data: { status: normalizedStatus, updatedAt: new Date() }
        });

        return res.status(200).json({
            success: true,
            message: `Your order is ${normalizedStatus}`,
            orderId
        });
    } catch (error) {
        return handleError(res, error, "Order Status Update Error", "Failed to update order status.");
    }
};

/**
 * @method GET /api/v1/orders/admin
 * @description Get all orders (with pagination, status filter and search by order id / number)
 * @access Private (Admin)
 */
const getAllOrders = async (req, res) => {
    try {
        const { page, limit, offset } = getPagination(req);

        const status = normalizeOrderStatus(req.query.status);
        const search = String(req.query.search || "");
        const searchId = parseId(search);

        if (status && !ORDER_STATUSES.includes(status)) {
            return sendError(res, 400, `Invalid status. Allowed values are: ${ORDER_STATUSES.join(", ")}`);
        }

        const where = {
            ...(status && { status }),
            ...(search && {
                OR: [
                    { orderNumber: { contains: search, mode: "insensitive" } },
                    ...(searchId ? [{ id: searchId }] : [])
                ]
            })
        };

        const [totalOrders, orders] = await Promise.all([
            prisma.order.count({ where }),
            prisma.order.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: offset,
                take: limit
            })
        ]);

        return res.status(200).json({
            success: true,
            message: orders.length ? "Orders fetched successfully" : "No orders found",
            totalOrders,
            currentPage: page,
            totalPages: Math.ceil(totalOrders / limit),
            orders: serialize(orders.map(formatOrder))
        });
    } catch (error) {
        return handleError(res, error, "Get All Orders Error", "Failed to fetch orders.");
    }
};

/**
 * @method GET /api/v1/orders/admin/:orderId
 * @description Get single order details
 * @access Private (Admin)
 */
const getOrderDetailsByOrderId = async (req, res) => {
    try {
        const orderId = parseId(req.params.orderId);

        if (!orderId) {
            return sendError(res, 400, "Order ID is required");
        }

        const order = await prisma.order.findUnique({ where: { id: orderId } });

        if (!order) {
            return sendError(res, 404, "Order not found");
        }

        const [items, shippingAddress] = await Promise.all([
            prisma.orderItem.findMany({ where: { orderId }, orderBy: { id: "asc" } }),
            prisma.orderShippingAddress.findFirst({ where: { orderId } })
        ]);

        // Customer details would come from the user service (getUserById)
        const customer = { id: order.userId };

        const payment = {
            payment_method: order.paymentMethod,
            payment_status: order.paymentStatus || "Pending"
        };

        return res.status(200).json({
            success: true,
            data: serialize({
                order: formatOrder(order),
                customer,
                items: items.map(formatOrderItem),
                shippingAddress: formatShippingAddress(shippingAddress) || null,
                payment
            })
        });
    } catch (error) {
        return handleError(res, error, "Get Order Details Error", "Failed to fetch order details.");
    }
};

/**
 * @method PATCH /api/v1/orders/:orderId/payment
 * @description Update payment status
 * @access Private (Admin)
 */
const updatePaymentStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { payment_status } = req.body;
        const parsedOrderId = parseId(orderId);

        // Validation
        if (!parsedOrderId) {
            return sendError(res, 400, "Order ID is required");
        }

        if (!payment_status || typeof payment_status !== "string") {
            return sendError(res, 400, "Payment status string is required");
        }

        const normalizedStatus = normalize(payment_status);

        if (!PAYMENT_STATUSES.includes(normalizedStatus)) {
            return sendError(res, 400, `Invalid payment status. Allowed: ${PAYMENT_STATUSES.join(", ")}`);
        }

        // Check order (cancelled orders cannot be updated)
        const order = await prisma.order.findUnique({
            where: { id: parsedOrderId },
            select: { id: true, status: true, paymentStatus: true }
        });

        if (!order || order.status === OrderStatus.cancelled) {
            return sendError(res, 404, "Order not found or order has been cancelled");
        }

        if (normalize(order.paymentStatus) === normalizedStatus) {
            return sendError(res, 400, `Payment is already ${normalizedStatus}`);
        }

        await prisma.order.update({
            where: { id: parsedOrderId },
            data: { paymentStatus: normalizedStatus, updatedAt: new Date() }
        });

        return res.status(200).json({
            success: true,
            message: `Payment status updated to ${normalizedStatus}`
        });
    } catch (error) {
        return handleError(res, error, "Update Payment Status Error", "Failed to update payment status.");
    }
};

/* -------------------------------------------------------------------------- */
/*                                  Analytics                                 */
/* -------------------------------------------------------------------------- */

/**
 * @method GET /api/v1/orders/admin/dashboard
 * @description Order dashboard statistics for a year, or a single month of that year
 * @access Private (Admin)
 */
const orderDashboardStatistics = async (req, res) => {
    try {
        const year = parseInt(req.query.year, 10) || new Date().getFullYear();
        const month = req.query.month ? parseInt(req.query.month, 10) : null;

        if (month !== null && (isNaN(month) || month < 1 || month > 12)) {
            return sendError(res, 400, "Invalid month parameter. Must be an integer between 1 and 12.");
        }

        // Index-friendly date range
        const startDate = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
        const endDate = month ? new Date(year, month, 1) : new Date(year + 1, 0, 1);

        const [rawData] = await prisma.$queryRaw`
            SELECT
                COUNT(*)::int AS "totalOrders",
                COUNT(*) FILTER (WHERE LOWER(status::text) = 'pending')::int AS "pendingOrders",
                COUNT(*) FILTER (WHERE LOWER(status::text) = 'confirmed')::int AS "confirmedOrders",
                COUNT(*) FILTER (WHERE LOWER(status::text) = 'processing')::int AS "processingOrders",
                COUNT(*) FILTER (WHERE LOWER(status::text) = 'shipped')::int AS "shippedOrders",
                COUNT(*) FILTER (WHERE LOWER(status::text) = 'delivered')::int AS "deliveredOrders",
                COUNT(*) FILTER (WHERE LOWER(status::text) = 'cancelled')::int AS "cancelledOrders",
                COUNT(*) FILTER (WHERE LOWER(payment_status::text) = 'paid')::int AS "totalPaidOrders",
                COALESCE(
                    SUM(total_amount) FILTER (
                        WHERE LOWER(payment_status::text) = 'paid' AND LOWER(status::text) <> 'cancelled'
                    ), 0
                )::float8 AS "totalRevenue"
            FROM orders
            WHERE created_at >= ${startDate} AND created_at < ${endDate}
        `;

        const {
            totalOrders,
            pendingOrders,
            confirmedOrders,
            processingOrders,
            shippedOrders,
            deliveredOrders,
            cancelledOrders,
            totalPaidOrders,
            totalRevenue
        } = rawData;

        const toPercent = (part) => (totalOrders > 0 ? Number(((part / totalOrders) * 100).toFixed(2)) : 0);

        const averageOrderValue = totalPaidOrders > 0
            ? Number((totalRevenue / totalPaidOrders).toFixed(2))
            : 0;

        return res.status(200).json({
            success: true,
            filter: {
                year,
                month,
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            },
            statistics: {
                overview: {
                    totalRevenue,
                    averageOrderValue,
                    actionableOrdersCount: pendingOrders + confirmedOrders + processingOrders
                },
                orderCounts: {
                    total: totalOrders,
                    pending: pendingOrders,
                    confirmed: confirmedOrders,
                    processing: processingOrders,
                    shipped: shippedOrders,
                    delivered: deliveredOrders,
                    cancelled: cancelledOrders
                },
                rates: {
                    completionRatePercentage: toPercent(deliveredOrders),
                    cancellationRatePercentage: toPercent(cancelledOrders)
                }
            }
        });
    } catch (error) {
        return handleError(res, error, "Dashboard Statistics Error", "Failed to fetch dashboard statistics.");
    }
};

/**
 * @method GET /api/v1/orders/admin/analytics/top-selling-products
 * @description Get top selling products by sales volume and revenue (with variant breakdown)
 * @access Private (Admin)
 */
const getTopSellingProducts = async (req, res) => {
    try {
        const limit = Math.max(parseInt(req.query.limit, 10) || 5, 1);
        const { categoryId } = req.query; // Optional category filter

        const parsedCategoryId = categoryId ? parseId(categoryId) : null;

        if (categoryId && !parsedCategoryId) {
            return sendError(res, 400, "Valid category ID is required.");
        }

        const categoryFilter = parsedCategoryId
            ? Prisma.sql`AND p.category_id = ${parsedCategoryId}`
            : Prisma.empty;

        const products = await prisma.$queryRaw`
            SELECT
                p.id AS "productId",
                p.product_name AS "productName",
                p.price::float8 AS "basePrice",
                p.stock_quantity AS "currentStock",
                p.status AS "productStatus",
                c.category_name AS "categoryName",
                oi.product_variant_id AS "variantId",
                pv.colors AS "variantColor",
                pv.sizes AS "variantSize",
                CONCAT_WS(' / ', pv.colors, pv.sizes) AS "variantLabel",
                pv.stock_quantity AS "variantStock",
                COUNT(DISTINCT oi.order_id)::int AS "totalOrders",
                SUM(oi.quantity)::int AS "totalUnitsSold",
                COALESCE(SUM(oi.total_amount), 0)::float8 AS "totalRevenueGenerated",
                ROUND(AVG(oi.quantity)::numeric, 2)::float8 AS "avgUnitsPerOrder",
                ROUND((COALESCE(SUM(oi.total_amount), 0) / NULLIF(SUM(oi.quantity), 0))::numeric, 2)::float8 AS "avgSellingPrice",
                ROUND(
                    (COALESCE(SUM(oi.total_amount), 0) * 100.0 /
                    NULLIF((
                        SELECT SUM(oi2.total_amount)
                        FROM order_items oi2
                        JOIN orders o2 ON oi2.order_id = o2.id
                        WHERE UPPER(o2.payment_status::text) = 'PAID'
                        AND LOWER(o2.status::text) <> 'cancelled'
                    ), 0))::numeric,
                2)::float8 AS "revenueSharePercent"
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN products p ON oi.product_id = p.id
            LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE UPPER(o.payment_status::text) = 'PAID'
            AND LOWER(o.status::text) <> 'cancelled'
            AND p.deleted_at IS NULL
            ${categoryFilter}
            GROUP BY
                p.id, p.product_name, p.price, p.stock_quantity, p.status,
                c.category_name, oi.product_variant_id, pv.colors, pv.sizes, pv.stock_quantity
            ORDER BY "totalUnitsSold" DESC
            LIMIT ${limit}
        `;

        const rankedProducts = products.map((item, index) => ({
            rank: index + 1,
            ...item
        }));

        return res.status(200).json({
            success: true,
            message: "Top Selling Products (with variant breakdown)",
            count: rankedProducts.length,
            data: serialize(rankedProducts)
        });
    } catch (error) {
        return handleError(res, error, "Top Selling Products Error", "Failed to fetch top selling products.");
    }
};

/**
 * @method GET /api/v1/orders/admin/analytics/sales-trend
 * @description Get sales and revenue trends over time (monthly/daily)
 * @access Private (Admin)
 */
const getSalesTrendOverTime = async (req, res) => {
    try {
        const year = parseInt(req.query.year, 10) || new Date().getFullYear();
        const groupBy = req.query.groupBy || "month"; // 'month' or 'day'

        const periodFormat = groupBy === "day"
            ? Prisma.sql`'YYYY-MM-DD'`
            : Prisma.sql`'YYYY-MM'`;

        const startDate = new Date(year, 0, 1);
        const endDate = new Date(year + 1, 0, 1);

        const trends = await prisma.$queryRaw`
            SELECT
                TO_CHAR(created_at, ${periodFormat}) AS period,
                COUNT(id)::int AS "totalOrders",
                COALESCE(
                    SUM(
                        CASE
                            WHEN LOWER(payment_status::text) = 'paid' AND LOWER(status::text) <> 'cancelled'
                            THEN total_amount
                            ELSE 0
                        END
                    ), 0
                )::float8 AS revenue
            FROM orders
            WHERE created_at >= ${startDate} AND created_at < ${endDate}
            GROUP BY period
            ORDER BY period ASC
        `;

        return res.status(200).json({
            success: true,
            year,
            groupBy,
            trends: serialize(trends)
        });
    } catch (error) {
        return handleError(res, error, "Sales Trend Analytics Error", "Failed to fetch sales trend.");
    }
};

/**
 * @method GET /api/v1/orders/admin/analytics/inventory-alerts
 * @description Get low stock and out-of-stock product warnings
 * @access Private (Admin)
 */
const getInventoryAlerts = async (req, res) => {
    try {
        const threshold = parseInt(req.query.threshold, 10) || 10; // Default: low stock <= 10 items

        const lowStockItems = await prisma.product.findMany({
            where: { stockQuantity: { lte: threshold } },
            orderBy: { stockQuantity: "asc" },
            select: { id: true, productName: true, stockQuantity: true, price: true }
        });

        const items = lowStockItems.map((product) => ({
            productId: product.id,
            productName: product.productName,
            stock_quantity: product.stockQuantity,
            price: product.price,
            stockStatus: product.stockQuantity === 0 ? "OUT_OF_STOCK" : "LOW_STOCK"
        }));

        return res.status(200).json({
            success: true,
            threshold,
            count: items.length,
            items: serialize(items)
        });
    } catch (error) {
        return handleError(res, error, "Inventory Alerts Error", "Failed to fetch inventory alerts.");
    }
};

/**
 * @method GET /api/v1/orders/admin/analytics/customer-metrics
 * @description Get customer lifetime value and repeat purchase analytics
 * @access Private (Admin)
 */
const getCustomerAnalytics = async (req, res) => {
    try {
        const [data] = await prisma.$queryRaw`
            SELECT
                COUNT(DISTINCT u.id)::int AS "totalCustomers",
                COUNT(DISTINCT CASE WHEN order_counts.total_orders > 1 THEN u.id END)::int AS "repeatCustomers",
                COUNT(DISTINCT CASE WHEN order_counts.total_orders = 1 THEN u.id END)::int AS "singlePurchaseCustomers",
                COALESCE(AVG(order_counts.customer_total_spend), 0)::float8 AS "averageCustomerLifetimeValue"
            FROM users u
            LEFT JOIN (
                SELECT
                    user_id,
                    COUNT(id) AS total_orders,
                    SUM(
                        CASE
                            WHEN LOWER(payment_status::text) = 'paid' AND LOWER(status::text) <> 'cancelled'
                            THEN total_amount
                            ELSE 0
                        END
                    ) AS customer_total_spend
                FROM orders
                GROUP BY user_id
            ) order_counts ON u.id = order_counts.user_id
            WHERE u.role_id = 2
        `;

        const { totalCustomers, repeatCustomers, singlePurchaseCustomers, averageCustomerLifetimeValue } = data;

        const repeatPurchaseRate = totalCustomers > 0
            ? parseFloat(((repeatCustomers / totalCustomers) * 100).toFixed(2))
            : 0;

        return res.status(200).json({
            success: true,
            analytics: {
                totalCustomers,
                repeatCustomers,
                singlePurchaseCustomers,
                repeatPurchaseRatePercentage: repeatPurchaseRate,
                averageCustomerLifetimeValue: parseFloat(averageCustomerLifetimeValue.toFixed(2))
            }
        });
    } catch (error) {
        return handleError(res, error, "Customer Analytics Error", "Failed to fetch customer analytics.");
    }
};

/**
 * @method GET /api/v1/orders/admin/analytics/customer-metrics/paid-customers
 * @description Get paid customers (latest paid order + totals), paginated
 * @access Private (Admin)
 */
const getAllPaidCustomers = async (req, res) => {
    try {
        const { page, limit, offset } = getPagination(req, 20);

        // Latest paid order + totals per customer
        const customers = await prisma.$queryRaw`
            WITH paid_orders AS (
                SELECT
                    o.id,
                    o.user_id,
                    o.net_amount,
                    o.created_at,
                    ROW_NUMBER() OVER (PARTITION BY o.user_id ORDER BY o.created_at DESC) AS rn
                FROM orders o
                WHERE UPPER(o.payment_status::text) = 'PAID'
            ),
            customer_totals AS (
                SELECT
                    user_id,
                    COUNT(*) AS total_paid_orders,
                    SUM(net_amount) AS total_paid
                FROM orders
                WHERE UPPER(payment_status::text) = 'PAID'
                GROUP BY user_id
            )
            SELECT
                u.id AS "customerId",
                u.full_name AS "customerName",
                u.email AS "emailAddress",
                u.phone_number AS "mobileNumber",
                osa.full_address AS "shippingAddress",
                osa.city AS "shippingCity",
                osa.state AS "shippingState",
                osa.zip_code AS "shippingZipCode",
                po.created_at AS "lastOrderDate",
                ct.total_paid_orders::int AS "totalPaidOrders",
                ct.total_paid::float8 AS "totalPaid"
            FROM paid_orders po
            JOIN users u ON u.id = po.user_id
            JOIN customer_totals ct ON ct.user_id = po.user_id
            LEFT JOIN order_shipping_addresses osa ON osa.order_id = po.id
            WHERE po.rn = 1
            ORDER BY po.created_at DESC
            LIMIT ${limit} OFFSET ${offset}
        `;

        // Total count (distinct paid customers)
        const [{ totalCount }] = await prisma.$queryRaw`
            SELECT COUNT(DISTINCT user_id)::int AS "totalCount"
            FROM orders
            WHERE UPPER(payment_status::text) = 'PAID'
        `;

        return res.status(200).json({
            success: true,
            message: "Paid customers retrieved successfully.",
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.ceil(totalCount / limit)
            },
            data: serialize(customers)
        });
    } catch (error) {
        return handleError(res, error, "Get All Paid Customers Error", "Failed to retrieve paid customers.");
    }
};

export {
    createOrder,
    buyNowDirectly,
    getOrdersByUserId,
    getOrderByOrderId,
    order_cancel,
    updateOrderStatus,
    getAllOrders,
    orderDashboardStatistics,
    getOrderDetailsByOrderId,
    updatePaymentStatus,
    getTopSellingProducts,
    getSalesTrendOverTime,
    getInventoryAlerts,
    getCustomerAnalytics,
    getAllPaidCustomers
};
