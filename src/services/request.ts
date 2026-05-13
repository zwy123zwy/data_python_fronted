import axios from 'axios';
import { message } from 'antd';

const request = axios.create({
  baseURL: '',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor: normalize bare responses into { data: ... } shape
request.interceptors.response.use(
  (response) => {
    // If the backend already wraps with { success, data, message }, keep as-is
    // Otherwise wrap the bare response body into { data: body }
    const body = response.data;
    if (body && typeof body === 'object' && 'success' in body) {
      if (body.success === false) {
        message.error(body.message || '请求失败');
        return Promise.reject(new Error(body.message || '请求失败'));
      }
      return response;
    }
    // Wrap bare response
    return { ...response, data: { data: body } };
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 500) {
        message.error(data?.message || '服务器错误');
      } else if (status !== 401 && status !== 403) {
        message.error(data?.message || `请求错误 (${status})`);
      }
    } else if (error.code === 'ECONNABORTED') {
      message.error('请求超时');
    }
    return Promise.reject(error);
  },
);

export default request;
