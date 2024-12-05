import 'normalize.css';
import './root.css';
import './Example/Example.css';
import { createRoot } from 'react-dom/client';
import Example from './example/Example.react';

const root = document.getElementById('root');

if (root == null) {
  throw new Error(`No root element found.`);
}

createRoot(root).render(<Example />);
