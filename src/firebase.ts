import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, onSnapshot, Timestamp, getDocFromServer, addDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { format, subDays } from 'date-fns';
import { toast } from 'sonner';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app, `gs://${firebaseConfig.storageBucket}`);
export const googleProvider = new GoogleAuthProvider();

// Operation types for error handling
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  // Check for specific Firestore internal errors that might be transient or related to rapid state changes
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  if (errorMessage.includes('INTERNAL ASSERTION FAILED')) {
    console.warn('Firestore Internal Assertion Failure detected. This may be transient.');
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  // Only throw if it's a permission error or a fatal error we can't recover from
  throw new Error(JSON.stringify(errInfo));
}

// Test connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
  }
}
testConnection();

export const seedDemoData = async () => {
  try {
    // Check if already seeded
    const classesSnap = await getDocs(collection(db, 'classes'));
    if (!classesSnap.empty) {
      toast.info('Demo data already exists');
      return;
    }

    // 0. Create Schools
    const schoolRef = await addDoc(collection(db, 'schools'), {
      name: 'Smart Academy',
      address: '123 Education St, Knowledge City',
      phone: '+1 234 567 890',
      email: 'info@smartacademy.edu',
      id: 'demo-school-1'
    });

    // 1. Create Classes
    const class1Ref = await addDoc(collection(db, 'classes'), {
      name: 'Class 10-A',
      teacherName: 'John Doe',
      studentCount: 5,
      schoolId: 'demo-school-1'
    });
    const class2Ref = await addDoc(collection(db, 'classes'), {
      name: 'Class 12-B',
      teacherName: 'Jane Smith',
      studentCount: 3,
      schoolId: 'demo-school-1'
    });

    // 2. Create Students
    const studentData = [
      { 
        name: 'Ayushmant Thorat', 
        rollNumber: '101', 
        classId: class1Ref.id, 
        uid: 'demo-student-1',
        photoUrl: 'https://picsum.photos/seed/student1/200/200',
        schoolId: 'demo-school-1'
      },
      { name: 'Bob Smith', rollNumber: '102', classId: class1Ref.id, uid: 'demo-student-2', schoolId: 'demo-school-1' },
      { name: 'Charlie Brown', rollNumber: '103', classId: class1Ref.id, uid: 'demo-student-3', schoolId: 'demo-school-1' },
      { name: 'David Wilson', rollNumber: '104', classId: class1Ref.id, uid: 'demo-student-4', schoolId: 'demo-school-1' },
      { name: 'Eve Davis', rollNumber: '105', classId: class1Ref.id, uid: 'demo-student-5', schoolId: 'demo-school-1' },
      { name: 'Frank Miller', rollNumber: '201', classId: class2Ref.id, uid: 'demo-student-6', schoolId: 'demo-school-1' },
      { name: 'Grace Lee', rollNumber: '202', classId: class2Ref.id, uid: 'demo-student-7', schoolId: 'demo-school-1' },
      { name: 'Henry Ford', rollNumber: '203', classId: class2Ref.id, uid: 'demo-student-8', schoolId: 'demo-school-1' },
    ];

    for (const student of studentData) {
      await addDoc(collection(db, 'students'), student);
    }

    // 3. Create Attendance for last 7 days
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = subDays(today, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // Class 10-A attendance
      const records1: any = {};
      studentData.filter(s => s.classId === class1Ref.id).forEach(s => {
        records1[s.uid] = Math.random() > 0.2 ? 'present' : 'absent';
      });
      
      await addDoc(collection(db, 'attendance'), {
        classId: class1Ref.id,
        date: dateStr,
        session: 'Morning',
        records: records1
      });

      // Class 12-B attendance
      const records2: any = {};
      studentData.filter(s => s.classId === class2Ref.id).forEach(s => {
        records2[s.uid] = Math.random() > 0.1 ? 'present' : 'absent';
      });

      await addDoc(collection(db, 'attendance'), {
        classId: class2Ref.id,
        date: dateStr,
        session: 'Morning',
        records: records2
      });
    }

    // 4. Create Announcements
    await addDoc(collection(db, 'announcements'), {
      title: 'Welcome to SmartAttend',
      content: 'Experience the future of school management with our real-time attendance and communication platform.',
      date: new Date().toISOString(),
      authorId: 'demo-principal',
      targetClassId: null,
      isBanner: true,
      imageUrl: 'https://picsum.photos/seed/school/1920/1080',
      schoolId: 'demo-school-1'
    });

    await addDoc(collection(db, 'announcements'), {
      title: 'Annual Sports Day',
      content: 'The annual sports day will be held on April 15th. All students are required to participate.',
      date: new Date().toISOString(),
      authorId: 'demo-principal',
      targetClassId: null,
      schoolId: 'demo-school-1'
    });

    await addDoc(collection(db, 'announcements'), {
      title: 'Math Quiz Next Week',
      content: 'There will be a surprise math quiz for Class 10-A next Wednesday.',
      date: new Date().toISOString(),
      authorId: 'demo-teacher',
      targetClassId: class1Ref.id,
      schoolId: 'demo-school-1'
    });

    toast.success('Demo data seeded successfully!');
  } catch (err) {
    console.error('Error seeding data:', err);
    toast.error('Failed to seed demo data');
  }
};

export const restoreDefaultBanners = async () => {
  try {
    await addDoc(collection(db, 'announcements'), {
      title: 'Welcome to SmartAttend',
      content: 'Experience the future of school management with our real-time attendance and communication platform.',
      date: new Date().toISOString(),
      authorId: 'demo-principal',
      targetClassId: null,
      isBanner: true,
      imageUrl: 'https://picsum.photos/seed/school/1920/1080'
    });
    toast.success('Default banner restored successfully!');
  } catch (err) {
    console.error('Error restoring banner:', err);
    toast.error('Failed to restore default banner');
  }
};

export { signInWithPopup, signOut, onAuthStateChanged, signInAnonymously, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, onSnapshot, Timestamp, addDoc, ref, uploadBytes, getDownloadURL };
export type { FirebaseUser };
