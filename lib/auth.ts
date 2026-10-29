import { NextResponse } from 'next/server';

const EXPECTED_API_KEY = process.env.MINIMART_API_KEY || 'minimart_pos_sec_key_2026';

export interface AuthValidationResult {
  authorized: boolean;
  error?: string;
}

/**
 * Validates request authentication headers.
 * Accepts:
 *   - Header 'x-api-key': 'your-api-key'
 *   - Header 'Authorization': 'Bearer your-api-key'
 */
export function validateApiAuth(request: Request): AuthValidationResult {
  // 1. Check x-api-key header
  const apiKeyHeader = request.headers.get('x-api-key');
  if (apiKeyHeader && apiKeyHeader === EXPECTED_API_KEY) {
    return { authorized: true };
  }

  // 2. Check Authorization Bearer header
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      const token = parts[1];
      if (token === EXPECTED_API_KEY) {
        return { authorized: true };
      }
    }
  }

  // 3. In local development or same-origin internal Next.js requests, allow fetch if referer/origin is same host
  const host = request.headers.get('host');
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  if (host && ((origin && origin.includes(host)) || (referer && referer.includes(host)))) {
    return { authorized: true };
  }

  return {
    authorized: false,
    error: 'Unauthorized. Missing or invalid x-api-key or Bearer token header.',
  };
}

export function unauthorizedResponse(reason = 'Unauthorized access to Minimart API') {
  return NextResponse.json(
    {
      success: false,
      error: reason,
      help: 'Include `x-api-key: <YOUR_API_KEY>` or `Authorization: Bearer <YOUR_API_KEY>` in your request headers.',
    },
    { status: 401 }
  );
}

