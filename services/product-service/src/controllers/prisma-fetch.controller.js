import prisma from "../config/prisma.js";

const toNumber = (value) => Number(value);

const mapProduct = (product) => ({
    id: toNumber(product.id),
    name: product.productName,
    product_name: product.productName,
    shortDescription: product.shortDescription,
    short_description: product.shortDescription,
    description: product.description,
    price: product.price,
    stock_quantity: product.stockQuantity,
    category_id: toNumber(product.categoryId),
    url_slug: product.urlSlug,
    status: product.status,
    category_name: product.category?.categoryName,
    category_slug: product.category?.urlSlug,
    brand_id: product.brand ? toNumber(product.brand.id) : null,
    brand_name: product.brand?.brandName,
    brand_logo: product.brand?.logo,
    variants: product.variants.map((variant) => ({
        id: toNumber(variant.id),
        product_id: toNumber(variant.productId),
        colors: variant.colors,
        sizes: variant.sizes,
        price: variant.price,
        stock_quantity: variant.stockQuantity,
        images: variant.images.map((image) => ({
            id: toNumber(image.id),
            image_url: image.imageUrl,
            sort_order: image.sortOrder
        }))
    }))
});

const productInclude = {
    category: true,
    brand: true,
    variants: {
        where: { deletedAt: null },
        orderBy: { id: "desc" },
        include: {
            images: {
                where: { deletedAt: null },
                orderBy: { sortOrder: "asc" }
            }
        }
    }
};

const getAllProducts = async (req, res) => {
    try {
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
        const search = String(req.query.search || "").trim();
        const where = {
            deletedAt: null,
            ...(search ? {
                OR: [
                    { productName: { contains: search, mode: "insensitive" } },
                    { description: { contains: search, mode: "insensitive" } },
                    { urlSlug: { contains: search, mode: "insensitive" } }
                ]
            } : {})
        };

        const [total, products] = await prisma.$transaction([
            prisma.product.count({ where }),
            prisma.product.findMany({
                where,
                include: productInclude,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit
            })
        ]);

        return res.status(200).json({
            success: true,
            products: products.map(mapProduct),
            pagination: { totalItems: total, currentPage: page, totalPages: Math.ceil(total / limit), pageSize: limit }
        });
    } catch (error) {
        console.error("Prisma product fetch error:", error);
        return res.status(500).json({ success: false, message: "Failed to retrieve products." });
    }
};

const getProduct = async (where, res) => {
    try {
        const product = await prisma.product.findFirst({
            where: { ...where, deletedAt: null },
            include: productInclude
        });
        if (!product) return res.status(404).json({ success: false, message: "Product not found." });
        return res.status(200).json({ success: true, product: mapProduct(product) });
    } catch (error) {
        console.error("Prisma product fetch error:", error);
        return res.status(500).json({ success: false, message: "Failed to retrieve product." });
    }
};

const getProductById = (req, res) => getProduct({ id: BigInt(req.params.id) }, res);
const getProductBySlug = (req, res) => getProduct({ urlSlug: req.params.slug }, res);
const getProductsByCategoryId = (req, res) => getProductListByCategory(req, res);

const getProductListByCategory = async (req, res) => {
    try {
        const products = await prisma.product.findMany({
            where: { categoryId: BigInt(req.params.categoryId), deletedAt: null },
            include: productInclude,
            orderBy: { createdAt: "desc" }
        });
        return res.status(200).json({ success: true, count: products.length, products: products.map(mapProduct) });
    } catch (error) {
        console.error("Prisma category product fetch error:", error);
        return res.status(500).json({ success: false, message: "Failed to retrieve category products." });
    }
};

export { getAllProducts, getProductById, getProductBySlug, getProductsByCategoryId };
