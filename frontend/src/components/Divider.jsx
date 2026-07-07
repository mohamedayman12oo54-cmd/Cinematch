import { motion } from 'framer-motion';

export const Divider = ({ scene, isExiting }) => {
  return (
    <motion.div
      className="h-[2px] bg-primary mt-6"
      initial={{ width: 0 }}
      animate={{ 
        width: isExiting ? 0 : 240,
        opacity: isExiting ? 0 : 1,
      }}
      transition={{ 
        duration: 0.8, 
        ease: [0.16, 1, 0.3, 1],
      }}
    />
  );
};
