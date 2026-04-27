import { useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Plus, Check, X } from 'lucide-react';
import type { Category, Transaction, TransactionType } from '../lib/types';
import { getIconByName } from '../lib/icons';

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
              className="relative bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[3rem] p-6 md:p-8 shadow-2xl overflow-y-auto max-h-[90vh] border-t border-natural-border"
              id="transaction-modal"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-serif italic text-natural-heading">
                    Thêm giao dịch
                  </h2>
                  <p className="text-natural-text/40 font-bold text-[9px] uppercase tracking-widest mt-1">
                    {selectedDay ? format(selectedDay, 'eeee, dd MMMM', { locale: vi }) : ''}
                  </p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-xs font-bold text-natural-warning hover:bg-natural-warning/5 px-3 py-1 rounded-full transition-all">
                  Đóng
                </button>
              </div>

              {/* Type Toggle */}
              <div className="flex gap-1.5 p-1 bg-natural-surface rounded-full border border-natural-border mb-8">
                <button
                  onClick={() => setType('expense')}
                  className={`flex-1 py-2.5 px-3 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    type === 'expense' ? 'bg-white shadow-sm text-natural-warning ring-1 ring-natural-border/50' : 'text-natural-text/40 hover:text-natural-text'
                  }`}
                >
                   Chi tiêu
                </button>
                <button
                  onClick={() => setType('income')}
                  className={`flex-1 py-2.5 px-3 rounded-full text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    type === 'income' ? 'bg-white shadow-sm text-natural-accent ring-1 ring-natural-border/50' : 'text-natural-text/40 hover:text-natural-text'
                  }`}
                >
                  Thu nhập
                </button>
              </div>

              {/* Amount Input */}
              <div className="mb-8">
                <label className="text-[9px] font-bold text-natural-text/50 uppercase tracking-[0.2em] block mb-2 px-1">
                  Số tiền
                </label>
                <div className="flex items-center gap-3 border-b border-natural-border-light pb-2 focus-within:border-natural-heading transition-colors group">
                  <span className={`text-2xl font-light ${type === 'expense' ? 'text-natural-warning' : 'text-natural-accent'}`}>
                    {type === 'expense' ? '-' : '+'}
                  </span>
                  <input
                    autoFocus
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="w-full text-3xl font-bold bg-transparent border-none outline-none text-natural-heading placeholder:text-natural-text/10"
                  />
                  <span className="text-sm font-bold text-natural-text/30">VND</span>
                </div>
              </div>

              {/* Category Dropdown Area */}
              <div className="mb-10">
                <label className="text-[9px] font-bold text-natural-text/50 uppercase tracking-[0.2em] block mb-4 px-1">
                  Hạng mục
                </label>
                
                <div className="grid grid-cols-4 gap-y-6 gap-x-4">
                  {categories.map((cat) => {
                    const Icon = getIconByName(cat.icon);
                    const isActive = selectedCategoryId === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategoryId(cat.id)}
                        className="flex flex-col items-center gap-2 group"
                      >
                        <div 
                          className={`
                            w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 relative
                            ${isActive ? 'scale-105 shadow-md' : 'opacity-70 hover:opacity-100'}
                          `}
                          style={{ 
                            backgroundColor: isActive ? cat.color : cat.color + '15',
                            border: isActive ? `2px solid #fff` : `1px solid ${cat.color}10`
                          }}
                        >
                          <Icon className={`w-6 h-6 transition-colors duration-300 ${isActive ? 'text-white' : ''}`} style={{ color: isActive ? '#fff' : cat.color }} />
                        </div>
                        <span className={`text-[8px] font-bold uppercase tracking-wider text-center truncate w-full transition-colors duration-300 ${isActive ? 'text-natural-heading' : 'text-natural-text/40'}`}>
                          {cat.name}
                        </span>
                      </button>
                    );
                  })}
                  
                  {/* Add New Category Toggle */}
                  {!isAddingCategory ? (
                    <button
                      onClick={() => setIsAddingCategory(true)}
                      className="flex flex-col items-center gap-2 group"
                    >
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center border border-dashed border-natural-border group-hover:border-natural-heading transition-all">
                        <Plus className="w-6 h-6 text-natural-text/20 group-hover:text-natural-heading" />
                      </div>
                      <span className="text-[8px] font-bold text-natural-text/20 uppercase tracking-widest group-hover:text-natural-heading">
                        Mới
                      </span>
                    </button>
                  ) : (
                    <motion.div 
                      initial={{ scale: 0.98, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="col-span-4 bg-natural-surface p-4 rounded-2xl border border-natural-border"
                    >
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          type="text"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="Tên mục..."
                          className="flex-1 bg-white rounded-xl px-4 py-2 outline-none font-bold text-sm border border-natural-border placeholder:text-natural-text/20"
                        />
                        <button 
                          onClick={handleAddCategory}
                          className="w-10 h-10 bg-natural-accent text-white rounded-xl shadow-md flex items-center justify-center active:scale-90 transition-transform"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setIsAddingCategory(false)}
                          className="w-10 h-10 bg-white text-natural-text/30 border border-natural-border rounded-xl flex items-center justify-center active:scale-90 transition-transform"
                        >
                          <X className="w-5 h-5" />
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
                  w-full py-4 rounded-2xl font-bold text-base tracking-tight transition-all duration-300
                  ${!amount || !selectedCategoryId 
                    ? 'bg-natural-surface text-natural-text/10 cursor-not-allowed' 
                    : 'bg-natural-accent text-white hover:bg-natural-heading active:scale-[0.98] shadow-lg shadow-natural-accent/20'
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
