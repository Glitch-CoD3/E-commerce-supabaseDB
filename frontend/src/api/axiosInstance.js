import axios from "axios";
import axiosRetry from "axios-retry";

const AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Configure automatic retry behavior
axiosRetry(AxiosInstance, {
  retries: 3,

  retryCondition: (error) => {
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      error.response?.status === 429
    );
  },

  retryDelay: (retryCount, error) => {
    const retryAfter = error.response?.headers["retry-after"];

    if (retryAfter) {
      return parseInt(retryAfter, 10) * 1000;
    }

    return axiosRetry.exponentialDelay(retryCount);
  },
});

// Response interceptor
AxiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 429) {
      console.warn(
        "Rate limit reached. Request was retried or rejected."
      );
    }

    return Promise.reject(error);
  }
);

export default AxiosInstance;