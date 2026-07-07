import { motion } from 'framer-motion';
import { FaFilm } from 'react-icons/fa';

export const MovieIcon = ({ scene, isExiting }) => {
  return (
    <motion.div
      initial={{ y: -80, opacity: 0, scale: 0.8 }}
      animate={{ 
        y: isExiting ? -100 : 0,
        opacity: isExiting ? 0 : 1,
        scale: isExiting ? 0.6 : 1,
      }}
      transition={{
        duration: 0.8,
        type: 'spring',
        damping: 12,
        stiffness: 200,
      }}
      className="relative mb-6"
    >
      {/* Soft Red Glow Behind Icon */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <div
          className="w-20 h-20 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(229,9,20,0.4) 0%, transparent 70%)',
            filter: 'blur(20px)',
          }}
        />
      </motion.div>
      
      {/* Movie Icon */}
      <motion.div
        animate={{
          y: [0, -3, 0],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <FaFilm className="text-5xl text-primary relative z-10" />
      </motion.div>
    </motion.div>
  );
};
