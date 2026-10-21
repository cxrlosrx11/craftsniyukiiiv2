import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ShopProvider } from './lib/ShopContext.jsx';
import './styles.css';
import './ui.css';
import UiHost from './components/UiHost.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ShopProvider>
      <App />
      <UiHost />
    </ShopProvider>
  </React.StrictMode>
);
