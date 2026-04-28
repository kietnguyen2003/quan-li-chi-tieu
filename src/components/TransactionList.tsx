import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Pencil, Plus, X } from 'lucide-react';
import type { Transaction, Category } from '../lib/types';

import { getIconByName } from '../lib/icons';
import { formatCurrency } from '../lib/utils.ts';
import { vi } from 'date-fns/locale';

interface TransactionListProps{
    isDayListOpen: boolean;
    selectedDay: Date | null;
    dayTransactions: Record<string, Transaction[]>;
    categories: Category[];
    setIsDayListOpen: (open: boolean) => void;
    setIsModalOpen: (open: boolean) => void;
    onEditTransaction: (transaction: Transaction) => void;
}

export function TransactionList({ isDayListOpen, selectedDay, dayTransactions, categories, setIsDayListOpen, setIsModalOpen, onEditTransaction }: TransactionListProps) {
    return (
        <>
            {isDayListOpen && selectedDay && (
            <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
                <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDayListOpen(false)}
                className="absolute inset-0 bg-natural-heading/40 backdrop-blur-sm"
                />
                <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl overflow-hidden border border-natural-border"
                >
                <div className="flex justify-between items-center mb-6">
                    <div>
                    <h3 className="text-xl font-serif italic text-natural-heading">
                        Giao dịch ngày
                    </h3>
                    <p className="text-natural-text/40 font-bold text-[10px] uppercase tracking-widest mt-1">
                        {format(selectedDay, 'dd MMMM yyyy', { locale: vi })}
                    </p>
                    </div>
                    <button onClick={() => setIsDayListOpen(false)} className="p-2 text-natural-text/30 hover:text-natural-warning transition-colors">
                    <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-3 mb-8 max-h-[300px] overflow-y-auto no-scrollbar">
                    {dayTransactions[format(selectedDay, 'yyyy-MM-dd')]?.length ? (
                    dayTransactions[format(selectedDay, 'yyyy-MM-dd')].map((t) => {
                        const category = categories.find(c => c.id === t.categoryId);
                        const Icon = getIconByName(category?.icon);
                        return (
                        <div key={t.id} className="flex items-center justify-between gap-3 p-4 bg-natural-surface rounded-2xl border border-natural-border-light">
                            <div className="flex items-center gap-4">
                            <div 
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                                style={{ backgroundColor: category?.color || '#ccc' }}
                            >
                                <Icon className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="font-bold text-sm text-natural-heading">{category?.name}</p>
                                <p className="text-[10px] text-natural-text/40 uppercase tracking-widest font-bold">{t.type === 'income' ? 'Thu nhập' : 'Chi tiêu'}</p>
                            </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <p className={`font-bold whitespace-nowrap ${t.type === 'income' ? 'text-natural-accent' : 'text-natural-warning'}`}>
                                {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                </p>
                                <button
                                    onClick={() => onEditTransaction(t)}
                                    className="w-9 h-9 rounded-xl bg-white border border-natural-border-light text-natural-text/40 hover:text-natural-heading active:scale-95 transition-all flex items-center justify-center"
                                    aria-label="Sửa giao dịch"
                                    title="Sửa giao dịch"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        );
                    })
                    ) : (
                    <div className="py-12 text-center">
                        <p className="text-natural-text/30 font-serif italic text-lg">Không có giao dịch</p>
                    </div>
                    )}
                </div>

                <button
                    onClick={() => {
                    setIsDayListOpen(false);
                    setIsModalOpen(true);
                    }}
                    className="w-full py-4 bg-natural-heading text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-natural-heading/20 active:scale-95 transition-transform"
                >
                    <Plus className="w-5 h-5" /> Thêm giao dịch
                </button>
                </motion.div>
            </div>
            )}
        </>
    )
}
