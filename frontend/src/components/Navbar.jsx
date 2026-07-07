import { motion } from 'framer-motion';
import { FaFilm } from 'react-icons/fa';

export const Navbar = () => {
  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 right-0 z-50 px-8 py-6"
    >
      <div className="flex items-center gap-3">
        <FaFilm className="text-2xl text-primary" />
        <span className="font-bebas text-white text-2xl tracking-wider">
          CINEMATCH
        </span>
      </div>
    </motion.nav>
  );
};
