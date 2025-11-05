import axios, { AxiosError } from 'axios';
import cookie from 'cookie-more';
/** Extended Axios instance with follow method support. */
export function addFollowMethod(axiosInstance) {
    // add the method
    axiosInstance.follow = (config, options) => {
        return axiosFollow(axiosInstance, config, options);
    };
    return axiosInstance;
}
/** Default values for axiosFollow. */
export const axiosFollowDefaults = {
    maxRedirects: 10,
    throwOnMaxRedirects: true,
    includeResponses: false,
    cookies: {}
};
/** Performs a request with auto-redirects and cookie management. */
export async function axiosFollow(axiosInstance, config, options = {}) {
    const { maxRedirects, includeResponses, throwOnMaxRedirects, cookies: initialCookies } = { ...axiosFollowDefaults, ...options };
    const setCookies = {};
    const cookies = {};
    const followChain = [];
    function attachFollowData({ response, error }) {
        const target = response ?? error;
        if (target) {
            target.cookies = cookies;
            target.setCookies = setCookies;
            target.followChain = followChain;
        }
    }
    try {
        for (const host in initialCookies) {
            cookies[host] = cookie.anyToCookieRecord(initialCookies[host]);
        }
        const firstURL = new URL(config.url || '', config.baseURL || axiosInstance.defaults.baseURL || 'http://x');
        // Determine cookies for the first request
        const Cookie = config.headers?.Cookie || cookies[firstURL.host] && cookie.anyToCookieHeader(cookies[firstURL.host]);
        // For the first request, specify the full path for logic simplification and followChain tracking
        let configNext = { ...config, url: firstURL.href, headers: { ...config.headers, Cookie } };
        let lastAxiosResponse;
        let count = 0;
        redirect: do {
            lastAxiosResponse = await axiosInstance({
                ...configNext,
                maxRedirects: 0,
                validateStatus: (status) => axiosInstance.defaults.validateStatus?.(status) || (status >= 300 && status <= 308),
            });
            const status = lastAxiosResponse.status;
            const host = lastAxiosResponse.request.host;
            const method = lastAxiosResponse.config.method;
            const url = lastAxiosResponse.config.url;
            const setCookiesHeaders = lastAxiosResponse.headers['set-cookie'];
            const setCookiesFlat = setCookiesHeaders ? cookie.anyToCookieRecord(setCookiesHeaders) : {};
            const cookiesHeaders = lastAxiosResponse.config.headers.Cookie;
            const cookiesFlat = cookiesHeaders ? cookie.anyToCookieRecord(cookiesHeaders) : {};
            // update cookie knowledge
            if (cookiesHeaders)
                cookies[host] = { ...cookies[host], ...cookiesFlat };
            if (setCookiesHeaders) {
                setCookies[host] = { ...setCookies[host], ...setCookiesFlat };
                cookies[host] = { ...cookies[host], ...setCookiesFlat };
                for (const name in cookies[host]) {
                    if (cookies[host][name] === 'deleted')
                        delete cookies[host][name];
                }
            }
            const followItem = { status, host, method, url, setCookies: setCookiesFlat, cookies: cookiesFlat };
            if (includeResponses)
                followItem.response = lastAxiosResponse;
            followChain.push(followItem);
            if (lastAxiosResponse.status < 300)
                break redirect;
            if (count++ >= maxRedirects) {
                if (throwOnMaxRedirects) {
                    throw new AxiosError(`maxRedirects reached (${maxRedirects})`, AxiosError.ERR_FR_TOO_MANY_REDIRECTS, lastAxiosResponse.config, lastAxiosResponse.request, lastAxiosResponse);
                }
                else
                    break redirect;
            }
            // prepare redirect request
            const location = lastAxiosResponse.headers.location || '';
            const nextURL = new URL(location, url);
            const Cookie = cookies[nextURL.host] ? cookie.anyToCookieHeader(cookies[nextURL.host]) : undefined;
            const Referer = url;
            configNext = { url: nextURL.href, headers: { Cookie, Referer } };
        } while (true);
        attachFollowData({ response: lastAxiosResponse });
        return lastAxiosResponse;
    }
    catch (error) {
        if (axios.isAxiosError(error)) {
            attachFollowData({ error: error });
        }
        throw error;
    }
}
