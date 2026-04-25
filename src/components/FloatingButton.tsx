import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';

interface FloatingButtonProps {
    setSelectedDay: (day: Date | null) => void;
    setIsModalOpen: (open: boolean) => void;
}

export function FloatingButton({ setSelectedDay, setIsModalOpen }: FloatingButtonProps) {
    return (
        <motion.button
            whileHover={{ scale: 1.05, rotate: 5 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
                setSelectedDay(new Date());
                setIsModalOpen(true);
            }}
            className="fixed bottom-10 right-10 w-16 h-16 bg-natural-heading text-white rounded-full shadow-2xl shadow-natural-heading/30 flex items-center justify-center z-20 group border-4 border-white"
            id="add-transaction-fab"
        >
            <Plus className="w-8 h-8" />
        </motion.button>
    )
}