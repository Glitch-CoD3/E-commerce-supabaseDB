import prisma from "../config/prisma.js";
import { uploadImageToCloudinary, deleteImageFromCloudinary } from "../utils/cloudinary.js";

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                                 Controllers                                */
/* -------------------------------------------------------------------------- */

/**
 * @description Upload an image for a product variant
 * @access Private (Admin)
 */
const uploadVariantImage = async (req, res) => {
    try {
        const { variantId } = req.params;

        const imageLocalPath = req.file?.path;

        if (!imageLocalPath) {
            return sendError(res, 400, "Image is required");
        }

        const parsedVariantId = parseId(variantId);

        if (!parsedVariantId) {
            return sendError(res, 400, "Valid variant ID is required.");
        }

        // Check variant exists (before uploading, to avoid orphaned Cloudinary images)
        const variant = await prisma.productVariant.findFirst({
            where: { id: parsedVariantId, deletedAt: null },
            select: { id: true }
        });

        if (!variant) {
            return sendError(res, 404, "Product variant not found.");
        }

        // Upload image
        const result = await uploadImageToCloudinary(imageLocalPath);

        if (!result) {
            return sendError(res, 500, "Cloudinary upload failed");
        }

        // Get next sort_order
        const lastImage = await prisma.variantImage.findFirst({
            where: { productVariantId: parsedVariantId },
            orderBy: { sortOrder: "desc" },
            select: { sortOrder: true }
        });

        const sortOrder = (lastImage?.sortOrder || 0) + 1;

        // Save image
        await prisma.variantImage.create({
            data: {
                productVariantId: parsedVariantId,
                imageUrl: result.secure_url,
                sortOrder
            }
        });

        return res.status(201).json({
            success: true,
            message: "Image uploaded successfully.",
            data: {
                image_url: result.secure_url,
                sort_order: sortOrder
            }
        });
    } catch (error) {
        return handleError(res, error, "Upload Variant Image Error", "Failed to upload image.");
    }
};

/**
 * @description Get all images of a product variant
 * @access Private (Admin)
 */
const getVariantImages = async (req, res) => {
    try {
        const { variantId } = req.params;
        const parsedVariantId = parseId(variantId);

        if (!parsedVariantId) {
            return sendError(res, 400, "Valid variant ID is required.");
        }

        const images = await prisma.variantImage.findMany({
            where: { productVariantId: parsedVariantId, deletedAt: null },
            orderBy: { sortOrder: "asc" },
            select: {
                id: true,
                productVariantId: true,
                imageUrl: true,
                sortOrder: true,
                createdAt: true
            }
        });

        return res.status(200).json({
            success: true,
            count: images.length,
            data: serialize(images)
        });
    } catch (error) {
        return handleError(res, error, "Get Variant Images Error", "Failed to retrieve images.");
    }
};

/**
 * @description Delete a variant image (Cloudinary asset and database record)
 * @access Private (Admin)
 */
const deleteVariantImage = async (req, res) => {
    try {
        const { imageId } = req.params;
        const parsedImageId = parseId(imageId);

        if (!parsedImageId) {
            return sendError(res, 400, "Valid image ID is required.");
        }

        // Find image
        const image = await prisma.variantImage.findFirst({
            where: { id: parsedImageId, deletedAt: null },
            select: { imageUrl: true }
        });

        if (!image) {
            return sendError(res, 404, "Image not found.");
        }

        // Delete from Cloudinary
        const cloudinaryResult = await deleteImageFromCloudinary(image.imageUrl);

        if (!cloudinaryResult || cloudinaryResult.result !== "ok") {
            return sendError(res, 500, "Failed to delete image from Cloudinary.");
        }

        // Delete record
        await prisma.variantImage.delete({ where: { id: parsedImageId } });

        return res.status(200).json({
            success: true,
            message: "Image deleted successfully."
        });
    } catch (error) {
        return handleError(res, error, "Delete Variant Image Error", "Failed to delete image.");
    }
};

export {
    uploadVariantImage,
    getVariantImages,
    deleteVariantImage
};