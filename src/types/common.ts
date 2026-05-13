/** Generic API response wrapper */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

/** Paginated API response */
export interface PageResponse<T = unknown> extends ApiResponse<T> {
  total: number;
  pageNum: number;
  pageSize: number;
  totalPages: number;
}

/** Paginated result from backend */
export interface PageResult<T> {
  success: boolean;
  data: T[];
  total: number;
  pageNum: number;
  pageSize: number;
  totalPages: number;
}
