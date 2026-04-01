import React, { useState } from 'react';
import { auth, googleProvider, signInWithPopup, doc, getDoc, setDoc, db, OperationType, handleFirestoreError, seedDemoData } from '../firebase';
import { UserProfile } from '../types';
import { LogIn, School, GraduationCap, UserCheck, Heart } from 'lucide-react';
import { motion } from 'motion/react';

interface AuthProps {
  onDemoLogin: (role: 'admin' | 'teacher' | 'parent') => void;
}

export const Auth: React.FC<AuthProps> = ({ onDemoLogin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedRole, setSelectedRole] = useState<'admin' | 'teacher' | 'parent'>('admin');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check if user profile exists in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      let userDoc;
      try {
        userDoc = await getDoc(userDocRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      }

      if (!userDoc?.exists()) {
        // Create new user profile if it doesn't exist
        const newUser: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          name: user.displayName || 'Anonymous User',
          role: selectedRole,
          createdAt: new Date().toISOString(),
        };
        try {
          await setDoc(userDocRef, newUser);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { id: 'admin', label: 'Admin', icon: School, color: 'blue', desc: 'Manage schools, classes & teachers' },
    { id: 'teacher', label: 'Teacher', icon: UserCheck, color: 'indigo', desc: 'Mark attendance & view reports' },
    { id: 'parent', label: 'Parent', icon: Heart, color: 'rose', desc: "Monitor child's attendance" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-8 text-center">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-100">
            <GraduationCap className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Smart Attendance</h1>
          <p className="text-gray-500 mb-8">Select your role to continue</p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          {/* Role Tabs */}
          <div className="flex p-1 bg-gray-100 rounded-2xl mb-8">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role.id as any)}
                className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${
                  selectedRole === role.id 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>

          {/* Selected Role Card */}
          <div className="mb-8 p-6 bg-gray-50 rounded-3xl border border-gray-100">
            {roles.map((role) => selectedRole === role.id && (
              <motion.div 
                key={role.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center"
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
                  role.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                  role.color === 'indigo' ? 'bg-indigo-100 text-indigo-600' :
                  'bg-rose-100 text-rose-600'
                }`}>
                  <role.icon className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-1">{role.label}</h3>
                <p className="text-sm text-gray-500">{role.desc}</p>
              </motion.div>
            ))}
          </div>

          <div className="space-y-4">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center p-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
            >
              <LogIn className="w-5 h-5 mr-2" />
              {loading ? 'Signing in...' : 'Sign in with Google'}
            </button>

            <button
              onClick={() => onDemoLogin(selectedRole)}
              disabled={loading}
              className="w-full flex items-center justify-center p-4 bg-white text-gray-700 border border-gray-200 rounded-2xl font-bold hover:bg-gray-50 transition-all"
            >
              Try Demo Mode
            </button>
          </div>

          <div className="mt-8 text-xs text-gray-400">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </div>
        </div>
      </motion.div>
    </div>
  );
};
