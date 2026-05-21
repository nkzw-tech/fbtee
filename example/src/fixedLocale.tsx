import 'normalize.css';
import './root.css';
import './example/Example.css';
import { createRoot } from 'react-dom/client';
import FixedLocaleDemo from './example/FixedLocaleDemo.tsx';

const root = document.getElementById('root')!;
root.style.justifyContent = 'flex-start';
root.style.height = 'auto';
root.style.minHeight = '100%';
createRoot(root).render(<FixedLocaleDemo />);
