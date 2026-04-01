export type UserRole = 'admin' | 'teacher' | 'parent';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  schoolId?: string;
  classId?: string;
  rollNumber?: string;
  childId?: string; // For parent role
  createdAt: string;
}

export interface SchoolData {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  createdAt: string;
}

export interface ClassData {
  id: string;
  name: string;
  schoolId: string;
  teacherId: string;
  studentCount: number;
}

export interface StudentData {
  id: string;
  uid: string; // Added to match UserProfile uid
  name: string;
  rollNumber: string;
  classId: string;
  schoolId: string;
  photoUrl?: string;
  parentEmail?: string;
  parentPhone?: string;
  dateOfBirth?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  faceDescriptor?: number[]; // Added for face recognition
}

export interface AttendanceRecord {
  id: string;
  date: string;
  classId: string;
  schoolId: string;
  sessionId: 'morning' | 'afternoon' | 'subject';
  sessionName: string;
  records: Record<string, 'present' | 'absent' | 'late'>;
  timeRecords?: Record<string, string[]>; // Store multiple times of marking
  markedBy: string;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  targetClassId?: string;
  schoolId?: string;
  authorId: string;
  isBanner?: boolean;
  type?: 'info' | 'warning' | 'urgent';
  imageUrl?: string;
}

export type ExamType = 'Unit Test' | 'Semester Exam' | 'Practice Test';
export type ExamFormat = 'MCQ' | 'Subjective';

export interface MCQQuestion {
  id: string;
  question: string;
  options: string[]; // 4 options
  correctOptionIndex: number; // 0-3
  marks: number;
}

export interface Exam {
  id: string;
  title: string;
  type: ExamType;
  format: ExamFormat;
  classId: string;
  schoolId: string;
  subject: string;
  date: string; // Start date/time
  startTime: string; // ISO
  endTime: string; // ISO
  maxMarks: number;
  questions?: MCQQuestion[]; // For MCQ
  questionPaperUrl?: string; // For Subjective (PDF/Image)
  authorId: string;
  createdAt: string;
}

export interface ExamResult {
  id: string;
  examId: string;
  studentId: string; // student uid
  schoolId: string;
  marksObtained: number;
  answers?: number[]; // For MCQ: array of selected option indices
  answerSheetUrls?: string[]; // For Subjective: array of image URLs
  status: 'Pending' | 'Graded';
  remarks?: string;
  createdAt: string;
}

export interface Homework {
  id: string;
  title: string;
  description: string;
  classId: string;
  schoolId: string;
  subject: string;
  dueDate: string;
  pdfUrl?: string; // Base64 or URL
  pdfName?: string;
  authorId: string;
  createdAt: string;
}

export interface EBook {
  id: string;
  title: string;
  subject: string;
  classId?: string; // Optional, can be school-wide
  schoolId: string;
  pdfUrl: string; // Base64 or URL
  pdfName: string;
  authorId: string;
  createdAt: string;
}

export interface QuickLink {
  id: string;
  title: string;
  url: string;
  iconUrl?: string;
  authorId: string;
  schoolId: string;
  createdAt: string;
}
