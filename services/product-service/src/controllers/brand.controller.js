import prisma from "../config/prisma.js";

const serializeBigInt = (data) => JSON.parse(JSON.stringify(data, (_, value) =>
    typeof value === "bigint" ? Number(value) : value
));

const parseBrandId = (id) => {
    if (!id || !/^\d+$/.test(id)) {
        return null;
    }

    return BigInt(id);
};

/**
 * @method POST /api/v1/brands
 * @description Create a new brand
 * @access Private (Admin)
 */
const createBrand = async (req, res) => {
    try {
        const { brand_name, logo } = req.body;
        console.log(brand_name);

        if (!brand_name) {
            return res.status(400).json({
                success: false,
                message: 'Brand name is required.',
            });
        }

        // Check if brand already exists
        const existing = await prisma.brand.findUnique({
            where: { brandName: brand_name },
            select: { id: true }
        });

        if (existing) {
            return res.status(409).json({
                success: false,
                message: 'Brand with this name already exists.',
            });
        }

        // Insert new brand
        const createdBrand = await prisma.brand.create({
            data: { brandName: brand_name, logo: logo || null },
            select: { id: true }
        });

        return res.status(201).json({
            success: true,
            message: 'Brand created successfully.',
            data: {
                id: Number(createdBrand.id),
                brand_name,
                logo: logo || null,
            },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to create brand.',
            error: error.message,
        });
    }
};

/**
 * @method GET /api/v1/brands
 * @description Get all brands (with pagination and search)
 * @access Public / Private
 */
const getAllBrands = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const search = req.query.search || '';
        const offset = (page - 1) * limit;

        const searchParam = `%${search}%`;

        // Fetch brands and total count
        const where = search ? { brandName: { contains: search, mode: "insensitive" } } : {};
        const [brands, total] = await Promise.all([
            prisma.brand.findMany({ where, orderBy: { id: "desc" }, skip: offset, take: limit }),
            prisma.brand.count({ where })
        ]);

        return res.status(200).json({
            success: true,
            message: 'Brands fetched successfully.',
            pagination: {
                totalItems: total,
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                pageSize: limit,
            },
            data: serializeBigInt(brands),
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve brands.',
            error: error.message,
        });
    }
};

/**
 * @method GET /api/v1/brands/:id
 * @description Get single brand by ID
 * @access Public / Private
 */
const getBrandById = async (req, res) => {
    try {
        const { id } = req.params;
        const brandId = parseBrandId(id);

        if (brandId === null) {
            return res.status(400).json({
                success: false,
                message: 'Valid brand ID is required.',
            });
        }

        const brand = await prisma.brand.findUnique({ where: { id: brandId } });

        if (!brand) {
            return res.status(404).json({
                success: false,
                message: 'Brand not found.',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Brand retrieved successfully.',
            data: serializeBigInt(brand),
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error retrieving brand.',
            error: error.message,
        });
    }
};


/**
 * @method PATCH /api/v1/brands/:id
 * @description Dynamically update brand by ID without replacing fields with empty strings
 * @access Private (Admin)
 */

const updateBrand = async (req, res) => {
    try {
        const { id } = req.params;
        const { brand_name, logo } = req.body;
        const brandId = parseBrandId(id);

        if (brandId === null) {
            return res.status(400).json({
                success: false,
                message: 'Valid brand ID is required.',
            });
        }

        // 1. Check if brand exists
        const existing = await prisma.brand.findUnique({ where: { id: brandId } });

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Brand not found.',
            });
        }

        // 2. Build dynamic update arrays only for non-empty values
        const data = {};

        // Only update brand_name if provided and not just empty whitespace
        if (brand_name !== undefined && brand_name.trim() !== '') {
            data.brandName = brand_name.trim();
        }

        // Only update logo if provided and not just empty whitespace
        if (logo !== undefined && logo.trim() !== '') {
            data.logo = logo.trim();
        }

        // 3. If no valid non-empty fields were passed, return early
        if (Object.keys(data).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid data provided to update.',
            });
        }

        // 4. Execute update query
        const updatedBrand = await prisma.brand.update({
            where: { id: brandId },
            data
        });

        return res.status(200).json({
            success: true,
            message: 'Brand updated successfully.',
            data: serializeBigInt(updatedBrand),
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to update brand.',
            error: error.message,
        });
    }
};

/**
 * @method DELETE /api/v1/brands/:id
 * @description Delete brand by ID
 * @access Private (Admin)
 */
const deleteBrand = async (req, res) => {
    try {
        const { id } = req.params;
        const brandId = parseBrandId(id);

        if (brandId === null) {
            return res.status(400).json({
                success: false,
                message: 'Valid brand ID is required.',
            });
        }

        const result = await prisma.brand.deleteMany({ where: { id: brandId } });

        if (result.count === 0) {
            return res.status(404).json({
                success: false,
                message: 'Brand not found.',
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Brand deleted successfully.',
            data: { id },
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to delete brand.',
            error: error.message,
        });
    }
};

export {
    createBrand,
    getAllBrands,
    getBrandById,
    updateBrand,
    deleteBrand,
};