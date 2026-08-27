import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          login: path.resolve(__dirname, 'login.html'),
          register: path.resolve(__dirname, 'register.html'),
          forgotPassword: path.resolve(__dirname, 'forgot-password.html'),
          dashboard: path.resolve(__dirname, 'dashboard.html'),
          income: path.resolve(__dirname, 'income.html'),
          expenses: path.resolve(__dirname, 'expenses.html'),
          transactions: path.resolve(__dirname, 'transactions.html'),
          budgets: path.resolve(__dirname, 'budgets.html'),
          financialPlans: path.resolve(__dirname, 'financial-plans.html'),
          savingGoals: path.resolve(__dirname, 'saving-goals.html'),
          debts: path.resolve(__dirname, 'debts.html'),
          reports: path.resolve(__dirname, 'reports.html'),
          categories: path.resolve(__dirname, 'categories.html'),
          notifications: path.resolve(__dirname, 'notifications.html'),
          profile: path.resolve(__dirname, 'profile.html'),
          admin: path.resolve(__dirname, 'admin.html'),
        },
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
