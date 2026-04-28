import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { Download, FileText, Upload, X } from 'lucide-react';

import { groupTransactionsByDate } from '../lib/helper.ts';
import type { Category, Transaction } from '../lib/types.ts';

interface TextTransactionToolsProps {
  transactions: Transaction[];
  categories: Category[];
  onImportTransactions: (transactions: Transaction[]) => void;
}

const normalizeCategoryName = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase('vi-VN')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

const parseTextDate = (value: string) => {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!match) return null;

  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

const formatTransactionsAsText = (transactions: Transaction[], categories: Category[]) => {
  const categoryMap = new Map(categories.map((category) => [category.id, category.name]));
  const sortedTransactions = [...transactions].sort(
    (first, second) => parseISO(first.date).getTime() - parseISO(second.date).getTime(),
  );
  const groupedTransactions = groupTransactionsByDate(sortedTransactions);

  return Object.entries(groupedTransactions)
    .sort(([firstDate], [secondDate]) => firstDate.localeCompare(secondDate))
    .map(([dateKey, dateTransactions]) => {
      const formattedDate = format(parseISO(dateKey), 'd/M/yyyy');
      const transactionText = dateTransactions
        .map((transaction) => {
          const sign = transaction.type === 'income' ? '+' : '-';
          const categoryName = categoryMap.get(transaction.categoryId) ?? 'Khác';

          return `${sign}${transaction.amount} ${categoryName.toLocaleLowerCase('vi-VN')}`;
        })
        .join(', ');

      return `${formattedDate}: ${transactionText}`;
    })
    .join('\n');
};

export function TextTransactionTools({
  transactions,
  categories,
  onImportTransactions,
}: TextTransactionToolsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [textTransactions, setTextTransactions] = useState('');
  const [message, setMessage] = useState('');

  const parseTransactionsFromText = (value: string) => {
    const categoryMap = new Map(
      categories.map((category) => [normalizeCategoryName(category.name), category]),
    );
    const parsedTransactions: Transaction[] = [];
    const errors: string[] = [];
    const lines = value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    lines.forEach((line, lineIndex) => {
      const [dateText, ...transactionTextParts] = line.split(':');
      const transactionText = transactionTextParts.join(':').trim();
      const date = parseTextDate(dateText);

      if (!date || !transactionText) {
        errors.push(`Dòng ${lineIndex + 1}: format phải là "25/4/2026: -20000 ăn uống, +100000 lương"`);
        return;
      }

      transactionText.split(',').forEach((rawEntry, entryIndex) => {
        const entry = rawEntry.trim();
        const match = entry.match(/^([+-])\s*([\d.,]+)\s+(.+)$/);

        if (!match) {
          errors.push(`Dòng ${lineIndex + 1}, mục ${entryIndex + 1}: không đọc được khoản "${entry}"`);
          return;
        }

        const [, sign, rawAmount, rawCategoryName] = match;
        const amount = Number(rawAmount.replace(/[.,]/g, ''));
        const category = categoryMap.get(normalizeCategoryName(rawCategoryName));

        if (!Number.isFinite(amount) || amount <= 0) {
          errors.push(`Dòng ${lineIndex + 1}, mục ${entryIndex + 1}: số tiền không hợp lệ`);
          return;
        }

        if (!category) {
          errors.push(`Dòng ${lineIndex + 1}, mục ${entryIndex + 1}: chưa có hạng mục "${rawCategoryName.trim()}"`);
          return;
        }

        parsedTransactions.push({
          id: crypto.randomUUID(),
          amount,
          type: sign === '+' ? 'income' : 'expense',
          categoryId: category.id,
          date: date.toISOString(),
        });
      });
    });

    return { parsedTransactions, errors };
  };

  const handleImportTextTransactions = () => {
    const { parsedTransactions, errors } = parseTransactionsFromText(textTransactions);

    if (errors.length > 0) {
      setMessage(errors.slice(0, 4).join('\n'));
      return;
    }

    if (parsedTransactions.length === 0) {
      setMessage('Chưa có giao dịch nào để nhập.');
      return;
    }

    onImportTransactions(parsedTransactions);
    setTextTransactions('');
    setMessage(`Đã nhập ${parsedTransactions.length} giao dịch.`);
  };

  const handleExportTextTransactions = () => {
    const content = formatTransactionsAsText(transactions, categories);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `money-manage-${format(new Date(), 'yyyy-MM-dd')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="flex justify-center md:justify-start">
        <button
          type="button"
          onClick={() => setIsOpen((currentIsOpen) => !currentIsOpen)}
          className="h-11 px-5 rounded-xl bg-white border border-natural-border text-natural-heading hover:bg-natural-surface transition-colors flex items-center justify-center gap-2 text-sm font-bold shadow-sm"
        >
          {isOpen ? <X className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
          {isOpen ? 'Đóng nhập text' : 'Nhập / xuất text'}
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 bg-natural-heading/40 backdrop-blur-md"
          />

          <motion.section
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', damping: 24, stiffness: 280 }}
            className="relative w-full max-w-2xl bg-white border border-natural-border rounded-3xl p-5 md:p-6 shadow-2xl max-h-[88vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h2 className="text-xl md:text-2xl font-serif italic text-natural-heading">Nhập dữ liệu text</h2>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-natural-text/40 mt-1">
                  25/4/2026: -20000 ăn uống, +100000 lương
                </p>
                <p className="text-xs font-semibold text-natural-warning mt-2">
                  Lưu ý: tên hạng mục trong text phải chọn theo danh sách category bên dưới.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-10 h-10 rounded-xl border border-natural-border text-natural-text/50 hover:text-natural-heading hover:bg-natural-surface transition-colors flex items-center justify-center shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportTextTransactions}
              disabled={transactions.length === 0}
              className="mb-4 h-10 px-4 rounded-xl border border-natural-border text-natural-heading disabled:text-natural-text/20 disabled:bg-natural-surface disabled:cursor-not-allowed hover:bg-natural-surface transition-colors flex items-center justify-center gap-2 text-xs font-bold"
            >
              <Download className="w-4 h-4" />
              Xuất file text
            </button>

            <div className="mb-4 rounded-2xl border border-natural-border bg-natural-surface/50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-natural-text/40 mb-3">
                Category có thể dùng
              </p>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <span
                    key={category.id}
                    className="inline-flex items-center gap-2 rounded-full border border-natural-border bg-white px-3 py-1.5 text-xs font-bold text-natural-heading"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    {category.name.toLocaleLowerCase('vi-VN')}
                  </span>
                ))}
              </div>
            </div>

            <textarea
              value={textTransactions}
              onChange={(event) => {
                setTextTransactions(event.target.value);
                setMessage('');
              }}
              rows={7}
              placeholder={'25/4/2026: -20000 ăn uống, +100000 lương\n26/4/2026: -45000 di chuyển'}
              className="w-full resize-y rounded-xl border border-natural-border bg-natural-surface/60 p-3 text-sm text-natural-heading outline-none focus:border-natural-heading transition-colors placeholder:text-natural-text/25"
            />

            <div className="mt-4 flex flex-col md:flex-row md:items-center gap-3">
              <button
                type="button"
                onClick={handleImportTextTransactions}
                disabled={!textTransactions.trim()}
                className="h-11 px-5 rounded-xl bg-natural-heading text-white disabled:bg-natural-surface disabled:text-natural-text/15 disabled:cursor-not-allowed hover:bg-natural-accent transition-colors flex items-center justify-center gap-2 text-sm font-bold"
              >
                <Upload className="w-4 h-4" />
                Nhập vào lịch
              </button>
              {message && (
                <p className="whitespace-pre-line text-xs font-semibold text-natural-text/60">
                  {message}
                </p>
              )}
            </div>
          </motion.section>
        </div>
      )}
    </>
  );
}
