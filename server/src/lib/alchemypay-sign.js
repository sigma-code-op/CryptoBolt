// ---------------------------------------------------------------------------
// AlchemyPay HMAC-SHA256 request signing. Extracted verbatim from server.js.
// ---------------------------------------------------------------------------

import crypto from 'crypto';
import { ALCHEMYPAY_APP_SECRET } from '../config.js';

// timestamp + httpMethod + requestPath(with sorted, non-empty query params) + bodyString,
// HMAC-SHA256'd with the appSecret and base64-encoded. Identical rule for GET (query-signed)
// and POST (body-signed) endpoints — see docs/api-sign.
export function alchemyPaySign({ timestamp, httpMethod, requestPath, queryParams, bodyObj }) {
  let pathForSig = requestPath;

  if (queryParams && Object.keys(queryParams).length) {
    const sortedQuery = Object.keys(queryParams)
      .filter((k) => queryParams[k] !== undefined && queryParams[k] !== null && queryParams[k] !== '')
      .sort()
      .map((k) => `${k}=${queryParams[k]}`)
      .join('&');
    if (sortedQuery) pathForSig = `${requestPath}?${sortedQuery}`;
  }

  let bodyString = '';
  if (bodyObj && Object.keys(bodyObj).length) {
    const cleaned = {};
    Object.keys(bodyObj)
      .filter((k) => bodyObj[k] !== undefined && bodyObj[k] !== null && bodyObj[k] !== '')
      .sort()
      .forEach((k) => {
        cleaned[k] = bodyObj[k];
      });
    if (Object.keys(cleaned).length) bodyString = JSON.stringify(cleaned);
  }

  const content = `${timestamp}${httpMethod.toUpperCase()}${pathForSig}${bodyString}`;

  return crypto
    .createHmac('sha256', ALCHEMYPAY_APP_SECRET)
    .update(content, 'utf8')
    .digest('base64');
}