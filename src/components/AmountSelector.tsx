// components/AmountSelector.tsx

'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const PRESET_AMOUNTS = [10, 25, 50, 100, 250];

interface AmountSelectorProps {
  value: number | null;
  onChange: (amount: number) => void;
  min?: number;
  max?: number;
}

export function AmountSelector({
  value,
  onChange,
  min = 5,
  max = 500,
}: AmountSelectorProps) {
  const [isCustom, setIsCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const handlePresetClick = (amount: number) => {
    setIsCustom(false);
    setCustomValue('');
    onChange(amount);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9.]/g, '');
    setCustomValue(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= min && num <= max) {
      onChange(num);
    }
  };

  const handleCustomFocus = () => {
    setIsCustom(true);
  };

  return (
    <div className="space-y-4">
      {/* Preset amounts */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {PRESET_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => handlePresetClick(amount)}
            className={cn(
              'py-4 px-2 rounded-lg font-semibold text-lg transition-all',
              value === amount && !isCustom
                ? 'bg-primary-600 text-white ring-2 ring-primary-600 ring-offset-2'
                : 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200'
            )}
          >
            ${amount}
          </button>
        ))}
      </div>

      {/* Custom amount input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <span className="text-neutral-500 text-lg">$</span>
        </div>
        <input
          type="text"
          inputMode="decimal"
          placeholder="Custom amount"
          value={isCustom ? customValue : ''}
          onFocus={handleCustomFocus}
          onChange={handleCustomChange}
          className={cn(
            'w-full pl-8 pr-4 py-4 rounded-lg text-lg font-medium',
            'border-2 transition-colors',
            isCustom
              ? 'border-primary-500 ring-2 ring-primary-100'
              : 'border-neutral-200 hover:border-neutral-300',
            'focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100'
          )}
        />
      </div>

      {/* Range info */}
      <p className="text-sm text-neutral-500 text-center">
        Minimum ${min} · Maximum ${max}
      </p>
    </div>
  );
}
