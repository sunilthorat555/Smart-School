import React, { useState, useEffect } from 'react';
import { auth, onAuthStateChanged, db, doc, getDoc, OperationType, handleFirestoreError } from './firebase';
import { UserProfile } from './types';
import { Auth } from './components/Auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Dashboard } from './components/Dashboard';
import { Loader2 } from 'lucide-react';
import { Toaster } from 'sonner';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // For demo/preview purposes
  const handleDemoLogin = (role: 'admin' | 'teacher' | 'parent') => {
    const demoUser: UserProfile = {
      uid: `demo-${role}`,
      email: `demo-${role}@example.com`,
      name: `Demo ${role.charAt(0).toUpperCase() + role.slice(1)}`,
      role: role,
      schoolId: 'demo-school-1',
      childId: role === 'parent' ? 'demo-student-1' : undefined,
      createdAt: new Date().toISOString(),
    };
    setUser(demoUser);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            setUser(userDoc.data() as UserProfile);
          } else {
            console.error('User profile not found in Firestore');
            setUser(null);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        // Only clear if not in demo mode
        if (!user?.uid.startsWith('demo-')) {
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Toaster position="top-right" richColors />
      {user ? (
        <Dashboard 
          user={user} 
          onLogout={() => setUser(null)} 
          onRoleSwitch={(role) => handleDemoLogin(role)}
        />
      ) : (
        <Auth onDemoLogin={handleDemoLogin} />
      )}
    </ErrorBoundary>
  );
}
