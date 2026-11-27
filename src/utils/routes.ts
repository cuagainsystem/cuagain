/** Central list of route paths so links and routes never drift apart. */
export const ROUTES = {
  home: '/',
  designSystem: '/design-system',
  login: '/login',
  register: '/register',
  verifyEmail: '/verify-email',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  portal: '/portal',
} as const;

/** In-page sections of the landing page. Links to them go through the home route. */
export const HOME_SECTIONS = {
  purpose: '/#purpose',
  howItWorks: '/#how-it-works',
  guidelines: '/#guidelines',
  claiming: '/#claiming',
  faqs: '/#faqs',
} as const;
