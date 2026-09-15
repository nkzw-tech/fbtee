import 'normalize.css';
import './root.css';
import './example/Example.css';
import './example/ScopedLocaleExample.css';
import { createRoot } from 'react-dom/client';
import Example from './example/LocaleContextExample.tsx';

createRoot(document.getElementById('root')!).render(<Example />);
