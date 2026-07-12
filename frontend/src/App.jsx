import { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import SplashScreen from './pages/SplashScreen';
import ShutterRevealPage from './pages/ShutterRevealPage';
import AuthGatePage from './pages/AuthGatePage';
import AuthPage from './pages/AuthPage';
import WelcomeBackPage from './pages/WelcomeBackPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import HomePage from './pages/HomePage';
import SearchResultsPage from './pages/SearchResultsPage';
import TitleDetailPage from './pages/TitleDetailPage';
import MyListPage from './pages/MyListPage';
import HistoryPage from './pages/HistoryPage';
import RecommendPage from './pages/RecommendPage';
import TrendingPage from './pages/TrendingPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import ProtectedRoute from './context/ProtectedRoute';
import RouteProgress from './components/RouteProgress';
import { useAuth } from './context/AuthContext';
import { useToast } from './context/ToastContext';

export default function App() {
  const navigate = useNavigate();
  const { logout, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  // Professional API integration: if any request comes back 401 (expired
  // or invalid token), sign the person out and bounce them to the gate
  // instead of leaving them stuck on a broken protected page.
  useEffect(() => {
    function handleUnauthorized() {
      if (isAuthenticated) {
        logout();
        showToast('Your session expired — please sign in again.', 'error');
        navigate('/home');
      }
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [isAuthenticated, logout, navigate, showToast]);

  return (
    <>
      <RouteProgress />
      <Routes>
      <Route path="/" element={<SplashScreen />} />
      <Route path="/reveal" element={<ShutterRevealPage />} />
      <Route path="/welcome" element={<AuthGatePage />} />
      <Route path="/signin" element={<AuthPage />} />
      <Route path="/welcome-back" element={<ProtectedRoute><WelcomeBackPage /></ProtectedRoute>} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* دول Public حسب الكونتراكت - متاحين للزوار كمان، مش لازم تسجيل دخول */}
      <Route path="/home" element={<HomePage />} />
      <Route path="/recommend" element={<RecommendPage />} />
      <Route path="/trending" element={<TrendingPage />} />
      <Route path="/search" element={<SearchResultsPage />} />
      <Route path="/title/:title" element={<TitleDetailPage />} />

      {/* دول محتاجين تسجيل دخول أكيد حسب الكونتراكت (favorites/history) */}
      <Route path="/favorites" element={<ProtectedRoute><MyListPage /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

      <Route path="*" element={<HomePage />} />
      </Routes>
    </>
  );
}
