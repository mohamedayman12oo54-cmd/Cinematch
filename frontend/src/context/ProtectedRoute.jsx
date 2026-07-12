import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, checkingSession } = useAuth();

  // حالة نادرة: فيه توكن متخزن بس لسه بنتحقق منه ومفيش بيانات مستخدم
  // محفوظة نبني عليها - استنى بدل ما تطرده لصفحة اللوجين غلط
  if (checkingSession && !isAuthenticated && localStorage.getItem('cinematch_token')) {
    return null;
  }

  // محتاج حساب عشان تدخل الصفحة دي (My List, History, Dashboard, Settings)
  // -> وديه على طول لصفحة تسجيل الدخول، مش لصفحة الترحيب
  if (!isAuthenticated) return <Navigate to="/signin" state={{ mode: 'login' }} replace />;
  return children;
}
