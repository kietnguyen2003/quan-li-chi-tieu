import { useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Plus, Check, X } from 'lucide-react';
import type { Category, Transaction, TransactionType } from '../types';
import { getIconByName } from '../icons';

interface AddTransactionProps {
    isModalOpen: boolean;
    selectedDay: Date | null;
    categories: Category[];
    setIsModalOpen: (open: boolean) => void;
    setCategories: (categories: Category[]) => void;
    onAddTransaction: (transaction: Transaction) => void;
}

export function AddTransaction({ isModalOpen, selectedDay, categories , setIsModalOpen, setCategories, onAddTransaction }: AddTransactionProps) {
    const [amount, setAmount] = useState('');
    const [type, setType] = useState<TransactionType>('expense');
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    const handleAddCategory = () => {
    if (!newCategoryName) return;
    const newCat: Category = {
      id: crypto.randomUUID(),
      name: newCategoryName,
      icon: 'MoreHorizontal',
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
    };
    setCategories([...categories, newCat]);
    setSelectedCategoryId(newCat.id);
    setIsAddingCategory(false);
    setNewCategoryName('');
  };

  const handleAddTransaction = () => {
    if (!amount || !selectedCategoryId || !selectedDay) return;

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      amount: parseFloat(amount),
      type,
      categoryId: selectedCategoryId,
      date: selectedDay.toISOString(),
    };

    onAddTransaction(newTransaction);
    setIsModalOpen(false);
  };


    return (
        <>
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsModalOpen(false)}
                    className="absolute inset-0 bg-natural-heading/40 backdrop-blur-md"
                    />
                    
                    <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="relative bg-white w-full max-w-xl rounded-t-[3rem] sm:rounded-[4rem] p-10 md:p-14 shadow-2xl overflow-y-auto max-h-[95vh] border-t border-natural-border"
                    id="transaction-modal"
                    >
                    <div className="flex justify-between items-center mb-10">
                        <div>
                        <h2 className="text-3xl font-serif italic text-natural-heading">
                            Thêm giao dịch
                        </h2>
                        <p className="text-natural-text/40 font-bold text-xs uppercase tracking-widest mt-2">
                            {selectedDay ? format(selectedDay, 'eeee, dd MMMM', { locale: vi }) : ''}
                        </p>
                        </div>
                        <button onClick={() => setIsModalOpen(false)} className="p-3 text-natural-warning hover:bg-natural-warning/5 rounded-full transition-all font-bold">
                        Đóng
                        </button>
                    </div>

                    {/* Type Toggle */}
                    <div className="flex gap-2 p-1.5 bg-natural-surface rounded-full border border-natural-border mb-12">
                        <button
                        onClick={() => setType('expense')}
                        className={`flex-1 py-4 px-4 rounded-full font-bold transition-all flex items-center justify-center gap-2 ${
                            type === 'expense' ? 'bg-white shadow-md text-natural-warning ring-1 ring-natural-border' : 'text-natural-text/40 hover:text-natural-text'
                        }`}
                        >
                        Chi tiêu
                        </button>
                        <button
                        onClick={() => setType('income')}
                        className={`flex-1 py-4 px-4 rounded-full font-bold transition-all flex items-center justify-center gap-2 ${
                            type === 'income' ? 'bg-white shadow-md text-natural-accent ring-1 ring-natural-border' : 'text-natural-text/40 hover:text-natural-text'
                        }`}
                        >
                        Thu nhập
                        </button>
                    </div>

                    {/* Amount Input */}
                    <div className="mb-12">
                        <label className="text-[10px] font-bold text-natural-text/50 uppercase tracking-[0.25em] block mb-4 px-1">
                        Số tiền
                        </label>
                        <div className="flex items-center gap-4 border-b-2 border-natural-border-light pb-4 focus-within:border-natural-heading transition-colors group">
                        <span className={`text-4xl font-light ${type === 'expense' ? 'text-natural-warning' : 'text-natural-accent'}`}>
                            {type === 'expense' ? '-' : '+'}
                        </span>
                        <input
                            autoFocus
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0"
                            className="w-full text-5xl font-bold bg-transparent border-none outline-none text-natural-heading placeholder:text-natural-text/10"
                        />
                        <span className="text-xl font-bold text-natural-text/30">VND</span>
                        </div>
                    </div>

                    {/* Category Dropdown Area */}
                    <div className="mb-14">
                        <label className="text-[10px] font-bold text-natural-text/50 uppercase tracking-[0.25em] block mb-6 px-1">
                        Hạng mục
                        </label>
                        
                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-y-10 gap-x-6">
                        {categories.map((cat) => {
                            const Icon = getIconByName(cat.icon);
                            const isActive = selectedCategoryId === cat.id;
                            return (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategoryId(cat.id)}
                                className="flex flex-col items-center gap-4 group"
                            >
                                <div 
                                className={`
                                    w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all duration-500 relative
                                    ${isActive ? 'scale-110 -translate-y-1' : 'opacity-70 group-hover:opacity-100 group-hover:scale-105 active:scale-95'}
                                `}
                                style={{ 
                                    backgroundColor: isActive ? cat.color : cat.color + '15',
                                    boxShadow: isActive ? `0 15px 30px -10px ${cat.color}80` : 'none',
                                    border: isActive ? `2px solid #fff` : `1px solid ${cat.color}20`
                                }}
                                >
                                <Icon className={`w-8 h-8 transition-colors duration-500 ${isActive ? 'text-white' : ''}`} style={{ color: isActive ? '#fff' : cat.color }} />
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-widest text-center transition-colors duration-500 ${isActive ? 'text-natural-heading' : 'text-natural-text/40'}`}>
                                {cat.name}
                                </span>
                            </button>
                            );
                        })}
                        
                        {/* Add New Category Toggle */}
                        {!isAddingCategory ? (
                            <button
                            onClick={() => setIsAddingCategory(true)}
                            className="flex flex-col items-center gap-4 group"
                            >
                            <div className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center border-2 border-dashed border-natural-border group-hover:border-natural-heading group-hover:bg-natural-surface transition-all">
                                <Plus className="w-8 h-8 text-natural-text/20 group-hover:text-natural-heading" />
                            </div>
                            <span className="text-[10px] font-bold text-natural-text/20 uppercase tracking-widest group-hover:text-natural-heading">
                                Thêm mới
                            </span>
                            </button>
                        ) : (
                            <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="col-span-4 sm:col-span-5 bg-natural-surface p-6 rounded-[2rem] border border-natural-border shadow-inner"
                            >
                            <div className="flex gap-3">
                                <input
                                autoFocus
                                type="text"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="Tên mục..."
                                className="flex-1 bg-white rounded-2xl px-6 py-4 outline-none font-bold text-base shadow-sm border border-natural-border placeholder:text-natural-text/20"
                                />
                                <button 
                                onClick={handleAddCategory}
                                className="w-14 h-14 bg-natural-accent text-white rounded-2xl shadow-lg shadow-natural-accent/20 flex items-center justify-center active:scale-90 transition-transform"
                                >
                                <Check className="w-6 h-6" />
                                </button>
                                <button 
                                onClick={() => setIsAddingCategory(false)}
                                className="w-14 h-14 bg-white text-natural-text/30 border border-natural-border rounded-2xl flex items-center justify-center active:scale-90 transition-transform"
                                >
                                <X className="w-6 h-6" />
                                </button>
                            </div>
                            </motion.div>
                        )}
                        </div>
                    </div>

                    {/* Submit Action */}
                    <button
                        onClick={handleAddTransaction}
                        disabled={!amount || !selectedCategoryId}
                        className={`
                        w-full py-7 rounded-[2rem] font-bold text-xl tracking-tight transition-all duration-500
                        ${!amount || !selectedCategoryId 
                            ? 'bg-natural-surface text-natural-text/10 cursor-not-allowed' 
                            : 'bg-natural-accent text-white hover:bg-natural-heading active:scale-[0.98] shadow-2xl shadow-natural-accent/30'
                        }
                        `}
                    >
                        Lưu giao dịch
                    </button>
                    </motion.div>
                </div>
            )}
        </>
    )
}