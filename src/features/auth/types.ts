export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * What POST /api/admin/auth/login returns. Note it is only the token — unlike
 * the legacy .NET login, there is no user object and no company selector,
 * because the company is bound to the user server-side and travels as the `cid`
 * claim. Everything the UI shows about "who am I" is read back out of the token.
 */
export interface TokenResponse {
  accessToken: string;
}
