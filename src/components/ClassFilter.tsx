import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Search, SlidersHorizontal } from 'lucide-react';

interface ClassFilterProps {
  classes: ReadonlyArray<{ id: string; name: string; description?: string }>;
  mode?: 'filter' | 'select';
  value: string;
  onChange: (value: string) => void;
}

const searchable = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLocaleLowerCase('vi');

export function ClassFilter({ classes, value, onChange, mode = 'filter' }: ClassFilterProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const placeholder = mode === 'filter' ? 'Tất cả lớp' : 'Chọn lớp học';
  const label = mode === 'filter' ? 'Lọc lớp' : 'Lớp chấm công';
  const selected = classes.find((item) => item.id === value);
  const results = classes.filter((item) => searchable(item.name).includes(searchable(query.trim())));

  useEffect(() => {
    if (!open) return;
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) input.current?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const dismissOnFocus = (event: FocusEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('focusin', dismissOnFocus);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('focusin', dismissOnFocus);
    };
  }, [open]);

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
    trigger.current?.focus();
  };

  return (
    <div ref={root} className="relative min-w-0 flex-1" onKeyDown={(event) => {
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    }}>
      <button ref={trigger} type="button" aria-label={`${label}: ${selected?.name ?? placeholder}`} aria-expanded={open} aria-controls={panelId}
        onClick={() => { setQuery(''); setOpen(!open); }}
        className={`flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 text-left text-sm font-semibold text-natural-heading transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-natural-heading ${open || value ? 'border-natural-heading/30 bg-natural-panel' : 'border-natural-border bg-natural-surface hover:bg-natural-panel'}`}>
        <SlidersHorizontal size={15} className="shrink-0 text-natural-muted" />
        <span className="min-w-0 flex-1 py-2">
          <span className="block truncate">{selected?.name ?? placeholder}</span>
          {selected?.description && <span className="mt-0.5 block text-xs font-normal text-natural-muted">{selected.description}</span>}
        </span>
        <ChevronDown size={15} className={`shrink-0 text-natural-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div id={panelId} className={`${mode === 'filter' ? 'absolute left-0 top-full z-40 min-w-60' : 'relative'} mt-2 w-full overflow-hidden rounded-2xl border border-natural-border bg-[#fffaf2] p-2 shadow-xl shadow-natural-heading/15`}>
        <div className="class-filter-search mb-2 flex items-center gap-2 rounded-lg border border-natural-border-light bg-white px-3">
          <Search size={15} className="shrink-0 text-natural-muted" />
          <input ref={input} aria-label="Tìm lớp học" placeholder="Tìm lớp học…" value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 w-full bg-transparent py-2.5 text-base text-natural-heading outline-none placeholder:text-natural-muted" />
        </div>
        <div className="max-h-64 space-y-0.5 overflow-y-auto overscroll-contain" role="group" aria-label={label}>
          {[{ id: '', name: placeholder, description: undefined }, ...results].map((item) => <button key={item.id} type="button" aria-pressed={value === item.id} onClick={() => choose(item.id)}
            className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-natural-accent ${value === item.id ? 'bg-natural-heading font-semibold text-white' : 'text-natural-heading hover:bg-natural-panel'}`}>
            <span className="min-w-0 break-words">
              <span className="block">{item.name}</span>
              {item.description && <span className={`mt-1 block text-xs font-normal ${value === item.id ? 'text-white/70' : 'text-natural-muted'}`}>{item.description}</span>}
            </span>
            {value === item.id && <Check size={16} className="shrink-0 text-natural-accent" />}
          </button>)}
          {!results.length && <p className="px-3 py-4 text-center text-xs text-natural-muted">Không tìm thấy lớp phù hợp.</p>}
        </div>
      </div>}
    </div>
  );
}
