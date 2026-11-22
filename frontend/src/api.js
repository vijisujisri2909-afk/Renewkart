import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("renewkart_token");
  if (token) config.headers.Authorization = `Token ${token}`;
  return config;
});

export const errorMessage = (error) => {
  if (!error?.response && (error?.code === "ERR_NETWORK" || error?.message === "Network Error")) {
    return "Backend is not running, please restart";
  }
  const data = error?.response?.data;
  if (typeof data?.detail === "string") return data.detail;
  if (data && typeof data === "object") {
    const first = Object.values(data).flat()[0];
    if (typeof first === "string") return first;
  }
  return error?.message || "Something went wrong. Please try again.";
};

export default api;
