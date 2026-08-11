import * as React from 'react';
import { cn } from '@/lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  color?: string;
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, max = 100, color, ...props }, ref) => {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));
    const bgColor =
      color ||
      (percentage >= 80
        ? 'bg-green-500'
        : percentage >= 60
          ? 'bg-yellow-500'
          : percentage >= 40
            ? 'bg-orange-500'
            : 'bg-red-500');

    return (
      <div
        ref={ref}
        className={cn('relative h-2 w-full overflow-hidden rounded-full bg-secondary', className)}
        {...props}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-500', bgColor)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    );
  },
);
Progress.displayName = 'Progress';

export { Progress };
