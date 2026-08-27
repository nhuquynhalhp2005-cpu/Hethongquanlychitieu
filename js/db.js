/**
 * ==========================================================================
 * HỆ THỐNG THEO DÕI THU CHI VÀ KẾ HOẠCH TÀI CHÍNH CÁ NHÂN
 * Firestore Database & Storage Bridge (Real Firebase + Fallback Layer)
 * ==========================================================================
 */

import {
  getActiveFirebaseConfig,
  isFirebaseConfigured,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
  FIREBASE_APP_URL,
  FIREBASE_FIRESTORE_URL
} from './firebase-config.js';
import { generateId, getCurrentMonth } from './utils.js';

let firebaseApp = null;
let firestoreDb = null;
let isRealFirebaseReady = false;

// Initialize Firebase if configured
export async function initFirebaseDatabase() {
  if (isRealFirebaseReady && firestoreDb) return firestoreDb;
  
  if (isFirebaseConfigured()) {
    try {
      const { initializeApp, getApps, getApp } = await import(FIREBASE_APP_URL);
      const { getFirestore } = await import(FIREBASE_FIRESTORE_URL);
      
      const config = getActiveFirebaseConfig();
      const apps = getApps();
      firebaseApp = apps.length > 0 ? getApp() : initializeApp(config);
      firestoreDb = getFirestore(firebaseApp);
      isRealFirebaseReady = true;
      console.log('✅ Firebase Firestore connected successfully!');
      return firestoreDb;
    } catch (err) {
      console.warn('⚠️ Could not connect to real Firestore, fallback to local persistent store:', err);
      isRealFirebaseReady = false;
    }
  }
  return null;
}

// Ensure database connection is attempted
initFirebaseDatabase();

// -------------------------------------------------------------
// LOCAL STORAGE STORE HELPERS
// -------------------------------------------------------------
const STORE_PREFIX = 'fin_app_';

function getLocalCollection(collectionName) {
  try {
    const data = localStorage.getItem(STORE_PREFIX + collectionName);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalCollection(collectionName, items) {
  try {
    localStorage.setItem(STORE_PREFIX + collectionName, JSON.stringify(items));
  } catch (e) {
    console.error('Error saving local store', e);
  }
}

// -------------------------------------------------------------
// 1. TRANSACTIONS CRUD (Thu & Chi)
// -------------------------------------------------------------
export async function getTransactions(uid) {
  await initFirebaseDatabase();
  if (isRealFirebaseReady && firestoreDb) {
    try {
      const { collection, query, where, getDocs, orderBy } = await import(FIREBASE_FIRESTORE_URL);
      const q = query(
        collection(firestoreDb, 'transactions'),
        where('uid', '==', uid)
      );
      const querySnapshot = await getDocs(q);
      const list = [];
      querySnapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      // Sort by date descending
      return list.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (e) {
      console.error('Firestore getTransactions error, fallback to local', e);
    }
  }

  // Local Store
  const list = getLocalCollection('transactions').filter(item => item.uid === uid);
  return list.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export async function addTransaction(data) {
  const transactionId = data.id || generateId();
  const record = {
    ...data,
    id: transactionId,
    amount: Number(data.amount) || 0,
    createdAt: data.createdAt || new Date().toISOString()
  };

  await initFirebaseDatabase();
  if (isRealFirebaseReady && firestoreDb) {
    try {
      const { doc, setDoc } = await import(FIREBASE_FIRESTORE_URL);
      await setDoc(doc(firestoreDb, 'transactions', transactionId), record);
    } catch (e) {
      console.error('Firestore addTransaction error', e);
    }
  }

  // Local Store
  const list = getLocalCollection('transactions');
  list.unshift(record);
  saveLocalCollection('transactions', list);

  // Trigger automated notification checks for budget
  checkAndTriggerBudgetAlerts(data.uid);

  return record;
}

export async function updateTransaction(id, updateData) {
  await initFirebaseDatabase();
  if (isRealFirebaseReady && firestoreDb) {
    try {
      const { doc, updateDoc } = await import(FIREBASE_FIRESTORE_URL);
      await updateDoc(doc(firestoreDb, 'transactions', id), updateData);
    } catch (e) {
      console.error('Firestore updateTransaction error', e);
    }
  }

  // Local Store
  const list = getLocalCollection('transactions');
  const index = list.findIndex(i => i.id === id);
  if (index !== -1) {
    list[index] = { ...list[index], ...updateData };
    saveLocalCollection('transactions', list);
    checkAndTriggerBudgetAlerts(list[index].uid);
  }
}

export async function deleteTransaction(id, uid) {
  await initFirebaseDatabase();
  if (isRealFirebaseReady && firestoreDb) {
    try {
      const { doc, deleteDoc } = await import(FIREBASE_FIRESTORE_URL);
      await deleteDoc(doc(firestoreDb, 'transactions', id));
    } catch (e) {
      console.error('Firestore deleteTransaction error', e);
    }
  }

  // Local Store
  let list = getLocalCollection('transactions');
  list = list.filter(i => i.id !== id);
  saveLocalCollection('transactions', list);
  if (uid) checkAndTriggerBudgetAlerts(uid);
}

// -------------------------------------------------------------
// 2. BUDGETS CRUD (Ngân sách)
// -------------------------------------------------------------
export async function getBudgets(uid, month = null) {
  await initFirebaseDatabase();
  if (isRealFirebaseReady && firestoreDb) {
    try {
      const { collection, query, where, getDocs } = await import(FIREBASE_FIRESTORE_URL);
      const q = query(
        collection(firestoreDb, 'budgets'),
        where('uid', '==', uid)
      );
      const querySnapshot = await getDocs(q);
      let list = [];
      querySnapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      if (month) list = list.filter(b => b.month === month);
      return list;
    } catch (e) {
      console.error('Firestore getBudgets error', e);
    }
  }

  let list = getLocalCollection('budgets').filter(item => item.uid === uid);
  if (month) list = list.filter(item => item.month === month);
  return list;
}

export async function saveBudget(data) {
  const budgetId = data.id || generateId();
  const record = {
    ...data,
    id: budgetId,
    amount: Number(data.amount) || 0,
    createdAt: data.createdAt || new Date().toISOString()
  };

  await initFirebaseDatabase();
  if (isRealFirebaseReady && firestoreDb) {
    try {
      const { doc, setDoc } = await import(FIREBASE_FIRESTORE_URL);
      await setDoc(doc(firestoreDb, 'budgets', budgetId), record);
    } catch (e) {
      console.error('Firestore saveBudget error', e);
    }
  }

  const list = getLocalCollection('budgets');
  const index = list.findIndex(b => b.id === budgetId);
  if (index !== -1) {
    list[index] = record;
  } else {
    list.unshift(record);
  }
  saveLocalCollection('budgets', list);
  return record;
}

export async function deleteBudget(id) {
  await initFirebaseDatabase();
  if (isRealFirebaseReady && firestoreDb) {
    try {
      const { doc, deleteDoc } = await import(FIREBASE_FIRESTORE_URL);
      await deleteDoc(doc(firestoreDb, 'budgets', id));
    } catch (e) {
      console.error('Firestore deleteBudget error', e);
    }
  }

  let list = getLocalCollection('budgets');
  list = list.filter(b => b.id !== id);
  saveLocalCollection('budgets', list);
}

// -------------------------------------------------------------
// 3. FINANCIAL PLANS (Kế hoạch tài chính)
// -------------------------------------------------------------
export async function getFinancialPlans(uid) {
  await initFirebaseDatabase();
  if (isRealFirebaseReady && firestoreDb) {
    try {
      const { collection, query, where, getDocs } = await import(FIREBASE_FIRESTORE_URL);
      const q = query(collection(firestoreDb, 'financialPlans'), where('uid', '==', uid));
      const querySnapshot = await getDocs(q);
      const list = [];
      querySnapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      return list;
    } catch (e) {
      console.error('Firestore getFinancialPlans error', e);
    }
  }

  return getLocalCollection('financialPlans').filter(item => item.uid === uid);
}

export async function saveFinancialPlan(data) {
  const planId = data.id || generateId();
  const record = {
    ...data,
    id: planId,
    targetAmount: Number(data.targetAmount) || 0,
    currentAmount: Number(data.currentAmount) || 0,
    createdAt: data.createdAt || new Date().toISOString()
  };

  await initFirebaseDatabase();
  if (isRealFirebaseReady && firestoreDb) {
    try {
      const { doc, setDoc } = await import(FIREBASE_FIRESTORE_URL);
      await setDoc(doc(firestoreDb, 'financialPlans', planId), record);
    } catch (e) {
      console.error('Firestore saveFinancialPlan error', e);
    }
  }

  const list = getLocalCollection('financialPlans');
  const index = list.findIndex(p => p.id === planId);
  if (index !== -1) {
    list[index] = record;
  } else {
    list.unshift(record);
  }
  saveLocalCollection('financialPlans', list);
  return record;
}

export async function deleteFinancialPlan(id) {
  await initFirebaseDatabase();
  if (isRealFirebaseReady && firestoreDb) {
    try {
      const { doc, deleteDoc } = await import(FIREBASE_FIRESTORE_URL);
      await deleteDoc(doc(firestoreDb, 'financialPlans', id));
    } catch (e) {
      console.error('Firestore deleteFinancialPlan error', e);
    }
  }

  let list = getLocalCollection('financialPlans');
  list = list.filter(p => p.id !== id);
  saveLocalCollection('financialPlans', list);
}

// -------------------------------------------------------------
// 4. SAVING GOALS (Mục tiêu tiết kiệm)
// -------------------------------------------------------------
export async function getSavingGoals(uid) {
  await initFirebaseDatabase();
  if (isRealFirebaseReady && firestoreDb) {
    try {
      const { collection, query, where, getDocs } = await import(FIREBASE_FIRESTORE_URL);
      const q = query(collection(firestoreDb, 'savingGoals'), where('uid', '==', uid));
      const querySnapshot = await getDocs(q);
      const list = [];
      querySnapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      return list;
    } catch (e) {
      console.error('Firestore getSavingGoals error', e);
    }
  }

  return getLocalCollection('savingGoals').filter(item => item.uid === uid);
}

export async function saveSavingGoal(data) {
  const goalId = data.id || generateId();
  const record = {
    ...data,
    id: goalId,
    targetAmount: Number(data.targetAmount) || 0,
    savedAmount: Number(data.savedAmount) || 0,
    createdAt: data.createdAt || new Date().toISOString()
  };

  await initFirebaseDatabase();
  if (isRealFirebaseReady && firestoreDb) {
    try {
      const { doc, setDoc } = await import(FIREBASE_FIRESTORE_URL);
      await setDoc(doc(firestoreDb, 'savingGoals', goalId), record);
    } catch (e) {
      console.error('Firestore saveSavingGoal error', e);
    }
  }

  const list = getLocalCollection('savingGoals');
  const index = list.findIndex(g => g.id === goalId);
  if (index !== -1) {
    list[index] = record;
  } else {
    list.unshift(record);
  }
  saveLocalCollection('savingGoals', list);
  return record;
}

export async function depositToGoal(id, addAmount) {
  const list = getLocalCollection('savingGoals');
  const index = list.findIndex(g => g.id === id);
  if (index !== -1) {
    const goal = list[index];
    const newSaved = (Number(goal.savedAmount) || 0) + Number(addAmount);
    goal.savedAmount = newSaved;
    await saveSavingGoal(goal);
    return goal;
  }
}

export async function deleteSavingGoal(id) {
  await initFirebaseDatabase();
  if (isRealFirebaseReady && firestoreDb) {
    try {
      const { doc, deleteDoc } = await import(FIREBASE_FIRESTORE_URL);
      await deleteDoc(doc(firestoreDb, 'savingGoals', id));
    } catch (e) {
      console.error('Firestore deleteSavingGoal error', e);
    }
  }

  let list = getLocalCollection('savingGoals');
  list = list.filter(g => g.id !== id);
  saveLocalCollection('savingGoals', list);
}

// -------------------------------------------------------------
// 5. DEBTS (Khoản nợ & Cho vay)
// -------------------------------------------------------------
export async function getDebts(uid) {
  await initFirebaseDatabase();
  if (isRealFirebaseReady && firestoreDb) {
    try {
      const { collection, query, where, getDocs } = await import(FIREBASE_FIRESTORE_URL);
      const q = query(collection(firestoreDb, 'debts'), where('uid', '==', uid));
      const querySnapshot = await getDocs(q);
      const list = [];
      querySnapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      return list;
    } catch (e) {
      console.error('Firestore getDebts error', e);
    }
  }

  return getLocalCollection('debts').filter(item => item.uid === uid);
}

export async function saveDebt(data) {
  const debtId = data.id || generateId();
  const record = {
    ...data,
    id: debtId,
    totalAmount: Number(data.totalAmount) || 0,
    paidAmount: Number(data.paidAmount) || 0,
    createdAt: data.createdAt || new Date().toISOString()
  };

  await initFirebaseDatabase();
  if (isRealFirebaseReady && firestoreDb) {
    try {
      const { doc, setDoc } = await import(FIREBASE_FIRESTORE_URL);
      await setDoc(doc(firestoreDb, 'debts', debtId), record);
    } catch (e) {
      console.error('Firestore saveDebt error', e);
    }
  }

  const list = getLocalCollection('debts');
  const index = list.findIndex(d => d.id === debtId);
  if (index !== -1) {
    list[index] = record;
  } else {
    list.unshift(record);
  }
  saveLocalCollection('debts', list);
  return record;
}

export async function payDebt(id, paymentAmount) {
  const list = getLocalCollection('debts');
  const index = list.findIndex(d => d.id === id);
  if (index !== -1) {
    const debt = list[index];
    const newPaid = Math.min(debt.totalAmount, (Number(debt.paidAmount) || 0) + Number(paymentAmount));
    debt.paidAmount = newPaid;
    if (newPaid >= debt.totalAmount) {
      debt.status = 'paid';
    }
    await saveDebt(debt);
    return debt;
  }
}

export async function deleteDebt(id) {
  await initFirebaseDatabase();
  if (isRealFirebaseReady && firestoreDb) {
    try {
      const { doc, deleteDoc } = await import(FIREBASE_FIRESTORE_URL);
      await deleteDoc(doc(firestoreDb, 'debts', id));
    } catch (e) {
      console.error('Firestore deleteDebt error', e);
    }
  }

  let list = getLocalCollection('debts');
  list = list.filter(d => d.id !== id);
  saveLocalCollection('debts', list);
}

// -------------------------------------------------------------
// 6. CATEGORIES (Danh mục thu/chi)
// -------------------------------------------------------------
export async function getCategories(uid) {
  await initFirebaseDatabase();
  if (isRealFirebaseReady && firestoreDb) {
    try {
      const { collection, query, where, getDocs } = await import(FIREBASE_FIRESTORE_URL);
      const q = query(
        collection(firestoreDb, 'categories'),
        where('uid', 'in', [uid, 'system'])
      );
      const querySnapshot = await getDocs(q);
      const list = [];
      querySnapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      if (list.length > 0) return list;
    } catch (e) {
      console.error('Firestore getCategories error', e);
    }
  }

  // Local custom + defaults
  const custom = getLocalCollection('categories').filter(c => c.uid === uid || c.uid === 'system');
  if (custom.length > 0) return custom;

  // Initialize with default categories
  const allDefaults = [
    ...DEFAULT_INCOME_CATEGORIES.map(c => ({ ...c, uid: 'system' })),
    ...DEFAULT_EXPENSE_CATEGORIES.map(c => ({ ...c, uid: 'system' }))
  ];
  saveLocalCollection('categories', allDefaults);
  return allDefaults;
}

export async function saveCategory(data) {
  const categoryId = data.id || generateId();
  const record = {
    ...data,
    id: categoryId,
    createdAt: data.createdAt || new Date().toISOString()
  };

  await initFirebaseDatabase();
  if (isRealFirebaseReady && firestoreDb) {
    try {
      const { doc, setDoc } = await import(FIREBASE_FIRESTORE_URL);
      await setDoc(doc(firestoreDb, 'categories', categoryId), record);
    } catch (e) {
      console.error('Firestore saveCategory error', e);
    }
  }

  const list = getLocalCollection('categories');
  const index = list.findIndex(c => c.id === categoryId);
  if (index !== -1) {
    list[index] = record;
  } else {
    list.push(record);
  }
  saveLocalCollection('categories', list);
  return record;
}

export async function deleteCategory(id, uid) {
  // Check if any transaction is using this category
  const trans = await getTransactions(uid);
  const isUsed = trans.some(t => t.categoryId === id);
  if (isUsed) {
    throw new Error('Không thể xóa danh mục đang có giao dịch sử dụng! Vui lòng đổi danh mục cho các giao dịch trước.');
  }

  await initFirebaseDatabase();
  if (isRealFirebaseReady && firestoreDb) {
    try {
      const { doc, deleteDoc } = await import(FIREBASE_FIRESTORE_URL);
      await deleteDoc(doc(firestoreDb, 'categories', id));
    } catch (e) {
      console.error('Firestore deleteCategory error', e);
    }
  }

  let list = getLocalCollection('categories');
  list = list.filter(c => c.id !== id);
  saveLocalCollection('categories', list);
}

// -------------------------------------------------------------
// 7. NOTIFICATIONS & ALERTS
// -------------------------------------------------------------
export async function getNotifications(uid) {
  await initFirebaseDatabase();
  if (isRealFirebaseReady && firestoreDb) {
    try {
      const { collection, query, where, getDocs } = await import(FIREBASE_FIRESTORE_URL);
      const q = query(collection(firestoreDb, 'notifications'), where('uid', '==', uid));
      const querySnapshot = await getDocs(q);
      const list = [];
      querySnapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (e) {
      console.error('Firestore getNotifications error', e);
    }
  }

  return getLocalCollection('notifications')
    .filter(n => n.uid === uid)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function addNotification(uid, title, message, type = 'info') {
  const notifId = generateId();
  const record = {
    id: notifId,
    uid,
    title,
    message,
    type,
    isRead: false,
    createdAt: new Date().toISOString()
  };

  await initFirebaseDatabase();
  if (isRealFirebaseReady && firestoreDb) {
    try {
      const { doc, setDoc } = await import(FIREBASE_FIRESTORE_URL);
      await setDoc(doc(firestoreDb, 'notifications', notifId), record);
    } catch (e) {
      console.error('Firestore addNotification error', e);
    }
  }

  const list = getLocalCollection('notifications');
  list.unshift(record);
  saveLocalCollection('notifications', list);
  return record;
}

export async function markNotificationAsRead(id) {
  const list = getLocalCollection('notifications');
  const notif = list.find(n => n.id === id);
  if (notif) {
    notif.isRead = true;
    saveLocalCollection('notifications', list);
  }

  if (isRealFirebaseReady && firestoreDb) {
    try {
      const { doc, updateDoc } = await import(FIREBASE_FIRESTORE_URL);
      await updateDoc(doc(firestoreDb, 'notifications', id), { isRead: true });
    } catch (e) {}
  }
}

export async function markAllNotificationsAsRead(uid) {
  const list = getLocalCollection('notifications');
  list.forEach(n => {
    if (n.uid === uid) n.isRead = true;
  });
  saveLocalCollection('notifications', list);
}

// -------------------------------------------------------------
// AUTOMATIC BUDGET & DEADLINE ALERTS TRIGGER
// -------------------------------------------------------------
export async function checkAndTriggerBudgetAlerts(uid) {
  if (!uid) return;
  const currentMonth = getCurrentMonth();
  const [budgets, transactions, debts, goals] = await Promise.all([
    getBudgets(uid, currentMonth),
    getTransactions(uid),
    getDebts(uid),
    getSavingGoals(uid)
  ]);

  // 1. Budget Alerts
  for (const budget of budgets) {
    const spent = transactions
      .filter(t => t.type === 'expense' && t.categoryId === budget.categoryId && t.date.startsWith(currentMonth))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const ratio = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
    if (ratio >= 100) {
      await addNotification(
        uid,
        `Vượt ngân sách: ${budget.categoryName || 'Danh mục'}`,
        `Bạn đã chi tiêu ${Math.round(ratio)}% so với hạn mức ngân sách (${new Intl.NumberFormat('vi-VN').format(budget.amount)} ₫).`,
        'danger'
      );
    } else if (ratio >= 80) {
      await addNotification(
        uid,
        `Cảnh báo ngân sách: ${budget.categoryName || 'Danh mục'}`,
        `Bạn đã chi tiêu đạt ${Math.round(ratio)}% hạn mức ngân sách tháng này.`,
        'warning'
      );
    }
  }

  // 2. Debts Due Date Alerts (< 7 days)
  const now = new Date();
  for (const debt of debts) {
    if (debt.status !== 'paid' && debt.dueDate) {
      const due = new Date(debt.dueDate);
      const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 3600 * 24));
      if (diffDays >= 0 && diffDays <= 7) {
        await addNotification(
          uid,
          `Khoản nợ sắp đến hạn: ${debt.name}`,
          `Khoản nợ còn lại ${(debt.totalAmount - (debt.paidAmount || 0)).toLocaleString('vi-VN')} ₫ sẽ đến hạn vào ngày ${new Date(debt.dueDate).toLocaleDateString('vi-VN')}.`,
          'warning'
        );
      }
    }
  }
}

// -------------------------------------------------------------
// 8. ADMIN & USERS
// -------------------------------------------------------------
export async function getAllUsers() {
  await initFirebaseDatabase();
  if (isRealFirebaseReady && firestoreDb) {
    try {
      const { collection, getDocs } = await import(FIREBASE_FIRESTORE_URL);
      const querySnapshot = await getDocs(collection(firestoreDb, 'users'));
      const list = [];
      querySnapshot.forEach(doc => list.push({ uid: doc.id, ...doc.data() }));
      if (list.length > 0) return list;
    } catch (e) {
      console.error('Firestore getAllUsers error', e);
    }
  }

  return getLocalCollection('users');
}

export async function updateUserRole(uid, newRole) {
  const users = getLocalCollection('users');
  const u = users.find(user => user.uid === uid);
  if (u) {
    u.role = newRole;
    saveLocalCollection('users', users);
  }

  if (isRealFirebaseReady && firestoreDb) {
    try {
      const { doc, updateDoc } = await import(FIREBASE_FIRESTORE_URL);
      await updateDoc(doc(firestoreDb, 'users', uid), { role: newRole });
    } catch (e) {}
  }
}

export async function toggleLockUser(uid, isLocked) {
  const users = getLocalCollection('users');
  const u = users.find(user => user.uid === uid);
  if (u) {
    u.isLocked = isLocked;
    saveLocalCollection('users', users);
  }

  if (isRealFirebaseReady && firestoreDb) {
    try {
      const { doc, updateDoc } = await import(FIREBASE_FIRESTORE_URL);
      await updateDoc(doc(firestoreDb, 'users', uid), { isLocked });
    } catch (e) {}
  }
}

export async function getSystemStats() {
  const users = await getAllUsers();
  const allTrans = getLocalCollection('transactions');
  const totalIncome = allTrans.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const totalExpense = allTrans.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amount) || 0), 0);

  return {
    totalUsers: users.length,
    newUsersThisMonth: users.filter(u => u.createdAt && u.createdAt.startsWith(getCurrentMonth())).length,
    totalTransactions: allTrans.length,
    totalIncome,
    totalExpense
  };
}
