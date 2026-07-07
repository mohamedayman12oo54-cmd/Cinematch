import { useEffect, useState } from 'react';

export default function TypewriterHeadline({ text = 'What do you want to watch today?', onDone, className = 'ai-hero__headline', cursorClassName = 'ai-hero__cursor' }) {
  const [shown, setShown] = useState('');

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        onDone?.();
      }
    }, 38);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <h1 className={className}>
      {shown}
      <span className={cursorClassName} />
    </h1>
  );
}
