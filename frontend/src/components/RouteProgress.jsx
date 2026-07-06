import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/** Thin top-of-page progress bar that pulses briefly on every route change. */
export default function RouteProgress() {
  const location = useLocation();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(true);
    const timer = setTimeout(() => setActive(false), 500);
    return () => clearTimeout(timer);
  }, [location.pathname, location.search]);

  if (!active) return null;
  return <div className="route-progress" />;
}
