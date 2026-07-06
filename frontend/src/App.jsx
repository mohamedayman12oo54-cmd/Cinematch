import { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import SplashScreen from './pages/SplashScreen';
import AuthGatePage from './pages/AuthGatePage';
import AuthPage from './pages/AuthPage';
import WelcomeBackPage from './pages/WelcomeBackPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import HomePage from './pages/HomePage';
import SearchResultsPage from './pages/SearchResultsPage';
import TitleDetailPage from './pages/TitleDetailPage';
import FavoritesPage from './pages/FavoritesPage';
import HistoryPage from './pages/HistoryPage';
import RecommendPage from './pages/RecommendPage';
import TrendingPage from './pages/TrendingPage';
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
        navigate('/welcome');
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
      <Route path="/welcome" element={<AuthGatePage />} />
      <Route path="/signin" element={<AuthPage />} />
      <Route path="/welcome-back" element={<ProtectedRoute><WelcomeBackPage /></ProtectedRoute>} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route path="/home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/recommend" element={<ProtectedRoute><RecommendPage /></ProtectedRoute>} />
      <Route path="/trending" element={<ProtectedRoute><TrendingPage /></ProtectedRoute>} />
      <Route path="/search" element={<ProtectedRoute><SearchResultsPage /></ProtectedRoute>} />
      <Route path="/title/:title" element={<ProtectedRoute><TitleDetailPage /></ProtectedRoute>} />
      <Route path="/favorites" element={<ProtectedRoute><FavoritesPage /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />

      <Route path="*" element={<AuthPage />} />
      </Routes>
    </>
  );
}
