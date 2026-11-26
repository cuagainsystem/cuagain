import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/navigation/AppLayout';
import { DesignSystemPage } from './pages/design-system/DesignSystemPage';
import { HomePage } from './pages/landing/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ROUTES } from './utils/routes';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path={ROUTES.home} element={<HomePage />} />
        <Route path={ROUTES.designSystem} element={<DesignSystemPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
