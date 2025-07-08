import { forwardRef, HTMLAttributes } from 'react';
import cx from '../lib/cx.tsx';

const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      className={cx(
        'rounded-lg border bg-card text-card-foreground shadow-sm',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      className={cx('flex flex-col space-y-1.5 p-6', className)}
      ref={ref}
      {...props}
    />
  ),
);
CardHeader.displayName = 'CardHeader';

const CardTitle = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      className={cx(
        'text-2xl font-semibold leading-none tracking-tight',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
CardTitle.displayName = 'CardTitle';

const CardDescription = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    className={cx('text-sm text-muted-foreground', className)}
    ref={ref}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div className={cx('p-6 pt-0', className)} ref={ref} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      className={cx('flex items-center p-6 pt-0', className)}
      ref={ref}
      {...props}
    />
  ),
);
CardFooter.displayName = 'CardFooter';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
