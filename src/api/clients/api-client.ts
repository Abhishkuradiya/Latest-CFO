import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

export interface ApiErrorDetails {
  message: string;
  code?: string;
  statusCode?: number;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  public code?: string;
  public statusCode?: number;
  public errors?: Record<string, string[]>;

  constructor(details: ApiErrorDetails) {
    super(details.message);
    this.name = 'ApiError';
    this.code = details.code;
    this.statusCode = details.statusCode;
    this.errors = details.errors;
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
const TIMEOUT = Number(process.env.NEXT_PUBLIC_API_TIMEOUT) || 30000;

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for inserting tokens
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('cfo_auth_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor with retry policy and custom error mapping
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<any>) => {
    const config = error.config as any;

    // Retry policy configuration: max 3 attempts for GET/HEAD, or errors like timeouts/network failures
    if (config && config.method === 'get' && (!config._retryCount || config._retryCount < 3)) {
      config._retryCount = (config._retryCount || 0) + 1;
      const delay = Math.pow(2, config._retryCount) * 1000; // Exponential backoff: 2s, 4s, 8s
      
      await new Promise((resolve) => setTimeout(resolve, delay));
      return apiClient(config);
    }

    // Map error structure to ApiError
    let errorDetails: ApiErrorDetails = {
      message: 'An unexpected connection error occurred.',
    };

    if (error.response) {
      // The request was made and the server responded with a status code
      errorDetails = {
        message: error.response.data?.message || 'Server returned an error.',
        statusCode: error.response.status,
        code: error.response.data?.code || `HTTP_${error.response.status}`,
        errors: error.response.data?.errors,
      };
    } else if (error.request) {
      // The request was made but no response was received
      errorDetails = {
        message: 'No response received from the analytics server. Check your network.',
        code: 'NETWORK_TIMEOUT',
      };
    } else {
      // Something happened in setting up the request that triggered an Error
      errorDetails = {
        message: error.message,
        code: 'REQUEST_SETUP_ERROR',
      };
    }

    return Promise.reject(new ApiError(errorDetails));
  }
);
