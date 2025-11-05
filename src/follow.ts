import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'
import cookie, { SetCookieHeader, CookieRecord } from 'cookie-more'

export interface AxiosFollowOptions {
    maxRedirects?: number
    throwOnMaxRedirects?: boolean
    includeResponses?: boolean
    cookies?: CookiesMap
}

export interface AxiosFollowInstance extends AxiosInstance {
    follow(config: AxiosRequestConfig, options?: AxiosFollowOptions): Promise<AxiosFollowResponse>
}

export interface SetCookiesMap {
    [domain: string]: SetCookieHeader[]
}

export interface CookiesMap {
    [domain: string]: CookieRecord
}

export interface RedirectStep {
    status: number
    host: string
    method: string
    url: string
    setCookies: CookieRecord
    cookies: CookieRecord
    response?: AxiosResponse
}

export interface AxiosFollowResponse extends AxiosResponse {
    setCookies: SetCookiesMap
    cookies: CookiesMap
    followChain: RedirectStep[]
}

export interface AxiosFollowError extends AxiosError {
    setCookies: SetCookiesMap
    cookies: CookiesMap
    followChain: RedirectStep[]
}

/** Extended Axios instance with follow method support. */
export function addFollowMethod(axiosInstance: AxiosInstance) {
    // add the method
    (axiosInstance as any).follow = (config: AxiosRequestConfig, options?: AxiosFollowOptions) => {
        return axiosFollow(axiosInstance, config, options)
    }
    return axiosInstance as AxiosFollowInstance
}

/** Default values for axiosFollow. */
export const axiosFollowDefaults: Required<AxiosFollowOptions> = {
    maxRedirects: 10,
    throwOnMaxRedirects: true,
    includeResponses: false,
    cookies: {}
}

/** Performs a request with auto-redirects and cookie management. */
export async function axiosFollow(axiosInstance: AxiosInstance, config: AxiosRequestConfig, options: AxiosFollowOptions = {}): Promise<AxiosFollowResponse> {
    const { maxRedirects, includeResponses, throwOnMaxRedirects, cookies: initialCookies } = { ...axiosFollowDefaults, ...options }

    const setCookies: SetCookiesMap = {}
    const cookies: CookiesMap = {}
    const followChain: RedirectStep[] = []

    function attachFollowData({ response, error }: { response?: AxiosResponse; error?: AxiosError }) {
        const target = response as AxiosFollowResponse ?? error as AxiosFollowError;
        if (target) {
            target.cookies = cookies;
            target.setCookies = setCookies;
            target.followChain = followChain;
        }
    }

    try {
        for (const host in initialCookies) {
            cookies[host] = cookie.anyToCookieRecord(initialCookies[host])
        }

        const firstURL = new URL(config.url || '', config.baseURL || axiosInstance.defaults.baseURL || 'http://x')
        // Determine cookies for the first request
        const Cookie = config.headers?.Cookie || cookies[firstURL.host] && cookie.anyToCookieHeader(cookies[firstURL.host]);
        // For the first request, specify the full path for logic simplification and followChain tracking
        let configNext: AxiosRequestConfig = { ...config, url: firstURL.href, headers: { ...config.headers, Cookie } }
        let lastAxiosResponse: AxiosResponse
        let count = 0

        redirect: do {
            lastAxiosResponse = await axiosInstance({
                ...configNext,
                maxRedirects: 0,
                validateStatus: (status: number) => axiosInstance.defaults.validateStatus?.(status) || (status >= 300 && status <= 308),
            })

            const status = lastAxiosResponse.status
            const host = lastAxiosResponse.request.host
            const method = lastAxiosResponse.config.method!
            const url = lastAxiosResponse.config.url!

            const setCookiesHeaders = lastAxiosResponse.headers['set-cookie']
            const setCookiesFlat = setCookiesHeaders ? cookie.anyToCookieRecord(setCookiesHeaders) : {}

            const cookiesHeaders = lastAxiosResponse.config.headers.Cookie
            const cookiesFlat = cookiesHeaders ? cookie.anyToCookieRecord(cookiesHeaders) : {}

            // update cookie knowledge
            if (cookiesHeaders) cookies[host] = { ...cookies[host], ...cookiesFlat }
            if (setCookiesHeaders) {
                setCookies[host] = { ...setCookies[host], ...setCookiesFlat }
                cookies[host] = { ...cookies[host], ...setCookiesFlat }
                for (const name in cookies[host]) {
                    if (cookies[host][name] === 'deleted') delete cookies[host][name]
                }
            }

            const followItem: RedirectStep = { status, host, method, url, setCookies: setCookiesFlat, cookies: cookiesFlat }
            if (includeResponses) followItem.response = lastAxiosResponse
            followChain.push(followItem)

            if (lastAxiosResponse.status < 300) break redirect

            if (count++ >= maxRedirects) {
                if (throwOnMaxRedirects) {
                    throw new AxiosError(`maxRedirects reached (${maxRedirects})`, AxiosError.ERR_FR_TOO_MANY_REDIRECTS, lastAxiosResponse.config, lastAxiosResponse.request, lastAxiosResponse)
                } else break redirect
            }

            // prepare redirect request
            const location = lastAxiosResponse.headers.location || ''
            const nextURL = new URL(location, url)

            const Cookie = cookies[nextURL.host] ? cookie.anyToCookieHeader(cookies[nextURL.host]) : undefined
            const Referer = url
            configNext = { url: nextURL.href, headers: { Cookie, Referer } }
        } while (true)

        attachFollowData({ response: lastAxiosResponse })
        return lastAxiosResponse as AxiosFollowResponse
    } catch (error) {
        if (axios.isAxiosError(error)) {
            attachFollowData({ error: error })
        }
        throw error
    }
}