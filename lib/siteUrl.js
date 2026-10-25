// The public address of the live app, for links that leave the app (e.g. the
// sign-up link inside an invite email). window.location would give
// http://localhost:3000 when the email is sent from a laptop, which the
// recipient can't open. Override with NEXT_PUBLIC_SITE_URL for another deployment.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://bh-360.vercel.app').replace(/\/+$/, '')
