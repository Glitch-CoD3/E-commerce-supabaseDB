import { OrderStatus } from "@prisma/client";
import prisma from "../config/prisma.js";

export const isValid = (val) => val !== undefined && val !== null && String(val).trim() !== "";

export const parseBoolean = (value) => value === true || value === 1 || value === "1" || value === "true";


export const serialize = (data) => JSON.parse(JSON.stringify(data, (_, value) =>
    typeof value === "bigint" ? Number(value) : value
));


export const parseId = (id) => {
    const value = String(id ?? "");
    return /^\d+$/.test(value) ? BigInt(value) : null;
};





export const formatOrder = (order) => ({
    id: order.id,
    order_number: order.orderNumber,
    user_id: order.userId,
    total_amount: order.totalAmount,
    discount_amount: order.discountAmount,
    shipping_charge: order.shippingCharge,
    net_amount: order.netAmount,
    status: order.status,
    payment_status: order.paymentStatus,
    created_at: order.createdAt,
    updated_at: order.updatedAt
});

export const formatOrderItem = (item) => ({
    id: item.id,
    order_id: item.orderId,
    product_id: item.productId,
    product_variant_id: item.productVariantId,
    product_name: item.productName,
    price: item.price,
    quantity: item.quantity,
    total_amount: item.totalAmount
});

export const formatShippingAddress = (address) => address && ({
    order_id: address.orderId,
    full_address: address.fullAddress,
    phone_number: address.phoneNumber,
    state: address.state,
    city: address.city,
    zip_code: address.zipCode
});

// Creates the order, its items and the shipping snapshot atomically
export const createOrderWithItems = ({ user_id, orderNumber, orderItems, subtotal, shippingFee, total, shipping }) =>
    prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
            data: {
                orderNumber,
                userId: user_id,
                totalAmount: subtotal,
                discountAmount: 0,
                shippingCharge: shippingFee,
                netAmount: total,
                status: OrderStatus.pending
            },
            select: { id: true }
        });

        await tx.orderItem.createMany({
            data: orderItems.map((item) => ({
                orderId: order.id,
                productName: item.product_name,
                productId: parseId(item.product_id),
                productVariantId: parseId(item.product_variant_id),
                price: item.price,
                quantity: item.quantity,
                totalAmount: item.total_amount
            }))
        });

        await tx.orderShippingAddress.create({
            data: { orderId: order.id, ...shipping }
        });

        return order;
    });


   export const formatOrderDetails = (order) => ({
    order: {
        id: order.id,
        order_number: order.orderNumber,
        status: order.status,
        payment_status: order.paymentStatus,
        total_amount: order.totalAmount,
        discount_amount: order.discountAmount,
        shipping_charge: order.shippingCharge,
        net_amount: order.netAmount,
        created_at: order.createdAt
    },

    customer: order.user
        ? {
            id: order.user.id,
            name: order.user.fullName,
            email: order.user.email,
            phone: order.user.phoneNumber
        }
        : null,

    items: order.items.map((item) => ({
        id: item.id,
        product_name: item.productName,
        product_id: item.productId,
        product_slug: item.product?.urlSlug ?? null,
        variant_id: item.productVariantId,
        color: item.variant?.colors ?? null,
        size: item.variant?.sizes ?? null,
        price: item.price,
        quantity: item.quantity,
        total_amount: item.totalAmount,
        image_url: item.variant?.images?.[0]?.imageUrl ?? null
    })),

    // Flat map: variant id → array of image URLs, if your frontend wants this shape too
    // productsVariants: order.items.reduce((acc, item) => {
    //     if (item.variant) {
    //         acc[item.variant.id] = item.variant.images.map((img) => img.imageUrl);
    //     }
    //     return acc;
    // }, {}),

    shippingAddress: order.shippingAddresses?.[0] ?? null
});