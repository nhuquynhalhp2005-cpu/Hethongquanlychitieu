/**
 * ==========================================================================
 * HỆ THỐNG THEO DÕI THU CHI VÀ KẾ HOẠCH TÀI CHÍNH CÁ NHÂN
 * Firebase Configuration (Modular SDK v10)
 * ==========================================================================
 * 
 * HƯỚNG DẪN CẤU HÌNH FIREBASE:
 * 1. Truy cập https://console.firebase.google.com/
 * 2. Tạo một dự án mới (ví dụ: my-finance-app)
 * 3. Vào Cài đặt dự án (Project Settings) > Cài đặt ứng dụng web
 * 4. Sao chép các thông số và dán thay thế vào đối tượng `firebaseConfig` bên dưới:
 */

// ======================= THAY ĐỔI CẤU HÌNH CỦA BẠN TẠI ĐÂY =======================
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
// ================================================================================

// Firebase Modular SDK CDN URLs
export const FIREBASE_APP_URL = "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
export const FIREBASE_AUTH_URL = "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
export const FIREBASE_FIRESTORE_URL = "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Check if the user has provided real Firebase keys
 */
export function isFirebaseConfigured() {
  const customConfig = getSavedFirebaseConfig();
  const config = customConfig || firebaseConfig;
  return (
    config &&
    config.apiKey &&
    config.apiKey !== "YOUR_API_KEY" &&
    config.projectId &&
    config.projectId !== "YOUR_PROJECT_ID"
  );
}

/**
 * Get active Firebase config (from code or localStorage)
 */
export function getActiveFirebaseConfig() {
  return getSavedFirebaseConfig() || firebaseConfig;
}

/**
 * Save Firebase config dynamically via UI
 */
export function saveFirebaseConfig(cfg) {
  try {
    localStorage.setItem('custom_firebase_config', JSON.stringify(cfg));
    return true;
  } catch (e) {
    console.error('Error saving firebase config', e);
    return false;
  }
}

export function getSavedFirebaseConfig() {
  try {
    const raw = localStorage.getItem('custom_firebase_config');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Default System Categories for Income & Expense
 */
export const DEFAULT_INCOME_CATEGORIES = [
  { id: 'cat_inc_salary', name: 'Lương', icon: 'fa-money-bill-wave', color: '#10b981', type: 'income' },
  { id: 'cat_inc_bonus', name: 'Thưởng', icon: 'fa-gift', color: '#059669', type: 'income' },
  { id: 'cat_inc_freelance', name: 'Làm thêm', icon: 'fa-laptop-code', color: '#0d9488', type: 'income' },
  { id: 'cat_inc_investment', name: 'Đầu tư', icon: 'fa-chart-line', color: '#3b82f6', type: 'income' },
  { id: 'cat_inc_gift', name: 'Tiền được cho', icon: 'fa-hand-holding-usd', color: '#8b5cf6', type: 'income' },
  { id: 'cat_inc_other', name: 'Khác', icon: 'fa-ellipsis-h', color: '#64748b', type: 'income' }
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 'cat_exp_food', name: 'Ăn uống', icon: 'fa-utensils', color: '#ef4444', type: 'expense' },
  { id: 'cat_exp_transport', name: 'Đi lại', icon: 'fa-car', color: '#f97316', type: 'expense' },
  { id: 'cat_exp_shopping', name: 'Mua sắm', icon: 'fa-shopping-bag', color: '#ec4899', type: 'expense' },
  { id: 'cat_exp_education', name: 'Học tập', icon: 'fa-graduation-cap', color: '#8b5cf6', type: 'expense' },
  { id: 'cat_exp_entertainment', name: 'Giải trí', icon: 'fa-gamepad', color: '#06b6d4', type: 'expense' },
  { id: 'cat_exp_health', name: 'Y tế', icon: 'fa-heartbeat', color: '#10b981', type: 'expense' },
  { id: 'cat_exp_rent', name: 'Tiền nhà', icon: 'fa-home', color: '#6366f1', type: 'expense' },
  { id: 'cat_exp_utilities', name: 'Điện nước', icon: 'fa-bolt', color: '#eab308', type: 'expense' },
  { id: 'cat_exp_other', name: 'Khác', icon: 'fa-tag', color: '#64748b', type: 'expense' }
];
