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
  reports: '/reports',
  myReports: '/my-reports',
  myClaims: '/claims',
  adminClaims: '/admin/claims',
  adminAbuse: '/admin/abuse',
  notifications: '/notifications',
  messages: '/messages',
  community: '/community',
} as const;

/** Routes that need an id or a type are built with these helpers. */
export const reportRoutes = {
  newReport: (type: 'lost' | 'found') => `/reports/new/${type}`,
  detail: (id: string) => `/reports/${id}`,
  edit: (id: string) => `/reports/${id}/edit`,
  claim: (id: string) => `/reports/${id}/claim`,
};

export const claimRoutes = {
  detail: (id: string) => `/claims/${id}`,
  adminDetail: (id: string) => `/admin/claims/${id}`,
};

/** In-page sections of the landing page. Links to them go through the home route. */
export const HOME_SECTIONS = {
  purpose: '/#purpose',
  howItWorks: '/#how-it-works',
  guidelines: '/#guidelines',
  claiming: '/#claiming',
  faqs: '/#faqs',
} as const;

export const messageRoutes = {
  thread: (id: string) => `/messages/${id}`,
  requests: '/messages?tab=requests',
};
