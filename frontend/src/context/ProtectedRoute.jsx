import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, checkingSession } = useAuth();

  // حالة نادرة: فيه توكن متخزن بس لسه بنتحقق منه ومفيش بيانات مستخدم
  // محفوظة نبني عليها - استنى بدل ما تطرده لصفحة اللوجين غلط
  if (checkingSession && !isAuthenticated && localStorage.getItem('cinematch_token')) {
    return null;
  }

  if (!isAuthenticated) return <Navigate to="/welcome" replace />;
  return children;
}
