import AxiosInstance from '../api/axiosInstance';


// Create category API call
export const createCategory = async (data) => {
  const response = await AxiosInstance.post("/categories", data);
  console.log("Created category", response.data)
  return response.data;
};

// Get all Categories API call
export const getCategories = async () => {
  const response = await AxiosInstance.get("/categories/");
  return response.data;
};

// Get category by category ID API call
export const getCategoryById = async (id) => {
  const response = await AxiosInstance.get(`/categories/${id}`);
  return response.data;
};


// 4. Update Category
export const updateCategory = async () => {
  const response = await AxiosInstance.patch(`/categories/${id}`, data);
  return response.data;
};

// 5. Delete Category
export const deleteCategory = async (id) => {
  const response = await AxiosInstance.delete(`/categories/${id}`);
  return response.data;
};


//-------------------------------//
//PRODUCTS API CALLS
//-------------------------------//

//Create product API call
export const createProduct = async (data) => {
  const response = await AxiosInstance.post("/products", data);
  return response.data;
};

// Get all Products API call
export const getAllProducts = async (page = 1, perPage = 10) => {

  const response = await AxiosInstance.get("/products/", {
    params: {
      page,
      per_page: perPage,
    },
  });
  return response.data;
};


//Get Top Selling Products API call
export const getTopSellingProducts = async (page= 1, perPage= 10) => {
  const response = await AxiosInstance.get("/products/top-selling");
  return response.data;
};


//get product by varient id
export const getProductByVarientId = async (id) => {
  const response = await AxiosInstance.get(`/product-variants/${id}`);
  return response.data;
};

export const getVariantImageById = async (id) => {
  const response = await AxiosInstance.get(`/product-variants-image/${id}`);
  return response.data;
};

//get product by product Id
export const getProductById = async (id) => {
  const response = await AxiosInstance.get(`/products/${id}`);
  return response.data;
}

//-------------------------------//
//PRODUCTS Brands API CALLS
//-------------------------------//

// Get all Brands API call
export const getAllBrands = async (page = 1, perPage = 10) => {
  const response = await AxiosInstance.get("/brands", {
    params: {
      page,
      per_page: perPage,
    },
  });
  return response.data;
};

// 2. Create Brand
export const createBrand = async (data) => {
  const response = await AxiosInstance.post("/brands", data);
  return response.data;
};

// 3. Update Brand
export const updateBrand = async (id, data) => {
  const response = await AxiosInstance.patch(`/brands/${id}`, data);
  return response.data;
};

// 4. Delete Brand
export const deleteBrand = async (id) => {
  const response = await AxiosInstance.delete(`/brands/${id}`);
  return response.data;
};



