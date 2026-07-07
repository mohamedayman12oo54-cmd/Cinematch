import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

const subtitleText = 'Content Recommendation Engine';

export const Subtitle = ({ scene, isExiting }) => {
  const [typewriterText, setTypewriterText] = useState('');
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    if (scene >= 6) {
      let index = 0;
      const interval = setInterval(() => {
        if (index < subtitleText.length) {
          setTypewriterText(subtitleText.slice(0, index + 1));
          index++;
        } else {
          clearInterval(interval);
          // Start blinking cursor after typing finishes
          let blinkCount = 0;
          const blinkInterval = setInterval(() => {
            blinkCount++;
            if (blinkCount >= 4) {
              setShowCursor(false);
              clearInterval(blinkInterval);
            }
          }, 400);
        }
      }, 50);
      return () => clearInterval(interval);
    }
  }, [scene]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ 
        opacity: isExiting ? 0 : 1,
      }}
      transition={{ duration: 0.5 }}
      className="mt-3"
    >
      <p className="font-poppins text-secondary-text font-normal tracking-wide" style={{ fontSize: '18px' }}>
        {typewriterText}
        {showCursor && (
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.4, repeat: Infinity }}
            className="inline-block w-1 h-4 bg-secondary-text ml-1"
          />
        )}
      </p>
    </motion.div>
  );
};
