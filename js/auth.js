/**
 * ==========================================================================
 * HỆ THỐNG THEO DÕI THU CHI VÀ KẾ HOẠCH TÀI CHÍNH CÁ NHÂN
 * Firebase Authentication & User Session Management
 * ==========================================================================
 */

import {
  getActiveFirebaseConfig,
  isFirebaseConfigured,
  FIREBASE_APP_URL,
  FIREBASE_AUTH_URL,
  FIREBASE_FIRESTORE_URL
} from './firebase-config.js';
import { generateId, showToast } from './utils.js';

const SESSION_USER_KEY = 'fin_current_user';
const LOCAL_USERS_KEY = 'fin_app_users';

let firebaseAuth = null;
let firebaseApp = null;

// Initialize Firebase Auth
export async function initFirebaseAuth() {
  if (firebaseAuth) return firebaseAuth;

  if (isFirebaseConfigured()) {
    try {
      const { initializeApp, getApps, getApp } = await import(FIREBASE_APP_URL);
      const { getAuth } = await import(FIREBASE_AUTH_URL);
      
      const config = getActiveFirebaseConfig();
      const apps = getApps();
      firebaseApp = apps.length > 0 ? getApp() : initializeApp(config);
      firebaseAuth = getAuth(firebaseApp);
      return firebaseAuth;
    } catch (e) {
      console.warn('Firebase Auth initialization error, running in local auth mode:', e);
    }
  }
  return null;
}

// -------------------------------------------------------------
// GET CURRENT USER SESSION
// -------------------------------------------------------------
export function getCurrentUser() {
  try {
    const raw = localStorage.getItem(SESSION_USER_KEY) || sessionStorage.getItem(SESSION_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setCurrentUser(user, rememberMe = true) {
  const json = JSON.stringify(user);
  if (rememberMe) {
    localStorage.setItem(SESSION_USER_KEY, json);
  } else {
    sessionStorage.setItem(SESSION_USER_KEY, json);
  }
}

export function clearUserSession() {
  localStorage.removeItem(SESSION_USER_KEY);
  sessionStorage.removeItem(SESSION_USER_KEY);
}

// Helper: Local users list
function getLocalUsers() {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalUsers(users) {
  try {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Error saving local users', e);
  }
}

// Ensure at least default Admin & User exist for local testing
function ensureDefaultTestAccounts() {
  const users = getLocalUsers();
  let changed = false;

  const defaultAccounts = [
    {
      uid: 'user_admin_01',
      name: 'Quản Trị Viên (Admin)',
      email: 'admin@gmail.com',
      password: 'admin',
      role: 'admin',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isLocked: false,
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      uid: 'user_admin_02',
      name: 'Quản Trị Viên Demo',
      email: 'admin@demo.com',
      password: 'admin',
      role: 'admin',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      isLocked: false,
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      uid: 'user_demo_01',
      name: 'Nguyễn Văn An',
      email: 'user@finance.vn',
      password: 'User@123456',
      role: 'user',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      isLocked: false,
      createdAt: '2026-08-01T00:00:00.000Z'
    },
    {
      uid: 'user_demo_02',
      name: 'Người Dùng Thử Nghiệm',
      email: 'user@demo.com',
      password: '123456',
      role: 'user',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      isLocked: false,
      createdAt: '2026-08-01T00:00:00.000Z'
    }
  ];

  for (const acc of defaultAccounts) {
    const idx = users.findIndex(u => u.email.toLowerCase() === acc.email.toLowerCase());
    if (idx === -1) {
      users.push(acc);
      changed = true;
    } else if (acc.email.toLowerCase() === 'admin@gmail.com') {
      // Ensure password and role are always synced
      if (users[idx].password !== acc.password || users[idx].role !== acc.role) {
        users[idx].password = acc.password;
        users[idx].role = acc.role;
        changed = true;
      }
    }
  }

  if (changed) {
    saveLocalUsers(users);
  }
}

ensureDefaultTestAccounts();

// -------------------------------------------------------------
// REGISTER USER
// -------------------------------------------------------------
export async function registerUser(arg1, arg2, arg3, arg4) {
  let name, email, password, confirmPassword;
  if (typeof arg1 === 'object' && arg1 !== null) {
    ({ name, email, password, confirmPassword } = arg1);
  } else {
    name = arg1;
    email = arg2;
    password = arg3;
    confirmPassword = arg4 !== undefined ? arg4 : password;
  }

  // 1. Validations
  if (!name || !name.trim()) throw new Error('Vui lòng nhập họ và tên.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email không hợp lệ.');
  if (!password || password.length < 6) throw new Error('Mật khẩu phải có ít nhất 6 ký tự.');
  if (confirmPassword && password !== confirmPassword) throw new Error('Mật khẩu xác nhận không khớp.');

  // Try Firebase Auth if configured
  await initFirebaseAuth();
  if (isFirebaseConfigured() && firebaseAuth) {
    try {
      const { createUserWithEmailAndPassword, updateProfile } = await import(FIREBASE_AUTH_URL);
      const { getFirestore, doc, setDoc } = await import(FIREBASE_FIRESTORE_URL);

      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: name });

      // Save user doc in Firestore
      const db = getFirestore(firebaseApp);
      const userData = {
        uid: user.uid,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: 'user',
        avatar: '',
        isLocked: false,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'users', user.uid), userData);

      // Save session
      setCurrentUser(userData, true);
      return userData;
    } catch (firebaseErr) {
      if (firebaseErr.code === 'auth/email-already-in-use') {
        throw new Error('Email này đã được đăng ký tài khoản!');
      }
      throw new Error(firebaseErr.message || 'Lỗi đăng ký Firebase.');
    }
  }

  // Fallback to local accounts
  const users = getLocalUsers();
  if (users.some(u => u.email.toLowerCase() === email.trim().toLowerCase())) {
    throw new Error('Email này đã được sử dụng!');
  }

  const newUser = {
    uid: generateId(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password: password,
    role: 'user',
    avatar: '',
    isLocked: false,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveLocalUsers(users);

  // Set session
  const sessionUser = { ...newUser };
  delete sessionUser.password;
  setCurrentUser(sessionUser, true);

  return sessionUser;
}

// -------------------------------------------------------------
// LOGIN USER
// -------------------------------------------------------------
export async function loginUser(arg1, arg2, arg3 = true) {
  let email, password, rememberMe;
  if (typeof arg1 === 'object' && arg1 !== null) {
    email = arg1.email;
    password = arg1.password;
    rememberMe = arg1.rememberMe !== undefined ? arg1.rememberMe : true;
  } else {
    email = arg1;
    password = arg2;
    rememberMe = arg3;
  }

  if (!email || !password) throw new Error('Vui lòng nhập đầy đủ Email và Mật khẩu.');

  // Try Firebase Auth
  await initFirebaseAuth();
  if (isFirebaseConfigured() && firebaseAuth) {
    try {
      const { signInWithEmailAndPassword } = await import(FIREBASE_AUTH_URL);
      const { getFirestore, doc, getDoc } = await import(FIREBASE_FIRESTORE_URL);

      const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      const user = userCredential.user;

      // Fetch user doc from Firestore
      const db = getFirestore(firebaseApp);
      const docSnap = await getDoc(doc(db, 'users', user.uid));
      
      let userData = {
        uid: user.uid,
        name: user.displayName || email.split('@')[0],
        email: user.email,
        role: 'user',
        avatar: user.photoURL || '',
        isLocked: false,
        createdAt: new Date().toISOString()
      };

      if (docSnap.exists()) {
        userData = { ...userData, ...docSnap.data() };
      }

      if (userData.isLocked) {
        throw new Error('Tài khoản của bạn đã bị tạm khóa bởi Quản trị viên!');
      }

      setCurrentUser(userData, rememberMe);
      return userData;
    } catch (fbErr) {
      if (fbErr.code === 'auth/wrong-password' || fbErr.code === 'auth/user-not-found' || fbErr.code === 'auth/invalid-credential') {
        throw new Error('Email hoặc mật khẩu không chính xác.');
      }
      throw new Error(fbErr.message || 'Lỗi đăng nhập Firebase.');
    }
  }

  // Fallback local accounts
  const users = getLocalUsers();
  const found = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());

  if (!found || found.password !== password) {
    throw new Error('Email hoặc mật khẩu không chính xác.');
  }

  if (found.isLocked) {
    throw new Error('Tài khoản của bạn đã bị tạm khóa bởi Quản trị viên!');
  }

  const sessionUser = { ...found };
  delete sessionUser.password;
  setCurrentUser(sessionUser, rememberMe);

  return sessionUser;
}

// -------------------------------------------------------------
// RESET PASSWORD
// -------------------------------------------------------------
export async function resetPassword(email) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Vui lòng nhập Email hợp lệ để nhận liên kết đặt lại mật khẩu.');
  }

  await initFirebaseAuth();
  if (isFirebaseConfigured() && firebaseAuth) {
    try {
      const { sendPasswordResetEmail } = await import(FIREBASE_AUTH_URL);
      await sendPasswordResetEmail(firebaseAuth, email);
      return true;
    } catch (fbErr) {
      throw new Error(fbErr.message || 'Lỗi gửi email reset mật khẩu.');
    }
  }

  // Local check
  const users = getLocalUsers();
  const found = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!found) {
    throw new Error('Không tìm thấy tài khoản tương ứng với Email này trong hệ thống.');
  }

  return true;
}

// -------------------------------------------------------------
// LOGOUT USER
// -------------------------------------------------------------
export async function logoutUser() {
  clearUserSession();
  try {
    if (isFirebaseConfigured() && firebaseAuth) {
      const { signOut } = await import(FIREBASE_AUTH_URL);
      await signOut(firebaseAuth);
    }
  } catch (e) {
    console.error('Firebase signOut error', e);
  }
  window.location.href = '/login.html';
}

// -------------------------------------------------------------
// PAGE AUTH GUARDS
// -------------------------------------------------------------
export function requireAuth() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = '/login.html';
    return null;
  }
  return user;
}

export function requireAdmin() {
  const user = requireAuth();
  if (!user) return null;
  if (user.role !== 'admin') {
    showToast('Bạn không có quyền truy cập trang Quản trị!', 'error');
    setTimeout(() => {
      window.location.href = '/dashboard.html';
    }, 1200);
    return null;
  }
  return user;
}

// -------------------------------------------------------------
// UPDATE USER PROFILE
// -------------------------------------------------------------
export async function updateUserProfile({ name, avatar, newPassword }) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('Chưa đăng nhập!');

  if (name) currentUser.name = name.trim();
  if (avatar !== undefined) currentUser.avatar = avatar.trim();

  // Update in local store
  const users = getLocalUsers();
  const idx = users.findIndex(u => u.uid === currentUser.uid);
  if (idx !== -1) {
    if (name) users[idx].name = name.trim();
    if (avatar !== undefined) users[idx].avatar = avatar.trim();
    if (newPassword && newPassword.length >= 6) {
      users[idx].password = newPassword;
    }
    saveLocalUsers(users);
  }

  // Update in Firestore if configured
  if (isFirebaseConfigured()) {
    try {
      const { getFirestore, doc, updateDoc } = await import(FIREBASE_FIRESTORE_URL);
      const db = getFirestore(firebaseApp);
      const updateData = {};
      if (name) updateData.name = name.trim();
      if (avatar !== undefined) updateData.avatar = avatar.trim();
      await updateDoc(doc(db, 'users', currentUser.uid), updateData);
    } catch (e) {
      console.error('Firestore user profile update error', e);
    }
  }

  setCurrentUser(currentUser, true);
  return currentUser;
}
