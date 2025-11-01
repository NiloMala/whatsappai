import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ className, onCheckedChange, checked, ...props }, ref) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onCheckedChange?.(e.target.checked);
    if (props.onChange) props.onChange(e as any);
  };

  const isChecked = typeof checked === 'boolean' ? checked : undefined;

  return (
    <label className={cn('inline-flex items-center', className)}>
      <input
        ref={ref}
        type="checkbox"
        checked={isChecked}
        onChange={handleChange}
        className="sr-only"
        {...props}
      />
      <span
        aria-hidden
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary bg-background text-current',
          isChecked ? 'bg-primary text-primary-foreground' : '',
        )}
      >
        {isChecked ? <Check className="h-4 w-4" /> : null}
      </span>
    </label>
  );
});

Checkbox.displayName = 'Checkbox';

export { Checkbox };
