import axios from 'axios';
import toast from 'react-hot-toast';
import { clearAuthStorage, getAccessToken } from './lib/storage';

const api = axios.create({
  baseURL: '/api'
});

api.interceptors.request.use(config => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  response => {
    if (response.data.code && response.data.code !== 200) {
      toast.error(response.data.msg || 'Error occurred');
      return Promise.reject(response.data.msg);
    }
    return response;
  },
  error => {
    const status = error.response?.status;
    const skipAuthRedirect = Boolean(error.config?.skipAuthRedirect);
    const responseData = error.response?.data;
    const serverMsg = typeof responseData === 'string'
      ? responseData
      : responseData?.msg;

    if (error.response?.status === 401) {
      clearAuthStorage();
      if (skipAuthRedirect) {
        return Promise.reject(error);
      }
      toast.error('未登录或登录已过期，请重新登录');
      setTimeout(() => {
        window.location.href = '/auth';
      }, 500);
    } else if (status === 403) {
      toast.error('权限不足');
    } else if (status === 413) {
      toast.error('上传内容过大，请更换更小文件或联系管理员调整网关限制');
    } else {
      toast.error(serverMsg || '网络异常，请重试');
    }
    return Promise.reject(error);
  }
);

export default api;
