import { motion } from 'framer-motion';

export const AnimatedTitle = ({ scene, isExiting }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ 
        opacity: isExiting ? 0 : 1,
        scale: isExiting ? 0.8 : 1,
      }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="relative"
    >
      {/* Soft Netflix-Red Glow Behind Logo */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.4, 0.6, 0.4],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <div
          className="w-full h-full"
          style={{
            background: 'radial-gradient(circle, rgba(229,9,20,0.3) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />
      </motion.div>

      {/* Main Logo */}
      <motion.h1
        className="font-bebas text-white font-bold tracking-wider relative z-10"
        style={{
          fontSize: 'clamp(52px, 5vw, 90px)',
          textShadow: '0 0 50px rgba(229, 9, 20, 0.4)',
        }}
        animate={{
          scale: isExiting ? 0.8 : [1, 1.02, 1],
        }}
        transition={{
          duration: isExiting ? 0.8 : 4,
          repeat: isExiting ? 0 : Infinity,
          ease: 'easeInOut',
        }}
      >
        CINEMATCH
      </motion.h1>
      
      {/* Premium White Light Sweep (Once) */}
      <motion.div
        className="absolute inset-0 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 1.2, delay: 0.3, ease: 'easeInOut' }}
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-15"
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ duration: 0.8, delay: 0.3, ease: 'easeInOut' }}
        />
      </motion.div>
    </motion.div>
  );
};
