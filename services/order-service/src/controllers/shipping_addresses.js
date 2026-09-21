import prisma from "../config/prisma.js";
import { redis } from '../config/redis.config.js'

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */
const ADDRESS_CACHE_TTL= 300;

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

const parseBoolean = (value) => value === true || value === 1 || value === "1" || value === "true";

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

// Prisma camelCase -> snake_case response shape
const formatShippingAddress = (address) => ({
    id: address.id,
    user_id: address.userId,
    full_address: address.fullAddress,
    city: address.city,
    state: address.state,
    zip_code: address.zipCode,
    phone_number:address.phoneNumber,
    is_default: address.isDefault,
    created_at: address.createdAt,
    updated_at: address.updatedAt
});

/* -------------------------------------------------------------------------- */
/*                                 Controllers                                */
/* -------------------------------------------------------------------------- */

/**
 * @method POST /api/v1/shipping-addresses
 * @description Create a new shipping address
 * @access Private
 */
const createShippingAddress = async (req, res) => {
    try {
        const { full_address, state, city, zip_code, phone_number } = req.body;

        if (!zip_code) {
            return sendError(res, 400, "Zip code is required.");
        }

        const user_id = parseId(req.user?.id || req.body.user_id);

        if (!user_id) {
            return sendError(res, 400, "Valid user ID is required.");
        }

        const address = await prisma.shippingAddress.create({
            data: {
                userId: user_id,
                fullAddress: full_address || "",
                state: state || "",
                city: city || "",
                zipCode: zip_code,
                phoneNumber:phone_number || ""
            },
            select: { id: true }
        });

        return res.status(201).json({
            success: true,
            message: "Address created successfully",
            id: Number(address.id)
        });
    } catch (error) {
        return handleError(res, error, "Create Shipping Address Error", "Failed to create shipping address.");
    }
};

/**
 * @method PUT /api/v1/shipping-addresses/:id
 * @description Update an existing shipping address
 * @access Private
 */
const updateShippingAddress = async (req, res) => {
    try {
        const user_id = parseId(req.user?.id);
        const address_id = parseId(req.params.id);
        const { full_address, city, state, is_default, zip_code, phone_number } = req.body;

        if (!user_id) {
            return sendError(res, 401, "Authentication required.");
        }

        if (!address_id) {
            return sendError(res, 400, "Valid address ID is required.");
        }

        // Check address exists & belongs to user
        const address = await prisma.shippingAddress.findFirst({
            where: { id: address_id, userId: user_id },
            select: { id: true }
        });

        if (!address) {
            return sendError(res, 404, "Shipping address not found.");
        }

        if (
            !isValid(full_address) && !isValid(city) && !isValid(state) &&
            !isValid(zip_code) && !isValid(phone_number) && is_default === undefined
        ) {
            return sendError(
                res,
                400,
                "At least one valid field (full_address, city, state, zip_code, is_default) is required to update."
            );
        }

        // Build update data
        const data = {};

        if (isValid(full_address)) data.fullAddress = String(full_address).trim();
        if (isValid(city)) data.city = String(city).trim();
        if (isValid(state)) data.state = String(state).trim();
        if (isValid(zip_code)) data.zipCode = String(zip_code).trim();
        if (isValid(phone_number)) data.phoneNumber = String(phone_number).trim();
        if (is_default !== undefined) data.isDefault = parseBoolean(is_default);

        // Setting a new default clears the flag on the user's other addresses
        const updatedAddress = await prisma.$transaction(async (tx) => {
            if (data.isDefault) {
                await tx.shippingAddress.updateMany({
                    where: { userId: user_id, NOT: { id: address_id } },
                    data: { isDefault: false }
                });
            }

            return tx.shippingAddress.update({
                where: { id: address_id },
                data: { ...data, updatedAt: new Date() }
            });
        });

        return res.status(200).json({
            success: true,
            message: "Shipping address updated successfully.",
            data: serialize(formatShippingAddress(updatedAddress)),
            links: {
                self: `/api/v1/shipping-addresses/${req.params.id}`,
                user_addresses: "/api/v1/shipping-addresses"
            }
        });
    } catch (error) {
        return handleError(res, error, "Update Shipping Address Error", "Failed to update shipping address.");
    }
};

/**
 * @method GET /api/v1/shipping-addresses/:id
 * @description Get one of the authenticated user's shipping addresses
 * @access Private
 */
const getShippingAddressById = async (req, res) => {
    try {
        const user_id = parseId(req.user?.id);
        const address_id = parseId(req.params.id);

        if (!user_id) {
            return sendError(res, 401, "Authentication required.");
        }

        if (!address_id) {
            return sendError(res, 400, "Valid address ID is required.");
        }

        const address = await prisma.shippingAddress.findFirst({
            where: { id: address_id, userId: user_id }
        });

        if (!address) {
            return sendError(res, 404, "Shipping address not found.");
        }

        return res.status(200).json({
            success: true,
            address: serialize(formatShippingAddress(address))
        });
    } catch (error) {
        return handleError(res, error, "Get Shipping Address By ID Error", "Failed to retrieve shipping address.");
    }
};

/**
 * @method GET /api/v1/shipping-addresses/user/:id
 * @description Get all shipping addresses of a user
 * @access Private
 */
const getShippingAddress = async (req, res) => {
    try {

        res.set("Cache-Control", "private, max-age=60");

        const user_id = parseId(req.params.id);

        if (!user_id) {
            return sendError(res, 400, "Valid user ID is required.");
        }

        const cacheKey = `shipping:addresses:${user_id}`;

        try {
            const cachedAddresses = await redis.get(cacheKey);
            if (cachedAddresses) {
                console.log(`[Redis] Cache HIT — shipping addresses served from Redis (key: ${cacheKey})`);
                return res.status(200).json(cachedAddresses);
            }
            console.log(`[Redis] Cache MISS — fetching shipping addresses from database (key: ${cacheKey})`);
        } catch (redisErr) {
            console.error("[Redis] GET failed, falling back to database:", redisErr.message);
        }

        const addresses = await prisma.shippingAddress.findMany({
            where: { userId: user_id },
            orderBy: { id: "asc" }
        });

        if (!addresses.length) {
            return sendError(res, 404, "No shipping addresses found for this user.");
        }

        const responsePayload = {
            success: true,
            addresses: serialize(addresses.map(formatShippingAddress))
        };

        try {
            await redis.set(cacheKey, serialize(responsePayload), { ex: ADDRESS_CACHE_TTL });
            console.log(`[Redis] Shipping addresses cached for ${ADDRESS_CACHE_TTL}s (key: ${cacheKey})`);
        } catch (redisErr) {
            console.error("[Redis] SET failed, response served without caching:", redisErr.message);
        }

        return res.status(200).json(responsePayload);
    } catch (error) {
        return handleError(res, error, "Get Shipping Addresses Error", "Failed to retrieve shipping addresses.");
    }
};

/**
 * @method DELETE /api/v1/shipping-addresses/:id
 * @description Delete one of the authenticated user's shipping addresses
 * @access Private
 */
const deleteShippingAddress = async (req, res) => {
    try {
        const user_id = parseId(req.user?.id);
        const address_id = parseId(req.params.id);

        if (!user_id) {
            return sendError(res, 401, "Authentication required.");
        }

        if (!address_id) {
            return sendError(res, 400, "Valid address ID is required.");
        }

        // Delete only if the address belongs to the user
        const { count } = await prisma.shippingAddress.deleteMany({
            where: { id: address_id, userId: user_id }
        });

        if (!count) {
            return sendError(res, 404, "Address not found or already deleted.");
        }

        return res.status(200).json({
            success: true,
            message: "Shipping address deleted successfully."
        });
    } catch (error) {
        // Addresses referenced by an order cannot be removed
        if (error.code === "P2003") {
            return sendError(res, 409, "This address is used by an existing order and cannot be deleted.");
        }

        return handleError(res, error, "Delete Shipping Address Error", "Failed to delete shipping address.");
    }
};

export {
    createShippingAddress,
    updateShippingAddress,
    getShippingAddress,
    getShippingAddressById,
    deleteShippingAddress
};