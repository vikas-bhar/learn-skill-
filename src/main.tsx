import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { FirebaseProvider } from './context/FirebaseContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <FirebaseProvider>
    <ToastProvider>
      <App />
    </ToastProvider>
  </FirebaseProvider>
);
