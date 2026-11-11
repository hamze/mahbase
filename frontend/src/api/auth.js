import { api, getRefreshToken, setTokens } from '@/api/client';

/** Text a login code; resolves ``{expires_in, resend_in}`` (seconds). */
export const requestLoginCode = (mobile) => api.post('/auth/otp/request/', { mobile }, { auth: false });

/** Verify the code (creates the customer on first login); stores the tokens. The guest cart is merged server-side. */
export async function verifyLoginCode(mobile, code) {
  setTokens(await api.post('/auth/otp/verify/', { mobile, code }, { auth: false }));
}

export const getMe = () => api.get('/auth/me/');
export const updateMe = (changes) => api.patch('/auth/me/', changes);

export async function logout() {
  const refresh = getRefreshToken();
  setTokens(null);
  if (refresh) await api.post('/auth/logout/', { refresh }, { auth: false }).catch(() => {});
}

/** Mobile change: codes go to the current and the new number; both are needed to confirm. */
export const requestMobileChange = (newMobile) => api.post('/auth/mobile/change/request/', { new_mobile: newMobile });
export const confirmMobileChange = (newMobile, oldCode, newCode) =>
  api.post('/auth/mobile/change/confirm/', { new_mobile: newMobile, old_code: oldCode, new_code: newCode });
