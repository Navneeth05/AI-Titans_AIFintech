import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../services/firebase';
import { saveUserProfile, getUserProfile } from '../services/firestore';

const AuthContext = createContext(null);

const DEV_USER = { uid: 'dev-user', email: 'dev@finsmart.local', displayName: 'Demo User', bank: 'HDFC Bank' };

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(undefined); // undefined = loading

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      console.warn("[Auth] Firebase not configured — using dev mock user.");
      setUser(DEV_USER);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        return;
      }

      // Save/update user profile in Firestore on every login
      try {
        await saveUserProfile(firebaseUser.uid, {
          email:       firebaseUser.email,
          displayName: firebaseUser.displayName ?? '',
          photoURL:    firebaseUser.photoURL ?? '',
          lastLogin:   new Date().toISOString(),
        });
        
        // Fetch full profile (including bank)
        const profile = await getUserProfile(firebaseUser.uid);
        setUser({ ...firebaseUser, ...profile });
      } catch (err) {
        console.warn("[Firestore] Could not save/fetch user profile:", err.message);
        setUser(firebaseUser); // fallback
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isFirebaseConfigured }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
