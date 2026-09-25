import AxiosInstance from "../api/axiosInstance";

export const signupUser = async (data) => {
  const response = await AxiosInstance.post("/auth/register", data);
  return response.data;
};


export const signin_User = async (data) => {
  const response = await AxiosInstance.post("/auth/login", data);
  return response.data;
};


export const submitOtp = async (data) => {
  const response = await AxiosInstance.post("/auth/email-verify", data);
  return response.data;
};


export const resendOtp = async (data) => {
  const response = await AxiosInstance.post("/auth/resend-otp", data);
  return response.data;
};


