import type { InputHTMLAttributes } from 'react';

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`rounded-md border border-neutral-100 px-3 py-2 text-sm outline-none focus:border-brand-600 ${className}`}
      {...props}
    />
  );
}
