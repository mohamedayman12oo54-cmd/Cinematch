import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AuthPage.css'; // بيستخدم نفس كلاسات الـ shutter الموجودة هناك

export default function ShutterRevealPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // نفس توقيت أنيميشن الـ shutter (~2.2 ثانية) وبعدها كمّل للهوم
    const t = setTimeout(() => navigate('/home'), 2200);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="nf-page" style={{ background: '#000' }}>
      <div className="nf-shutter nf-shutter--play" aria-hidden="true">
        <div className="nf-shutter__bar nf-shutter__bar--top" />
        <div className="nf-shutter__bar nf-shutter__bar--bottom" />
        <div className="nf-shutter__brand"><span>CINEMATCH</span></div>
      </div>
    </div>
  );
}
