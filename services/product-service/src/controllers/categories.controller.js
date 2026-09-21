import prisma from "../config/prisma.js";
import slugify from "slugify";


/*
|--------------------------------------------------------------------------
| Helper
|--------------------------------------------------------------------------
| Convert BigInt values before sending them through JSON.
| This is useful if your MySQL/Prisma IDs are BigInt.
*/
const serializeBigInt = (data) => {
    return JSON.parse(
        JSON.stringify(data, (_, value) =>
            typeof value === "bigint" ? Number(value) : value
        )
    );
};


/**
 * @method POST /api/v1/categories
 * @description Create a new category
 * @access Private (Admin)
 */
const createCategory = async (req, res) => {
    try {
        const {
            category_name,
            parent_category_id = null,
            status = "active"
        } = req.body;

        // Validation
        if (!category_name) {
            return res.status(400).json({
                success: false,
                message: "Category name is required."
            });
        }

        const slug = slugify(category_name, {
            lower: true,
            strict: true,
            trim: true
        });

        // Check slug uniqueness
        const slugExists = await prisma.category.findFirst({
            where: {
                urlSlug: slug
            },
            select: {
                id: true
            }
        });

        if (slugExists) {
            return res.status(409).json({
                success: false,
                message: "URL slug already exists."
            });
        }

        // Check parent category
        if (parent_category_id) {
            const parent = await prisma.category.findFirst({
                where: {
                    id: BigInt(parent_category_id)
                },
                select: {
                    id: true
                }
            });


            if (!parent) {
                return res.status(404).json({
                    success: false,
                    message: "Parent category not found."
                });
            }
        }

        // Create category
        const createdCategory = await prisma.category.create({
            data: {
                categoryName:category_name,
                urlSlug: slug,
                parentCategoryId: parent_category_id
                    ? BigInt(parent_category_id)
                    : null,
                status
            }
        });

        // Get total categories
        const totalCategories = await prisma.category.count({
            where: {
                deletedAt: null
            }
        });

        return res.status(201).json({
            success: true,
            message: "Category created successfully.",
            total_categories: totalCategories,
            created_category: serializeBigInt({
                id: createdCategory.id,
                category_name: createdCategory.categoryName,
                slug: createdCategory.urlSlug,
                parent_category_id: createdCategory.parentCategoryId,
                status: createdCategory.status
            }),
            links: {
                self: `/api/v1/categories/${createdCategory.id}`,
                all_categories: "/api/v1/categories",
                update: `/api/v1/categories/${createdCategory.id}`,
                delete: `/api/v1/categories/${createdCategory.id}`,
                products: `/api/v1/products?category_id=${createdCategory.id}`,
                create_product: "/api/v1/products"
            }
        });

    } catch (error) {
        console.error("Create Category Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};


/**
 * @method GET /api/v1/categories
 * @description Retrieve all categories
 * @access Public
 */
const getAllCategories = async (req, res) => {
    try {
        res.set("Cache-Control", "public, max-age=60");
        const categories = await prisma.category.findMany({
            where: {
                deletedAt: null
            },
            orderBy: {
                id: "desc"
            }
        });

        return res.status(200).json({
            success: true,
            count: categories.length,
            All_categories: serializeBigInt(categories),
            links: {
                create: "/api/v1/categories",
                parents: "/api/v1/categories/parents"
            }
        });

    } catch (error) {
        console.error("Get All Categories Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};


/**
 * @method GET /api/v1/categories/:id
 * @description Retrieve a category by its ID
 * @access Public
 */
const getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await prisma.category.findFirst({
            where: {
                id: BigInt(id),
                deletedAt: null
            }
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found."
            });
        }

        const {
            deletedAt,
            updatedAt,
            sort_order,
            createdAt,
            ...categoryData
        } = category;

        return res.status(200).json({
            success: true,
            Category: serializeBigInt(categoryData),
            links: {
                self: `/api/v1/categories/${id}`,
                update: `/api/v1/categories/${id}`,
                delete: `/api/v1/categories/${id}`,
                children: `/api/v1/categories/${id}/children`,
                products: `/api/v1/products?category_id=${id}`,
                create_product: "/api/v1/products"
            }
        });

    } catch (error) {
        console.error("Get Category By ID Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};


/**
 * @method GET /api/v1/categories/slug/:slug
 * @description Retrieve a category by its URL slug
 * @access Public
 */
const getCategoryBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        const category = await prisma.category.findFirst({
            where: {
                url_slug: slug,
                deleted_at: null
            }
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found."
            });
        }

        const {
            deleted_at,
            updated_at,
            sort_order,
            created_at,
            ...categoryData
        } = category;

        return res.status(200).json({
            success: true,
            category_BySlug: serializeBigInt(categoryData),
            links: {
                self: `/api/v1/categories/slug/${slug}`,
                by_id: `/api/v1/categories/${category.id}`,
                products: `/api/v1/products?category_id=${category.id}`
            }
        });

    } catch (error) {
        console.error("Get Category By Slug Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};


/**
 * @method PATCH /api/v1/categories/:id
 * @description Update a category by its ID
 * @access Private (Admin)
 */
const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            category_name,
            url_slug,
            parent_category_id,
            status
        } = req.body;

        // Validation
        if (!category_name || !status || !url_slug) {
            return res.status(400).json({
                success: false,
                message:
                    "Category name, status and url_slug are required."
            });
        }

        // Check category exists
        const existingCategory = await prisma.category.findFirst({
            where: {
                id: BigInt(id),
                deletedAt: null
            }
        });

        if (!existingCategory) {
            return res.status(404).json({
                success: false,
                message: "Category not found."
            });
        }

        // Check slug uniqueness
        const slugExists = await prisma.category.findFirst({
            where: {
                urlSlug:url_slug,
                NOT: {
                    id: BigInt(id)
                }
            },
            select: {
                id: true
            }
        });

        if (slugExists) {
            return res.status(409).json({
                success: false,
                message: "URL slug already exists."
            });
        }

        // Check parent category
        if (parent_category_id) {
            // Prevent category from being its own parent
            if (BigInt(parent_category_id) === BigInt(id)) {
                return res.status(400).json({
                    success: false,
                    message: "A category cannot be its own parent."
                });
            }

            const parent = await prisma.category.findFirst({
                where: {
                    id: BigInt(parent_category_id),
                    deletedAt: null
                },
                select: {
                    id: true
                }
            });

            if (!parent) {
                return res.status(404).json({
                    success: false,
                    message: "Parent category not found."
                });
            }
        }

        // Update category
        await prisma.category.update({
            where: {
                id: BigInt(id)
            },
            data: {
                categoryName: category_name,
                urlSlug:url_slug,
                parentCategoryId: parent_category_id
                    ? BigInt(parent_category_id)
                    : null,
                status
            }
        });

        return res.status(200).json({
            success: true,
            message: "Category updated successfully.",
            links: {
                self: `/api/v1/categories/${id}`,
                products: `/api/v1/products?category_id=${id}`,
                children: `/api/v1/categories/${id}/children`
            }
        });

    } catch (error) {
        console.error("Update Category Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};


/**
 * @method DELETE /api/v1/categories/:id
 * @description Delete a category by its ID
 * @access Private (Admin)
 */
const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        // Check category exists
        const existingCategory = await prisma.category.findFirst({
            where: {
                id: BigInt(id),
                deletedAt: null
            },
            select: {
                id: true
            }
        });

        if (!existingCategory) {
            return res.status(404).json({
                success: false,
                message: "Category not found."
            });
        }

        // Soft delete
        await prisma.category.update({
            where: {
                id: BigInt(id)
            },
            data: {
                deletedAt: new Date()
            }
        });

        return res.status(200).json({
            success: true,
            message: "Category deleted successfully.",
            links: {
                categories: "/api/v1/categories",
                create: "/api/v1/categories"
            }
        });

    } catch (error) {
        console.error("Delete Category Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};


/**
 * @method GET /api/v1/categories/parents
 * @description Retrieve all parent categories
 * @access Public
 */
const getParentCategories = async (req, res) => {
    try {
        const parents = await prisma.category.findMany({
            where: {
                parentCategoryId: null,
                deletedAt: null
            },
            orderBy: {
                id: "desc"
            }
        });

        return res.status(200).json({
            success: true,
            count: parents.length,
            parent_categories: serializeBigInt(parents),
            links: {
                all: "/api/v1/categories",
                create: "/api/v1/categories"
            }
        });

    } catch (error) {
        console.error("Get Parent Categories Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};


/**
 * @method GET /api/v1/categories/:parentId/children
 * @description Retrieve all child categories under a parent category
 * @access Public
 */
const getChildCategories = async (req, res) => {
    try {
        const { parentId } = req.params;

        // Check parent exists
        const parent = await prisma.category.findFirst({
            where: {
                id: BigInt(parentId),
                deletedAt: null
            },
            select: {
                id: true
            }
        });

        if (!parent) {
            return res.status(404).json({
                success: false,
                message: "Parent category not found."
            });
        }

        const children = await prisma.category.findMany({
            where: {
                parentCategoryId: BigInt(parentId),
                deletedAt: null
            },
            orderBy: {
                id: "desc"
            }
        });

        return res.status(200).json({
            success: true,
            count: children.length,
            Child_categories: serializeBigInt(children),
            links: {
                parent: `/api/v1/categories/${parentId}`,
                all_categories: "/api/v1/categories"
            }
        });

    } catch (error) {
        console.error("Get Child Categories Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};


/**
 * @method GET /api/v1/categories/deleted
 * @description Admin can see all deleted categories
 * @access Admin Only
 */
const getAllDeletedCategories = async (req, res) => {
    try {
        const categories = await prisma.category.findMany({
            where: {
                deletedAt: {
                    not: null
                }
            },
            orderBy: {
                id: "desc"
            }
        });

        return res.status(200).json({
            success: true,
            count: categories.length,
            All_Deleted_categories: serializeBigInt(categories),
            links: {
                create: "/api/v1/categories",
                parents: "/api/v1/categories/parents"
            }
        });

    } catch (error) {
        console.error("Get All Deleted Categories Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};


export {
    createCategory,
    getAllCategories,
    getCategoryById,
    updateCategory,
    deleteCategory,
    getCategoryBySlug,
    getParentCategories,
    getChildCategories,
    getAllDeletedCategories
};