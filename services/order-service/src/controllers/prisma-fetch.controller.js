import prisma from "../config/prisma.js";

const mapOrder = (order) => ({
    id: Number(order.id),
    order_number: order.orderNumber,
    user_id: Number(order.userId),
    total_amount: order.totalAmount,
    discount_amount: order.discountAmount,
    shipping_charge: order.shippingCharge,
    net_amount: order.netAmount,
    status: order.status,
    payment_status: order.paymentStatus,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
    items: order.items.map((item) => ({
        id: Number(item.id),
        order_id: Number(item.orderId),
        product_name: item.productName,
        product_id: Number(item.productId),
        product_variant_id: item.productVariantId === null ? null : Number(item.productVariantId),
        price: item.price,
        quantity: item.quantity,
        total_amount: item.totalAmount,
        created_at: item.createdAt
    })),
    shipping_address: order.shippingAddresses[0] || null
});

const orderInclude = {
    items: { orderBy: { id: "asc" } },
    shippingAddresses: true
};

const getOrdersByUserId = async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            where: { userId: BigInt(req.user.id) },
            include: orderInclude,
            orderBy: { createdAt: "desc" }
        });
        return res.status(200).json({ success: true, count: orders.length, orders: orders.map(mapOrder) });
    } catch (error) {
        console.error("Prisma order fetch error:", error);
        return res.status(500).json({ success: false, message: "Failed to retrieve orders." });
    }
};

const getOrderByOrderId = async (req, res) => {
    try {
        const order = await prisma.order.findFirst({
            where: {
                id: BigInt(req.params.orderId),
                userId: BigInt(req.user.id)
            },
            include: orderInclude
        });
        if (!order) return res.status(404).json({ success: false, message: "Order not found." });
        return res.status(200).json({ success: true, order: mapOrder(order) });
    } catch (error) {
        console.error("Prisma order detail fetch error:", error);
        return res.status(500).json({ success: false, message: "Failed to retrieve order." });
    }
};

const getShippingAddress = async (req, res) => {
    try {
        const addresses = await prisma.shippingAddress.findMany({
            where: { userId: BigInt(req.params.id) },
            orderBy: { createdAt: "desc" }
        });
        if (!addresses.length) return res.status(404).json({ success: false, message: "No shipping addresses found for this user." });
        return res.status(200).json({ success: true, addresses: addresses.map((address) => ({
            ...address,
            id: Number(address.id),
            user_id: Number(address.userId),
            full_address: address.fullAddress,
            phone_number: address.phoneNumber,
            zip_code: address.zipCode,
            is_default: address.isDefault
        })) });
    } catch (error) {
        console.error("Prisma shipping address fetch error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};

export { getOrdersByUserId, getOrderByOrderId, getShippingAddress };
