import prisma from "../config/prisma.js";

const mapCart = (item) => ({
    id: Number(item.id),
    user_id: Number(item.userId),
    product_id: item.productId === null ? null : Number(item.productId),
    product_variant_id: item.productVariantId === null ? null : Number(item.productVariantId),
    quantity: item.quantity,
    created_at: item.createdAt,
    updated_at: item.updatedAt
});

const getCart = async (req, res) => {
    try {
        const cart = await prisma.cart.findMany({
            where: { userId: BigInt(req.user.id) },
            orderBy: { createdAt: "desc" }
        });
        return res.status(200).json({
            success: true,
            count: cart.length,
            data: cart.map(mapCart),
            links: { add_to_cart: "/api/v1/cart", clear_cart: "/api/v1/cart" }
        });
    } catch (error) {
        console.error("Prisma cart fetch error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};

const getCartItemById = async (req, res) => {
    try {
        const item = await prisma.cart.findFirst({
            where: { id: BigInt(req.params.id), userId: BigInt(req.user.id) }
        });
        if (!item) return res.status(404).json({ success: false, message: "Cart item not found." });
        return res.status(200).json({
            success: true,
            data: mapCart(item),
            links: { self: `/api/v1/cart/${req.params.id}`, cart: "/api/v1/cart" }
        });
    } catch (error) {
        console.error("Prisma cart item fetch error:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};

export { getCart, getCartItemById };
