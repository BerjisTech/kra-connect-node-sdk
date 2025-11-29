/**
 * @file http-client.ts
 * @description HTTP client with retry logic for KRA-Connect Node.js SDK
 * @module @kra-connect/node
 * @author KRA-Connect Team
 * @created 2025-01-15
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';
import type { KraConfig } from './types';
import {
  ApiAuthenticationError,
  ApiTimeoutError,
  ApiError,
  RateLimitExceededError,
} from './exceptions';
import { ConfigBuilder } from './config';

/**
 * HTTP client for making requests to KRA GavaConnect API.
 *
 * Handles authentication, retries, timeouts, and error handling.
 *
 * @example
 * ```typescript
 * const config = { apiKey: 'test-key' };
 * const client = new HttpClient(config);
 * const response = await client.post('/verify-pin', { pin: 'P051234567A' });
 * ```
 */
export class HttpClient {
  private client: AxiosInstance;
  private config: Required<KraConfig>;

  /**
   * Initialize HTTP client.
   *
   * @param config - KRA configuration object
   *
   * @example
   * ```typescript
   * const config = ConfigBuilder.fromEnv();
   * const client = new HttpClient(config);
   * ```
   */
  constructor(config: Required<KraConfig>) {
    this.config = config;

    // Create axios instance
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: ConfigBuilder.getHeaders(config),
      validateStatus: () => true, // Handle all status codes manually
    });

    // Configure retry logic
    this.setupRetry();

    // Add request/response interceptors
    this.setupInterceptors();
  }

  /**
   * Set up retry logic using axios-retry.
   */
  private setupRetry(): void {
    const retryConfig = this.config.retryConfig;

    axiosRetry(this.client, {
      retries: retryConfig.maxAttempts - 1, // axiosRetry counts retries, not total attempts
      retryDelay: (retryCount: number) => {
        return ConfigBuilder.getRetryDelay(retryConfig, retryCount - 1);
      },
      retryCondition: (error: AxiosError) => {
        // Retry on network errors
        if (axiosRetry.isNetworkError(error)) {
          return true;
        }

        // Retry on timeout if configured
        if (retryConfig.retryOnTimeout && error.code === 'ECONNABORTED') {
          return true;
        }

        // Retry on rate limit if configured
        if (retryConfig.retryOnRateLimit && error.response?.status === 429) {
          return true;
        }

        // Retry on server errors (5xx)
        if (error.response && error.response.status >= 500) {
          return true;
        }

        return false;
      },
      onRetry: (retryCount: number, error: AxiosError, requestConfig: AxiosRequestConfig) => {
        console.warn(
          `Retry attempt ${retryCount} for ${requestConfig.method?.toUpperCase()} ${requestConfig.url}: ${error.message}`
        );
      },
    });
  }

  /**
   * Set up request and response interceptors.
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Log request (in development)
        if (process.env.NODE_ENV === 'development') {
          console.debug(`[HTTP] ${config.method?.toUpperCase()} ${config.url}`);
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        // Log response (in development)
        if (process.env.NODE_ENV === 'development') {
          console.debug(
            `[HTTP] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`
          );
        }
        return response;
      },
      (error) => Promise.reject(error)
    );
  }

  /**
   * Handle API response and raise appropriate exceptions.
   *
   * @param response - Axios response object
   * @param endpoint - API endpoint that was called
   * @returns Parsed JSON response data
   * @throws ApiAuthenticationError, RateLimitExceededError, or ApiError
   */
  private handleResponse<T = any>(response: AxiosResponse, endpoint: string): T {
    // Handle successful responses
    if (response.status === 200 || response.status === 201) {
      return response.data;
    }

    // Handle authentication errors
    if (response.status === 401) {
      throw new ApiAuthenticationError('Invalid API key or authentication failed');
    }

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers['retry-after'] || '60', 10);
      throw new RateLimitExceededError(retryAfter);
    }

    // Handle client errors
    if (response.status >= 400 && response.status < 500) {
      const errorMessage =
        response.data?.message || response.data?.error || `Client error: ${response.status}`;
      throw new ApiError(errorMessage, response.status, response.data);
    }

    // Handle server errors
    if (response.status >= 500) {
      const errorMessage = `Server error: ${response.status}`;
      throw new ApiError(errorMessage, response.status, response.data);
    }

    // Unknown status code
    throw new ApiError(`Unexpected status code: ${response.status}`, response.status);
  }

  /**
   * Handle Axios errors and convert to SDK exceptions.
   *
   * @param error - Axios error object
   * @param endpoint - API endpoint that was called
   * @throws ApiTimeoutError, ApiError, or rethrows the original error
   */
  private handleError(error: AxiosError, endpoint: string): never {
    // Timeout error
    if (error.code === 'ECONNABORTED') {
      throw new ApiTimeoutError(this.config.timeout, endpoint);
    }

    // Network error
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      throw new ApiError(`Network error: ${error.message}`);
    }

    // Response error (already handled in handleResponse)
    if (error.response) {
      return this.handleResponse(error.response, endpoint);
    }

    // Generic error
    throw new ApiError(`HTTP error: ${error.message}`);
  }

  /**
   * Make a GET request to the API.
   *
   * @param endpoint - API endpoint (e.g., "/verify-pin")
   * @param params - Optional query parameters
   * @returns Parsed JSON response
   * @throws ApiAuthenticationError, ApiTimeoutError, or ApiError
   *
   * @example
   * ```typescript
   * const data = await client.get('/taxpayer-details', { pin: 'P051234567A' });
   * ```
   */
  async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<T> {
    try {
      const response = await this.client.get(endpoint, { params });
      return this.handleResponse<T>(response, endpoint);
    } catch (error) {
      return this.handleError(error as AxiosError, endpoint);
    }
  }

  /**
   * Make a POST request to the API.
   *
   * @param endpoint - API endpoint (e.g., "/verify-pin")
   * @param data - Optional request body
   * @returns Parsed JSON response
   * @throws ApiAuthenticationError, ApiTimeoutError, or ApiError
   *
   * @example
   * ```typescript
   * const result = await client.post('/verify-pin', { pin: 'P051234567A' });
   * ```
   */
  async post<T = any>(endpoint: string, data?: Record<string, any>): Promise<T> {
    try {
      const response = await this.client.post(endpoint, data);
      return this.handleResponse<T>(response, endpoint);
    } catch (error) {
      return this.handleError(error as AxiosError, endpoint);
    }
  }

  /**
   * Make a PUT request to the API.
   *
   * @param endpoint - API endpoint
   * @param data - Optional request body
   * @returns Parsed JSON response
   */
  async put<T = any>(endpoint: string, data?: Record<string, any>): Promise<T> {
    try {
      const response = await this.client.put(endpoint, data);
      return this.handleResponse<T>(response, endpoint);
    } catch (error) {
      return this.handleError(error as AxiosError, endpoint);
    }
  }

  /**
   * Make a DELETE request to the API.
   *
   * @param endpoint - API endpoint
   * @returns Parsed JSON response
   */
  async delete<T = any>(endpoint: string): Promise<T> {
    try {
      const response = await this.client.delete(endpoint);
      return this.handleResponse<T>(response, endpoint);
    } catch (error) {
      return this.handleError(error as AxiosError, endpoint);
    }
  }

  /**
   * Make a PATCH request to the API.
   *
   * @param endpoint - API endpoint
   * @param data - Optional request body
   * @returns Parsed JSON response
   */
  async patch<T = any>(endpoint: string, data?: Record<string, any>): Promise<T> {
    try {
      const response = await this.client.patch(endpoint, data);
      return this.handleResponse<T>(response, endpoint);
    } catch (error) {
      return this.handleError(error as AxiosError, endpoint);
    }
  }
}
