import { motion } from 'framer-motion';

export const FeatureCard = ({ icon, title, description, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.2, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -10 }}
      className="relative p-8 rounded-2xl bg-white/5 backdrop-blur-md border border-border
        hover:border-primary/50 transition-all duration-300 group overflow-hidden"
    >
      {/* Red Glow on Hover */}
      <motion.div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: 'radial-gradient(circle at center, rgba(229, 9, 20, 0.15) 0%, transparent 70%)',
        }}
      />

      {/* Icon */}
      <motion.div
        className="text-5xl mb-6 relative z-10"
        whileHover={{ scale: 1.1 }}
        transition={{ duration: 0.3 }}
      >
        {icon}
      </motion.div>

      {/* Title */}
      <h3 className="font-poppins font-semibold text-white text-xl mb-4 relative z-10">
        {title}
      </h3>

      {/* Description */}
      <p className="font-poppins text-secondary-text text-base leading-relaxed relative z-10">
        {description}
      </p>
    </motion.div>
  );
};
