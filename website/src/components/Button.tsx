import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { ButtonHTMLAttributes, Ref } from 'react';
import cx from '../lib/cx.tsx';

const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap squircle text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
    variants: {
      size: {
        default: 'h-10 px-3 py-2 active:pt-[11px] active:pb-[9px]',
        icon: 'h-10 w-10',
        lg: 'h-11 squircle px-3.5 active:pt-[11px] active:pb-[9px]',
        sm: 'h-9 squircle px-2.5 active:pt-[11px] active:pb-[9px]',
      },
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      },
    },
  },
);

const Button = ({
  asChild = false,
  className,
  size,
  variant,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    ref?: Ref<HTMLButtonElement>;
  }) => {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cx(buttonVariants({ className, size, variant }))}
      {...props}
    />
  );
};

export { Button, buttonVariants };
