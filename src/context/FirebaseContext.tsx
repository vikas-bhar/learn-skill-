import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, formatFirebaseUserError, googleProvider } from '../lib/firebase';
import {
  ensureUserAccount,
  SavedLearningPath,
  subscribeUserLearningPaths,
  subscribeUserScoreProfile,
} from '../lib/learningStore';
import { LearnerScoreProfile } from '../types/learning';

const EMPTY_SCORES: LearnerScoreProfile = {
  totalScore: 0,
  testsCompleted: 0,
  videosCompleted: 0,
  certificatesEarned: 0,
};

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  authLoading: boolean;
  authError: string | null;
  savedPaths: SavedLearningPath[];
  scoreProfile: LearnerScoreProfile;
  activePathId: string | null;
  setActivePathId: (id: string | null) => void;
  signInWithGoogle: () => Promise<User | null>;
  signOutUser: () => Promise<void>;
  clearAuthError: () => void;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [savedPaths, setSavedPaths] = useState<SavedLearningPath[]>([]);
  const [scoreProfile, setScoreProfile] = useState<LearnerScoreProfile>(EMPTY_SCORES);
  const [activePathId, setActivePathId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setSavedPaths([]);
        setScoreProfile(EMPTY_SCORES);
        setActivePathId(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;
    let active = true;
    let unsubPaths: (() => void) | null = null;
    let unsubScores: (() => void) | null = null;

    void (async () => {
      try {
        await ensureUserAccount(user);
        if (!active) return;
        unsubPaths = subscribeUserLearningPaths(
          user.uid,
          (paths) => {
            if (!active) return;
            setSavedPaths(paths);
          },
          (err) => {
            if (!active) return;
            setAuthError(formatFirebaseUserError(err));
          }
        );
        unsubScores = subscribeUserScoreProfile(
          user.uid,
          (scores) => {
            if (!active) return;
            setScoreProfile(scores);
          },
          (err) => {
            if (!active) return;
            setAuthError(formatFirebaseUserError(err));
          }
        );
      } catch (err) {
        if (!active) return;
        setAuthError(formatFirebaseUserError(err));
      }
    })();

    return () => {
      active = false;
      if (unsubPaths) unsubPaths();
      if (unsubScores) unsubScores();
    };
  }, [authReady, user]);

  const signInWithGoogle = useCallback(async (): Promise<User | null> => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await ensureUserAccount(cred.user);
      return cred.user;
    } catch (err) {
      setAuthError(formatFirebaseUserError(err));
      return null;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const signOutUser = useCallback(async (): Promise<void> => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signOut(auth);
      setSavedPaths([]);
      setScoreProfile(EMPTY_SCORES);
      setActivePathId(null);
    } catch (err) {
      setAuthError(formatFirebaseUserError(err));
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authReady,
        authLoading,
        authError,
        savedPaths,
        scoreProfile,
        activePathId,
        setActivePathId,
        signInWithGoogle,
        signOutUser,
        clearAuthError,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used inside FirebaseProvider');
  }
  return ctx;
}
