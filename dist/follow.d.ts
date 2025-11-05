import { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { SetCookieHeader, CookieRecord } from 'cookie-more';
export interface AxiosFollowOptions {
    maxRedirects?: number;
    throwOnMaxRedirects?: boolean;
    includeResponses?: boolean;
    cookies?: CookiesMap;
}
export interface AxiosFollowInstance extends AxiosInstance {
    follow(config: AxiosRequestConfig, options?: AxiosFollowOptions): Promise<AxiosFollowResponse>;
}
export interface SetCookiesMap {
    [domain: string]: SetCookieHeader[];
}
export interface CookiesMap {
    [domain: string]: CookieRecord;
}
export interface RedirectStep {
    status: number;
    host: string;
    method: string;
    url: string;
    setCookies: CookieRecord;
    cookies: CookieRecord;
    response?: AxiosResponse;
}
export interface AxiosFollowResponse extends AxiosResponse {
    setCookies: SetCookiesMap;
    cookies: CookiesMap;
    followChain: RedirectStep[];
}
export interface AxiosFollowError extends AxiosError {
    setCookies: SetCookiesMap;
    cookies: CookiesMap;
    followChain: RedirectStep[];
}
/** Extended Axios instance with follow method support. */
export declare function addFollowMethod(axiosInstance: AxiosInstance): AxiosFollowInstance;
/** Default values for axiosFollow. */
export declare const axiosFollowDefaults: Required<AxiosFollowOptions>;
/** Performs a request with auto-redirects and cookie management. */
export declare function axiosFollow(axiosInstance: AxiosInstance, config: AxiosRequestConfig, options?: AxiosFollowOptions): Promise<AxiosFollowResponse>;
