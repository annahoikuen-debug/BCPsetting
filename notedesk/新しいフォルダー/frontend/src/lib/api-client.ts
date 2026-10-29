import axios from 'axios';

/**
 * Backend Standard Response Types
 */
export interface ResponseMetadata {
    request_id?: string;
    timestamp: string;
}

export interface ErrorDetail {
    code: string;
    message: string;
    detail?: string;
    suggestion?: string;
}

export interface StandardResponse<T = any> {
    success: boolean;
    data: T | null;
    error: ErrorDetail | null;
    metadata: ResponseMetadata;
}

const apiClient = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
});

apiClient.interceptors.request.use((config) => {
    const apiKey = sessionStorage.getItem('app_api_key');
    if (apiKey) {
        config.headers['X-API-Key'] = apiKey;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

/**
 * Custom Error class for API errors to carry structured data
 */
export class ApiError extends Error {
    code: string;
    detail?: string;
    suggestion?: string;
    requestId?: string;

    constructor(message: string, code: string, detail?: string, suggestion?: string, requestId?: string) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
        this.detail = detail;
        this.suggestion = suggestion;
        this.requestId = requestId;
    }
}

/**
 * Response interceptor to handle StandardResponse format.
 */
apiClient.interceptors.response.use(
    (response) => {
        const res = response.data as StandardResponse;
        
        if (res && typeof res === 'object' && 'success' in res) {
            if (res.success) {
                return res.data; 
            } else {
                return Promise.reject(
                    new ApiError(
                        res.error?.message || 'An unknown error occurred',
                        res.error?.code || 'UNKNOWN_ERROR',
                        res.error?.detail,
                        res.error?.suggestion,
                        res.metadata?.request_id
                    )
                );
            }
        }
        return response.data;
    },
    (error) => {
        if (error.response && error.response.data) {
            const res = error.response.data as StandardResponse;
            if (res && res.success === false) {
                return Promise.reject(
                    new ApiError(
                        res.error?.message || 'API Error',
                        res.error?.code || 'API_ERROR',
                        res.error?.detail,
                        res.error?.suggestion,
                        res.metadata?.request_id
                    )
                );
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;
