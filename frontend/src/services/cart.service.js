import AxiosInstance from "../api/axiosInstance.js";



// ==========================================
// CART SERVICE API CALLS
// ==========================================

// 1. Add To Cart
export const addToCart = async (data) => {
  const response = await AxiosInstance.post("/cart", data);
  return response.data;
};

// 2. Get All Carts
export const getAllCarts = async () => {
  const response = await AxiosInstance.get("/cart");
  console.log("Get All Carts Response:", response.data);
  return response.data;
};

// 3. Get Cart Item By ID
export const getCartItemById = async (id) => {
  const response = await AxiosInstance.get(`/cart/${id}`);
  return response.data;
};

// 4. Update Cart Quantity
export const updateCartQuantity = async (id, data) => {
  const response = await AxiosInstance.patch(
    `/cart/${id}`,
    data
  );
  return response.data;
};

// 5. Remove Cart Item
export const removeCartItem = async (id) => {
  const response = await AxiosInstance.delete(`/cart/${id}`);
  return response.data;
};

// 6. Clear Cart
export const clearCart = async () => {
  const response = await AxiosInstance.delete("/cart");
  return response.data;
};


//7 Cart count
export const getCartCount = async () => {
  const response = await AxiosInstance.get("/cart/count");

  return response.data;
};

// 8. Fetch All Carts
export const FetchCart = async () => {
  const response = await AxiosInstance.get("/cart/details");
  return response.data;
};