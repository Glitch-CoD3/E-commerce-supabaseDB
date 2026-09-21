import prisma from '../config/prisma.js'
import { uploadImageToCloudinary } from "../utils/cloudinary.js";
import { deleteImageFromCloudinary } from "../utils/cloudinary.js";

const uploadVariantImage = async (req, res) => {
    try {

        const { variantId } = req.params;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Image is required"
            });
        }

        // Check for avatar
        const imageLocalPath = req.file.path;
        if (!imageLocalPath) {

            return res.status(401).json({
                success: false,
                message: "Image are required"
            })
        }



        // Upload images
        const result = await uploadImageToCloudinary(imageLocalPath);

        if (!result) {
            return res.status(500).json({
                success: false,
                message: "Cloudinary upload failed"
            });
        }

        // Get next sort_order
        const lastImage = await prisma.variantImage.findFirst({
            where: { productVariantId: BigInt(variantId) },
            orderBy: { sortOrder: "desc" },
            select: { sortOrder: true }
        });
        const sortOrder = (lastImage?.sortOrder || 0) + 1;

        // Save image
        await prisma.variantImage.create({
            data: {
                productVariantId: BigInt(variantId),
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

        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};

const getVariantImages = async (req, res) => {
    try {

        const { variantId } = req.params;

        const images = await prisma.variantImage.findMany({
            where: { productVariantId: BigInt(variantId), deletedAt: null },
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
            data: JSON.parse(JSON.stringify(images, (_, value) =>
                typeof value === "bigint" ? Number(value) : value
            ))
        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};


const deleteVariantImage = async (req, res) => {
    try {

        const { imageId } = req.params;

        // Find image
        const image = await prisma.variantImage.findFirst({
            where: { id: BigInt(imageId), deletedAt: null },
            select: { imageUrl: true }
        });

        if (!image) {
            return res.status(404).json({
                success: false,
                message: "Image not found."
            });
        }
        // Delete from Cloudinary
        const cloudinaryResult = await deleteImageFromCloudinary(image.imageUrl);

        if (!cloudinaryResult || cloudinaryResult.result !== "ok") {
            return res.status(500).json({
                success: false,
                message: "Failed to delete image from Cloudinary."
            });
        }

        // Soft delete
        await prisma.variantImage.delete({ where: { id: BigInt(imageId) } });

        return res.status(200).json({
            success: true,
            message: "Image deleted successfully."
        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
};


export {
    uploadVariantImage,
    getVariantImages,
    deleteVariantImage
}