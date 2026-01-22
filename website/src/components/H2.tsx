import cx from '../lib/cx.tsx';

export default function H2({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <h2 className={cx('text-2xl sm:text-3xl', className)}>{children}</h2>;
}
