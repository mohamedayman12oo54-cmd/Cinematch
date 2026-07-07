import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { HeroButtons } from './HeroButtons';
import { ScrollIndicator } from './ScrollIndicator';

const headline = 'Unlimited Movies. Powered by AI.';

export const Hero = () => {
  const [typewriterText, setTypewriterText] = useState('');

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < headline.length) {
        setTypewriterText(headline.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 60);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4">
      {/* Headline */}
      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="font-poppins font-bold text-white text-center mb-6"
        style={{ fontSize: 'clamp(36px, 5vw, 64px)' }}
      >
        {typewriterText}
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.6, repeat: Infinity }}
          className="inline-block w-1 h-12 bg-white ml-2"
        />
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="font-poppins text-secondary-text text-center max-w-[600px] mb-8"
        style={{ fontSize: '18px' }}
      >
        Discover movies you'll love before everyone else.
      </motion.p>

      {/* Divider */}
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: 120 }}
        transition={{ duration: 0.8, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="h-[2px] bg-primary mb-12"
      />

      {/* Buttons */}
      <HeroButtons />

      {/* Scroll Indicator */}
      <ScrollIndicator />
    </section>
  );
};
