import type { ApiResponse } from '@/types';

const BASE = '/api/upload';

export const fileUploadApi = {
  async uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${BASE}/avatar`, {
      method: 'POST',
      body: formData,
    });
    return response.json() as Promise<ApiResponse<{ url: string }>>;
  },
};
