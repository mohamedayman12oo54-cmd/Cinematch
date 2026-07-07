import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export const HeroButtons = () => {
  const navigate = useNavigate();

  const handleSignIn = () => {
    navigate('/auth/login');
  };

  const handleCreateAccount = () => {
    navigate('/auth/register');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 1, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col sm:flex-row gap-4"
    >
      {/* Primary Button - SIGN IN */}
      <motion.button
        onClick={handleSignIn}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
        className="relative px-12 py-[18px] rounded-full font-poppins text-white text-sm tracking-wider uppercase font-semibold
          bg-primary
          transition-all duration-300
          overflow-hidden group"
      >
        {/* Light Sweep on Hover */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
          initial={{ x: '-100%' }}
          whileHover={{ x: '100%' }}
          transition={{ duration: 0.6 }}
        />
        
        {/* Glow Effect */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            boxShadow: '0 0 30px rgba(229, 9, 20, 0.5)',
          }}
          whileHover={{
            boxShadow: '0 0 50px rgba(229, 9, 20, 0.8)',
          }}
          transition={{ duration: 0.3 }}
        />
        
        <span className="relative z-10">Sign In</span>
      </motion.button>

      {/* Secondary Button - CREATE ACCOUNT */}
      <motion.button
        onClick={handleCreateAccount}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.98 }}
        className="relative px-12 py-[18px] rounded-full font-poppins text-white text-sm tracking-wider uppercase font-semibold
          bg-transparent border-2 border-white
          hover:bg-white hover:text-black
          transition-all duration-300
          overflow-hidden group"
      >
        <span className="relative z-10">Create Account</span>
      </motion.button>
    </motion.div>
  );
};
