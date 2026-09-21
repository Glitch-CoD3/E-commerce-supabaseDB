import prisma from "../config/prisma.js";
export const getShippingAddress = async (user_id) => {
    if (!user_id) {
        throw new Error("Valid user ID is required.");
    }

    const addresses = await prisma.shippingAddress.findMany({
        where: {
            userId: user_id
        },
        orderBy: {
            id: "asc"
        }
    });

    if (!addresses.length) {
        return null;
    }

    return addresses.map((address) => ({
        id: address.id,
        full_address: address.fullAddress,
        phone_number: address.phoneNumber,
        state: address.state,
        city: address.city,
        zip_code: address.zipCode,
        is_default: address.isDefault
    }));
};