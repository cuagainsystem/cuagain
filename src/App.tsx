import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AdminRoute } from './components/auth/AdminRoute';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppLayout } from './components/navigation/AppLayout';
import { HomePage } from './pages/landing/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ROUTES } from './utils/routes';

/*
  Pages other than the landing page load on demand, so a first-time visitor
  does not download code for screens they may never open.
*/
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const VerifyEmailPage = lazy(() => import('./pages/auth/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })));
const ForgotPasswordPage = lazy(() =>
  import('./pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import('./pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })),
);
const PortalPage = lazy(() => import('./pages/portal/PortalPage').then((m) => ({ default: m.PortalPage })));
const BrowsePage = lazy(() => import('./pages/reports/BrowsePage').then((m) => ({ default: m.BrowsePage })));
const ClaimFormPage = lazy(() => import('./pages/claims/ClaimFormPage').then((m) => ({ default: m.ClaimFormPage })));
const ClaimDetailPage = lazy(() => import('./pages/claims/ClaimDetailPage').then((m) => ({ default: m.ClaimDetailPage })));
const AdminClaimDetailPage = lazy(() => import('./pages/claims/ClaimDetailPage').then((m) => ({ default: m.AdminClaimDetailPage })));
const MyClaimsPage = lazy(() => import('./pages/claims/MyClaimsPage').then((m) => ({ default: m.MyClaimsPage })));
const AdminClaimsPage = lazy(() => import('./pages/admin/AdminClaimsPage').then((m) => ({ default: m.AdminClaimsPage })));
const MyReportsPage = lazy(() => import('./pages/reports/MyReportsPage').then((m) => ({ default: m.MyReportsPage })));
const NewReportPage = lazy(() => import('./pages/reports/ReportFormPage').then((m) => ({ default: m.NewReportPage })));
const EditReportPage = lazy(() => import('./pages/reports/ReportFormPage').then((m) => ({ default: m.EditReportPage })));
const ReportDetailPage = lazy(() =>
  import('./pages/reports/ReportDetailPage').then((m) => ({ default: m.ReportDetailPage })),
);
const DesignSystemPage = lazy(() =>
  import('./pages/design-system/DesignSystemPage').then((m) => ({ default: m.DesignSystemPage })),
);

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Public pages */}
        <Route path={ROUTES.home} element={<HomePage />} />
        <Route path={ROUTES.designSystem} element={<DesignSystemPage />} />

        {/* Account pages */}
        <Route path={ROUTES.login} element={<LoginPage />} />
        <Route path={ROUTES.register} element={<RegisterPage />} />
        <Route path={ROUTES.verifyEmail} element={<VerifyEmailPage />} />
        <Route path={ROUTES.forgotPassword} element={<ForgotPasswordPage />} />
        <Route path={ROUTES.resetPassword} element={<ResetPasswordPage />} />

        {/* Signed-in pages */}
        <Route element={<ProtectedRoute />}>
          <Route path={ROUTES.portal} element={<PortalPage />} />
          <Route path={ROUTES.reports} element={<BrowsePage />} />
          <Route path={ROUTES.myReports} element={<MyReportsPage />} />
          <Route path="/reports/new/:type" element={<NewReportPage />} />
          <Route path="/reports/:id/edit" element={<EditReportPage />} />
          <Route path="/reports/:id/claim" element={<ClaimFormPage />} />
          <Route path="/reports/:id" element={<ReportDetailPage />} />
          <Route path={ROUTES.myClaims} element={<MyClaimsPage />} />
          <Route path="/claims/:id" element={<ClaimDetailPage />} />
          <Route element={<AdminRoute />}>
            <Route path={ROUTES.adminClaims} element={<AdminClaimsPage />} />
            <Route path="/admin/claims/:id" element={<AdminClaimDetailPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
