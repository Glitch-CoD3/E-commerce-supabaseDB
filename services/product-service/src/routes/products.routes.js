import express from "express";

import {
    createProduct,
    getAllProducts,
    getProductById,
    getProductBySlug,
    updateProduct,
    updateProductStatus,
    deleteProduct,
    getProductsByCategoryId,
    getAllDeletedProducts,
} from "../controllers/products.controller.js";

import { verifyJWT } from "../middlewares/auth.middleware.js";
import { ROLES } from "../constants.js";
import { allowRoles } from "../middlewares/authorize.middleware.js";
import { validateFilterQueryParams } from "../utils/validateFilterQueryParams.js";


const router = express.Router();


/**
 * @method GET /api/v1/products
 * @description Get all products with optional filters (minPrice, maxPrice, category, etc.)
 * @access Public
 */
router.get("/", validateFilterQueryParams, getAllProducts);




/**
 * @method GET /api/v1/products/category/:categoryId
 * @description Get all products by category ID
 * @access Public
 */
router.get("/category/:categoryId", getProductsByCategoryId);

/**
 * @method GET /api/v1/products/slug/:slug
 * @description Get a product by its slug
 * @access Public
 */
router.get("/slug/:slug", getProductBySlug);



/**
 * @method GET /api/v1/products/deleted
 * @description Get all soft-deleted products
 * @access Private (Admin)
 */
router.get(
    "/deleted", verifyJWT,
    allowRoles(ROLES.ADMIN),
    getAllDeletedProducts
);

/**
 * @method GET /api/v1/products/:id
 * @description Get a product by its ID
 * @access Public
 */
router.get("/:id", getProductById);


// =======================
// Admin Routes
// =======================

/**
 * @middleware allowRoles(ROLES.ADMIN)
 * @description All routes below are accessible only by administrators.
 */
router.use(allowRoles(ROLES.ADMIN));
router.use(verifyJWT);
/**
 * @method POST /api/v1/products
 * @description Create a new product
 * @access Private (Admin)
 */
router.post("/", createProduct);

/**
 * @method PUT /api/v1/products/:id
 * @description Update an existing product
 * @access Private (Admin)
 */
router.patch("/:id", updateProduct);

/**
 * @method PATCH /api/v1/products/:id/status
 * @description Update product status
 * @access Private (Admin)
 */
router.patch("/:id/status", updateProductStatus);

/**
 * @method DELETE /api/v1/products/:id
 * @description Soft delete a product
 * @access Private (Admin)
 */
router.delete("/:id", deleteProduct);

export default router;