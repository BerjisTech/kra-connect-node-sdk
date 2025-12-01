/**
 * @file http-client.ts
 * @description HTTP client with retry logic for KRA-Connect Node.js SDK
 * @module @kra-connect/node
 * @author KRA-Connect Team
 * @created 2025-01-15
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';
import type { KraConfig, ResponseMetadata } from './types';
import {
  ApiAuthenticationError,
  ApiTimeoutError,
  ApiError,
  RateLimitExceededError,
} from './exceptions';
import { ConfigBuilder, NormalizedKraConfig } from './config';

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
interface ApiEnvelope<T> {
  data: T;
  metadata: ResponseMetadata;
  raw: Record<string, unknown>;
}

export class HttpClient {
  private client: AxiosInstance;
  private config: NormalizedKraConfig;
  private accessToken?: string;
  private tokenExpiry = 0;
  private tokenRequest?: Promise<string>;

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
  constructor(config: NormalizedKraConfig) {
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
      async (config) => {
        if (process.env.NODE_ENV === 'development') {
          console.debug(`[HTTP] ${config.method?.toUpperCase()} ${config.url}`);
        }
        const headers = config.headers ?? {};
        headers.Authorization = `Bearer ${await this.getAccessToken()}`;
        config.headers = headers;
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
  private handleResponse<T = any>(response: AxiosResponse, endpoint: string): ApiEnvelope<T> {
    if (response.status === 200 || response.status === 201) {
      return this.normalizeResponse<T>(response, endpoint);
    }
    return this.processErrorResponse(response, endpoint);
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

    if (error.response) {
      return this.processErrorResponse(error.response, endpoint);
    }

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
  async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<ApiEnvelope<T>> {
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
  async post<T = any>(endpoint: string, data?: Record<string, any>): Promise<ApiEnvelope<T>> {
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
  async put<T = any>(endpoint: string, data?: Record<string, any>): Promise<ApiEnvelope<T>> {
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
  async delete<T = any>(endpoint: string): Promise<ApiEnvelope<T>> {
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
  async patch<T = any>(endpoint: string, data?: Record<string, any>): Promise<ApiEnvelope<T>> {
    try {
      const response = await this.client.patch(endpoint, data);
      return this.handleResponse<T>(response, endpoint);
    } catch (error) {
      return this.handleError(error as AxiosError, endpoint);
    }
  }

  private async getAccessToken(): Promise<string> {
    if (this.config.apiKey) {
      return this.config.apiKey;
    }

    if (!this.config.clientId || !this.config.clientSecret) {
      throw new ApiAuthenticationError('OAuth client credentials are not configured');
    }

    const now = Date.now();
    if (this.accessToken && now < this.tokenExpiry - 30000) {
      return this.accessToken;
    }

    if (!this.tokenRequest) {
      this.tokenRequest = this.fetchAccessToken().finally(() => {
        this.tokenRequest = undefined;
      });
    }

    return this.tokenRequest;
  }

  private async fetchAccessToken(): Promise<string> {
    const basic = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
    const resp = await axios.get(this.config.tokenUrl, {
      headers: {
        Authorization: `Basic ${basic}`,
        Accept: 'application/json',
      },
      timeout: this.config.timeout,
    });

    if (resp.status !== 200) {
      throw new ApiAuthenticationError('Failed to obtain access token');
    }

    const token = resp.data?.access_token;
    if (!token) {
      throw new ApiAuthenticationError('Token response missing access_token');
    }

    const expiresIn = this.getExpiresInSeconds(resp.data?.expires_in);
    this.accessToken = token;
    this.tokenExpiry = Date.now() + expiresIn * 1000;
    return token;
  }

  private getExpiresInSeconds(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseInt(value, 10);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    return 3600;
  }

  private processErrorResponse(response: AxiosResponse, endpoint: string): never {
    if (response.status === 401) {
      throw new ApiAuthenticationError('Invalid credentials or authentication failed');
    }
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers['retry-after'] || '60', 10);
      throw new RateLimitExceededError(retryAfter);
    }

    const message =
      firstString(response.data, 'ErrorMessage', 'errorMessage', 'message', 'responseDesc') ||
      `HTTP error: ${response.status}`;

    throw new ApiError(message, response.status, response.data);
  }

  private normalizeResponse<T>(response: AxiosResponse, endpoint: string): ApiEnvelope<T> {
    const payload = response.data ?? {};
    const responseCode = firstString(payload, 'responseCode', 'ResponseCode');
    const statusText = firstString(payload, 'status', 'Status');
    const success = typeof payload.success === 'boolean' ? payload.success : undefined;
    const errorCode = firstString(payload, 'ErrorCode', 'errorCode', 'code');

    const isError =
      (responseCode && responseCode !== '70000') ||
      (statusText && statusText.toLowerCase().startsWith('error')) ||
      errorCode ||
      success === false;

    if (isError) {
      const message =
        firstString(payload, 'ErrorMessage', 'errorMessage', 'message', 'responseDesc') ||
        `API request failed for ${endpoint}`;
      throw new ApiError(message, response.status, payload);
    }

    const data = payload.responseData ?? payload.data ?? payload;
    const metadata: ResponseMetadata = {
      responseCode: responseCode || '70000',
      responseDesc: firstString(payload, 'responseDesc', 'ResponseDesc'),
      status: statusText,
      errorCode,
      errorMessage: firstString(payload, 'ErrorMessage', 'errorMessage'),
      requestId: firstString(payload, 'requestId', 'RequestId'),
    };

    return {
      data: data as T,
      metadata,
      raw: payload,
    };
  }
}

function firstString(source: any, ...keys: string[]): string | undefined {
  if (!source || typeof source !== 'object') {
    return undefined;
  }
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}
