import { motion } from 'framer-motion';

export const PremiumButton = ({ onClick, disabled }) => {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.98 }}
      className="relative px-12 py-4 rounded-full font-poppins text-white text-sm tracking-wider uppercase
        bg-white/5 backdrop-blur-md border-2 border-primary
        hover:border-primary hover:bg-white/10
        transition-all duration-300
        disabled:opacity-50 disabled:cursor-not-allowed
        overflow-hidden group"
    >
      {/* Glass Effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Light Sweep on Hover */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        initial={{ x: '-100%' }}
        whileHover={{ x: '100%' }}
        transition={{ duration: 0.6 }}
      />
      
      {/* Glow Effect */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          boxShadow: '0 0 20px rgba(229, 9, 20, 0.3)',
        }}
        whileHover={{
          boxShadow: '0 0 40px rgba(229, 9, 20, 0.6)',
        }}
        transition={{ duration: 0.3 }}
      />
      
      {/* Button Text */}
      <span className="relative z-10">Get Started</span>
    </motion.button>
  );
};
