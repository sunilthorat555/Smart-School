import React from 'react';
import { UserProfile, ClassData, StudentData, AttendanceRecord, Announcement, Homework, Exam, ExamResult, EBook, SchoolData } from '../../types';
import { 
  Users, 
  BookOpen, 
  UserCheck, 
  UserMinus, 
  TrendingUp, 
  Calendar as CalendarIcon,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Download,
  Heart,
  GraduationCap,
  BarChart3,
  ClipboardList,
  Pencil,
  CheckCircle2,
  Info,
  Book,
  Link as LinkIcon,
  Zap
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { format, subDays, isSameDay, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import AboutUs from './AboutUs';
import { QuickLinks } from '../QuickLinks';

interface Props {
  user: UserProfile;
  classes: ClassData[];
  students: StudentData[];
  attendance: AttendanceRecord[];
  announcements: Announcement[];
  homework: Homework[];
  ebooks: EBook[];
  exams: Exam[];
  examResults: ExamResult[];
  schools: SchoolData[];
  onViewChange?: (view: string) => void;
}

export const Overview: React.FC<Props> = ({ user, classes, students, attendance, announcements, homework, ebooks, exams, examResults, schools, onViewChange }) => {
  const isParent = user.role === 'parent';
  const isAdmin = user.role === 'admin';

  // For parents and students, we use their UID
  const targetStudentUid = isParent ? user.childId : (user.role === 'student' ? user.uid : undefined);
  const targetStudent = students.find(s => s.uid === targetStudentUid);

  const [activeTab, setActiveTab] = React.useState((isParent || user.role === 'teacher') ? 'actions' : 'stats');
  const [selectedSchoolId, setSelectedSchoolId] = React.useState<string>(user.schoolId || 'all');

  // Filter data based on selected school (for admin) or user's school
  const effectiveSchoolId = isAdmin ? selectedSchoolId : user.schoolId;
  
  const filteredStudents = (effectiveSchoolId && effectiveSchoolId !== 'all') 
    ? students.filter(s => s.schoolId === effectiveSchoolId) 
    : students;
    
  const filteredClasses = (effectiveSchoolId && effectiveSchoolId !== 'all') 
    ? classes.filter(c => c.schoolId === effectiveSchoolId) 
    : classes;
    
  const filteredAttendance = (effectiveSchoolId && effectiveSchoolId !== 'all') 
    ? attendance.filter(a => a.schoolId === effectiveSchoolId) 
    : attendance;

  const filteredExams = (effectiveSchoolId && effectiveSchoolId !== 'all')
    ? exams.filter(e => e.schoolId === effectiveSchoolId)
    : exams;

  const filteredExamResults = (effectiveSchoolId && effectiveSchoolId !== 'all')
    ? examResults.filter(r => {
        const exam = exams.find(e => e.id === r.examId);
        return exam?.schoolId === effectiveSchoolId;
      })
    : examResults;

  // Upcoming Exams for Student/Parent
  const upcomingExams = React.useMemo(() => {
    const isStudent = user.role === 'student';
    if (!isParent && !isStudent) return [];
    if (!targetStudent) return [];
    return exams
      .filter(e => e.classId === targetStudent.classId && new Date(e.endTime) > new Date())
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 3);
  }, [isParent, user.role, targetStudent, exams]);

  // Recent Results for Student/Parent
  const recentResults = React.useMemo(() => {
    const isStudent = user.role === 'student';
    if (!isParent && !isStudent) return [];
    if (!targetStudent) return [];
    return examResults
      .filter(r => r.studentId === targetStudent.uid)
      .map(r => ({
        ...r,
        exam: exams.find(e => e.id === r.examId)
      }))
      .filter(r => r.exam)
      .sort((a, b) => new Date(b.gradedAt || b.submittedAt).getTime() - new Date(a.gradedAt || a.submittedAt).getTime())
      .slice(0, 3);
  }, [isParent, user.role, targetStudent, examResults, exams]);

  // Admin/Teacher Stats
  const totalStudents = filteredStudents.length;
  const totalClasses = filteredClasses.length;
  
  // Today's attendance (Filtered)
  const today = new Date().toISOString().split('T')[0];
  const todayAttendance = filteredAttendance.filter(a => a.date === today);
  
  let presentToday = 0;
  let absentToday = 0;
  
  todayAttendance.forEach(a => {
    Object.values(a.records).forEach(status => {
      if (status === 'present') presentToday++;
      else if (status === 'absent') absentToday++;
    });
  });

  const schoolAttendanceRate = totalStudents > 0 ? Math.round((presentToday / (presentToday + absentToday || 1)) * 100) : 0;

  // Exam Stats for Admin
  const examStats = React.useMemo(() => {
    if (filteredExams.length === 0) return { avgPassRate: 0, avgMarks: 0 };
    
    let totalPassRate = 0;
    let totalAvgMarks = 0;
    let examsWithResults = 0;

    filteredExams.forEach(exam => {
      const results = filteredExamResults.filter(r => r.examId === exam.id);
      if (results.length > 0) {
        const passCount = results.filter(r => (r.marksObtained / exam.totalMarks) * 100 >= 35).length;
        const passRate = (passCount / results.length) * 100;
        const avgMarks = (results.reduce((acc, curr) => acc + curr.marksObtained, 0) / results.length);
        const normalizedAvgMarks = (avgMarks / exam.totalMarks) * 100;

        totalPassRate += passRate;
        totalAvgMarks += normalizedAvgMarks;
        examsWithResults++;
      }
    });

    return {
      avgPassRate: examsWithResults > 0 ? Math.round(totalPassRate / examsWithResults) : 0,
      avgMarks: examsWithResults > 0 ? Math.round(totalAvgMarks / examsWithResults) : 0
    };
  }, [filteredExams, filteredExamResults]);

  // School-wise comparison data for Admin
  const schoolWiseData = React.useMemo(() => {
    if (!isAdmin || selectedSchoolId !== 'all') return [];

    return schools.map(school => {
      const schoolStudents = students.filter(s => s.schoolId === school.id);
      const schoolAttendance = attendance.filter(a => a.schoolId === school.id);
      const schoolExams = exams.filter(e => e.schoolId === school.id);
      
      // Attendance Rate
      let present = 0;
      let total = 0;
      schoolAttendance.forEach(a => {
        Object.values(a.records).forEach(status => {
          if (status === 'present') present++;
          total++;
        });
      });
      const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

      // Exam Stats
      let totalPassRate = 0;
      let examsWithResults = 0;
      schoolExams.forEach(exam => {
        const results = examResults.filter(r => r.examId === exam.id);
        if (results.length > 0) {
          const passCount = results.filter(r => (r.marksObtained / exam.totalMarks) * 100 >= 35).length;
          totalPassRate += (passCount / results.length) * 100;
          examsWithResults++;
        }
      });
      const passRate = examsWithResults > 0 ? Math.round(totalPassRate / examsWithResults) : 0;

      return {
        name: school.name,
        attendanceRate,
        passRate
      };
    });
  }, [isAdmin, selectedSchoolId, schools, students, attendance, exams, examResults]);

  // Student/Parent Specific Stats
  const studentAttendance = targetStudentUid ? filteredAttendance.filter(a => a.records[targetStudentUid]) : [];
  const studentPresentCount = targetStudentUid ? studentAttendance.filter(a => a.records[targetStudentUid] === 'present').length : 0;
  const studentAbsentCount = targetStudentUid ? studentAttendance.filter(a => a.records[targetStudentUid] === 'absent').length : 0;
  const studentAttendanceRate = studentAttendance.length > 0 
    ? Math.round((studentPresentCount / studentAttendance.length) * 100) 
    : 0;
  
  // Results Progress for Parent/Student
  const childExams = (isParent || user.role === 'student') && targetStudent ? exams.filter(e => e.classId === targetStudent.classId) : [];
  const childResults = (isParent || user.role === 'student') && targetStudent ? examResults.filter(r => r.studentId === targetStudent.uid) : [];
  const resultsPercentage = childExams.length > 0 ? Math.round((childResults.length / childExams.length) * 100) : 0;

  // Monthly Attendance for Parent/Student
  const monthlyData = React.useMemo(() => {
    const isStudent = user.role === 'student';
    if (!isParent && !isStudent) return [];
    if (!targetStudentUid) return [];
    
    // Last 6 months
    const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), i)).reverse();
    
    return months.map(monthDate => {
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthLabel = format(monthDate, 'MMM');
      
      const monthAttendance = filteredAttendance.filter(a => {
        const d = new Date(a.date);
        return d >= monthStart && d <= monthEnd && a.records[targetStudentUid];
      });
      
      let present = 0;
      let absent = 0;
      
      monthAttendance.forEach(a => {
        if (a.records[targetStudentUid] === 'present') present++;
        else if (a.records[targetStudentUid] === 'absent') absent++;
      });
      
      return {
        name: monthLabel,
        present,
        absent
      };
    });
  }, [isParent, targetStudentUid, filteredAttendance]);

  // Chart data: Attendance trend for last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), i);
    const dateStr = format(date, 'yyyy-MM-dd');
    
    if ((isParent || user.role === 'student') && targetStudentUid) {
      const dayRecord = filteredAttendance.find(a => a.date === dateStr);
      const status = dayRecord?.records[targetStudentUid];
      return {
        name: format(date, 'EEE'),
        status: status || 'N/A',
        rate: status === 'present' ? 100 : (status === 'absent' ? 0 : null),
        date: dateStr
      };
    }

    const dayAttendance = filteredAttendance.filter(a => a.date === dateStr);
    let present = 0;
    let total = 0;
    
    dayAttendance.forEach(a => {
      Object.values(a.records).forEach(status => {
        if (status === 'present') present++;
        total++;
      });
    });

    return {
      name: format(date, 'EEE'),
      rate: total > 0 ? Math.round((present / total) * 100) : 0,
      date: dateStr
    };
  }).reverse();

  const COLORS = ['#1B5E20', '#D32F2F', '#A18800'];
  const pieData = (isParent || user.role === 'student') ? [
    { name: 'Present', value: studentPresentCount },
    { name: 'Absent', value: studentAbsentCount },
    { name: 'Other', value: 0 }
  ] : [
    { name: 'Present', value: presentToday },
    { name: 'Absent', value: absentToday },
    { name: 'Late', value: 0 }
  ];

  const targetClass = classes.find(c => c.id === targetStudent?.classId);

  // Fallback for demo parent/student if student data is not yet seeded
  const displayStudent = targetStudent || ((isParent || user.role === 'student') && user.uid.startsWith('demo-') ? {
    name: 'Ayushmant Thorat',
    rollNumber: '101',
    photoUrl: 'https://picsum.photos/seed/student1/200/200',
    classId: 'demo-class'
  } : null);

  return (
    <div className="space-y-0">
      {/* Student Profile Header for Parents/Students (Compact) */}
      {(isParent || user.role === 'student') && displayStudent && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`bg-white p-3 shadow-sm border border-gray-100 flex items-center space-x-4 ${(isParent || user.role === 'student') ? 'rounded-t-3xl border-b-0' : 'rounded-3xl'}`}
        >
          <div className="relative shrink-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-blue-50 shadow-inner">
              {displayStudent.photoUrl ? (
                <img 
                  src={displayStudent.photoUrl} 
                  alt={displayStudent.name} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <GraduationCap className="w-8 h-8" />
                </div>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 bg-blue-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md shadow-lg uppercase tracking-wider">
              Student
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate tracking-tight">
                {displayStudent.name}
              </h2>
              <div className="inline-flex items-center text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider">
                <span className="bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">
                  Roll: <span className="text-blue-600 font-black">{displayStudent.rollNumber}</span>
                </span>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 mt-1.5">
              <div className="flex items-center text-[10px] sm:text-xs font-bold text-gray-500">
                <BookOpen className="w-3 h-3 mr-1 text-blue-500" />
                {targetClass?.name || 'Class 10-A'}
              </div>
              <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
              <div className="flex items-center text-[10px] sm:text-xs font-bold text-gray-500">
                <Users className="w-3 h-3 mr-1 text-emerald-500" />
                {targetClass?.section || 'A'} Section
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tab Navigation Dashboard */}
      <div className={`bg-white p-1.5 shadow-sm border border-gray-100 grid grid-cols-2 sm:flex sm:items-center gap-1.5 sm:space-x-1.5 overflow-hidden sm:overflow-x-auto no-scrollbar ${(isParent || user.role === 'student') && displayStudent ? 'rounded-b-2xl rounded-t-none' : 'rounded-2xl'}`}>
        {((isParent || user.role === 'student') ? [
          { id: 'actions', label: 'Home', icon: Plus },
          { id: 'stats', label: 'Overview', icon: TrendingUp },
          { id: 'news', label: 'Latest News', icon: Bell },
          { id: 'quicklinks', label: 'Quick Links', icon: Zap },
        ] : user.role === 'admin' ? [
          { id: 'stats', label: 'Overview', icon: TrendingUp },
          { id: 'news', label: 'Latest News', icon: Bell },
          { id: 'quicklinks', label: 'Quick Links', icon: Zap },
        ] : user.role === 'teacher' ? [
          { id: 'actions', label: 'Home', icon: Plus },
          { id: 'stats', label: 'Overview', icon: TrendingUp },
          { id: 'news', label: 'Latest News', icon: Bell },
          { id: 'quicklinks', label: 'Quick Links', icon: Zap },
        ] : [
          { id: 'stats', label: 'Overview', icon: TrendingUp },
          { id: 'news', label: 'Latest News', icon: Bell },
          { id: 'quicklinks', label: 'Quick Links', icon: Zap },
          { id: 'actions', label: 'Home', icon: Plus },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center justify-center sm:justify-start px-2 sm:px-4 py-2 rounded-xl font-black text-[10px] sm:text-xs transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 shrink-0" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'stats' && (
            <div className="space-y-6">
              {isAdmin && !user.schoolId && (
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">School Filter</h3>
                      <p className="text-xs text-gray-500">Viewing data for {selectedSchoolId === 'all' ? 'All Schools' : schools.find(s => s.id === selectedSchoolId)?.name}</p>
                    </div>
                  </div>
                  <select
                    value={selectedSchoolId}
                    onChange={(e) => setSelectedSchoolId(e.target.value)}
                    className="bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5 font-bold"
                  >
                    <option value="all">All Schools</option>
                    {schools.map(school => (
                      <option key={school.id} value={school.id}>{school.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {(isParent || user.role === 'student') ? (
                  <div className="col-span-full bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">Exam Results Progress</h3>
                        <p className="text-sm text-gray-500">Percentage of results entered for {user.role === 'student' ? 'you' : 'your child'}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-3xl font-black text-blue-600">{resultsPercentage}%</span>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Completed</p>
                      </div>
                    </div>
                    
                    <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${resultsPercentage}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full shadow-lg shadow-blue-100"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
                      <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                        <p className="text-[10px] font-bold text-blue-600 uppercase mb-1">Total Exams</p>
                        <p className="text-xl font-black text-blue-900">{childExams.length}</p>
                      </div>
                      <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Results Out</p>
                        <p className="text-xl font-black text-emerald-900">{childResults.length}</p>
                      </div>
                      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                        <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Pending</p>
                        <p className="text-xl font-black text-amber-900">{childExams.length - childResults.length}</p>
                      </div>
                      <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                        <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">Status</p>
                        <p className="text-sm font-black text-indigo-900">{resultsPercentage === 100 ? 'All Clear' : 'In Progress'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                      {/* Upcoming Exams */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Upcoming Exams</h4>
                          <button onClick={() => onViewChange?.('exams')} className="text-[10px] font-bold text-blue-600 hover:underline">View All</button>
                        </div>
                        {upcomingExams.length > 0 ? (
                          <div className="space-y-3">
                            {upcomingExams.map(exam => (
                              <div key={exam.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-bold text-gray-900">{exam.subject}</p>
                                  <p className="text-[10px] text-gray-500">{format(new Date(exam.startTime), 'MMM d, h:mm a')}</p>
                                </div>
                                <div className="text-right">
                                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                                    new Date(exam.startTime) <= new Date() ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                                  }`}>
                                    {new Date(exam.startTime) <= new Date() ? 'Ongoing' : 'Upcoming'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                            <p className="text-xs text-gray-400">No upcoming exams</p>
                          </div>
                        )}
                      </div>

                      {/* Recent Results */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Recent Results</h4>
                          <button onClick={() => onViewChange?.('exams')} className="text-[10px] font-bold text-blue-600 hover:underline">View All</button>
                        </div>
                        {recentResults.length > 0 ? (
                          <div className="space-y-3">
                            {recentResults.map(result => (
                              <div key={result.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-bold text-gray-900">{result.exam?.subject}</p>
                                  <p className="text-[10px] text-gray-500">{result.exam?.type}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-black text-blue-600">{result.marksObtained}/{result.exam?.totalMarks}</p>
                                  <p className="text-[8px] font-bold text-gray-400 uppercase">Score</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                            <p className="text-xs text-gray-400">No results yet</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <StatCard title="Total Students" value={totalStudents.toString()} icon={Users} color="blue" trend="+2.5%" isUp={true} />
                    <StatCard title="Attendance Rate" value={`${schoolAttendanceRate}%`} icon={TrendingUp} color="late" trend="-1.2%" isUp={false} />
                    <StatCard title="Avg Pass Rate" value={`${examStats.avgPassRate}%`} icon={CheckCircle2} color="emerald" trend="+1.5%" isUp={true} />
                    <StatCard title="Avg Marks" value={`${examStats.avgMarks}%`} icon={BarChart3} color="amber" trend="+0.8%" isUp={true} />
                  </>
                )}
              </div>

              {isAdmin && selectedSchoolId === 'all' && schoolWiseData.length > 0 && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-6">School-wise Comparison</h3>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={schoolWiseData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} unit="%" />
                          <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                          <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                          <Bar dataKey="attendanceRate" fill="#1B5E20" radius={[4, 4, 0, 0]} name="Attendance Rate" />
                          <Bar dataKey="passRate" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Pass Rate" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-50">
                      <h3 className="text-lg font-bold text-gray-900">School-wise Summary</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">School Name</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Attendance %</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Pass Rate %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {schoolWiseData.map(school => (
                            <tr key={school.name}>
                              <td className="px-6 py-4 text-sm font-bold text-gray-900">{school.name}</td>
                              <td className="px-6 py-4 text-center">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                                  school.attendanceRate >= 75 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                                }`}>
                                  {school.attendanceRate}%
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                                  school.passRate >= 75 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'
                                }`}>
                                  {school.passRate}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Analytics Section - Moved from Analytics Tab */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">
                    {(isParent || user.role === 'student') ? 'Monthly Attendance' : 'Attendance Trend'}
                  </h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      {(isParent || user.role === 'student') ? (
                        <BarChart data={monthlyData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                          <Tooltip 
                            contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                            cursor={{fill: '#f8fafc'}}
                          />
                          <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                          <Bar dataKey="present" fill="#1B5E20" radius={[4, 4, 0, 0]} name="Present" />
                          <Bar dataKey="absent" fill="#D32F2F" radius={[4, 4, 0, 0]} name="Absent" />
                        </BarChart>
                      ) : (
                        <AreaChart data={last7Days}>
                          <defs>
                            <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#1B5E20" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#1B5E20" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} unit="%" />
                          <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                          <Area type="monotone" dataKey="rate" stroke="#1B5E20" strokeWidth={3} fillOpacity={1} fill="url(#colorRate)" connectNulls />
                        </AreaChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">Distribution</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3 mt-4">
                    {pieData.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full mr-2" style={{backgroundColor: COLORS[index]}}></div>
                          <span className="text-sm text-gray-500">{item.name}</span>
                        </div>
                        <span className="text-sm font-bold text-gray-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'actions' && (
            <div className="bg-white p-3 sm:p-4 rounded-3xl shadow-sm border border-gray-100">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
                {(isParent || user.role === 'student') ? (
                  <>
                    <QuickAction icon={CalendarIcon} label="View Calendar" customColor="#AEDFF7" onClick={() => onViewChange?.('calendar')} />
                    <QuickAction icon={Pencil} label="Homework" customColor="#E6E6FA" onClick={() => onViewChange?.('homework')} />
                    <QuickAction icon={BarChart3} label="Exam Report" customColor="#B2F2BB" onClick={() => onViewChange?.('exams')} />
                    <QuickAction icon={Book} label="E Book" customColor="#FFDAB9" onClick={() => onViewChange?.('ebooks')} />
                    <QuickAction icon={Zap} label="Quick Links" customColor="#FFF9C4" onClick={() => setActiveTab('quicklinks')} />
                    {!isParent && <QuickAction icon={Bell} label="Notifications" customColor="#E0F2F1" onClick={() => onViewChange?.('announcements')} />}
                    <QuickAction icon={Info} label="About Us" customColor="#FADADD" onClick={() => onViewChange?.('about')} />
                  </>
                ) : (
                  <>
                    {user.role !== 'admin' && (
                      <>
                        <QuickAction icon={UserCheck} label="Mark Attendance" customColor="#B0E0E6" onClick={() => onViewChange?.('attendance')} />
                        <QuickAction icon={Pencil} label="Assign Homework" customColor="#E6E6FA" onClick={() => onViewChange?.('homework')} />
                      </>
                    )}
                    <QuickAction icon={Plus} label="Add Student" customColor="#E0B0FF" onClick={() => onViewChange?.('students')} />
                    {user.role !== 'admin' && (
                      <QuickAction icon={Book} label="E Book" customColor="#FFDAB9" onClick={() => onViewChange?.('ebooks')} />
                    )}
                    <QuickAction icon={Bell} label="New Announcement" customColor="#FFF9C4" onClick={() => onViewChange?.('announcements')} />
                    <QuickAction icon={Info} label="About Us" customColor="#FADADD" onClick={() => onViewChange?.('about')} />
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'news' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {announcements.length > 0 ? (
                announcements
                  .filter(ann => !ann.targetClassId || ((isParent || user.role === 'student') && (targetStudent?.classId === ann.targetClassId)))
                  .slice(0, 4)
                  .map((ann) => (
                  <div key={ann.id} className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-wider">
                        {ann.targetClassId ? 'Class Update' : 'School News'}
                      </span>
                      <span className="text-xs text-gray-400">{format(new Date(ann.date), 'MMM d')}</span>
                    </div>
                    <h4 className="text-lg font-bold text-gray-900 mb-2">{ann.title}</h4>
                    <p className="text-sm text-gray-500 line-clamp-3 leading-relaxed">{ann.content}</p>
                  </div>
                ))
              ) : (
                <div className="col-span-2 text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200">
                  <Bell className="w-16 h-16 text-gray-200 mx-auto mb-4 opacity-20" />
                  <p className="text-gray-400 font-medium">No recent announcements</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'about' && (
            <AboutUs user={user} />
          )}

          {activeTab === 'quicklinks' && (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <QuickLinks user={user} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color, trend, isUp }: any) => {
  const colorClasses: any = {
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    present: 'bg-present-light text-present',
    absent: 'bg-absent-light text-absent',
    late: 'bg-late-light text-late',
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-2xl ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className={`flex items-center text-xs font-bold ${isUp ? 'text-emerald-600' : 'text-red-600'}`}>
          {isUp ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
          {trend}
        </div>
      </div>
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <h4 className="text-2xl font-bold text-gray-900">{value}</h4>
    </div>
  );
};

const QuickAction = ({ icon: Icon, label, color, onClick, customColor }: any) => {
  const colorClasses: any = {
    blue: 'bg-blue-50 text-blue-600 group-hover:bg-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600',
    amber: 'bg-amber-50 text-amber-600 group-hover:bg-amber-600',
  };

  // Helper to darken a hex color for text readability
  const darkenColor = (hex: string) => {
    if (!hex) return 'inherit';
    // Simple way to darken: reduce brightness
    // For a more robust solution we'd parse RGB, but for these specific pastels:
    const colors: any = {
      '#AEDFF7': '#2c5282', // Darker blue
      '#E6E6FA': '#553c9a', // Darker purple
      '#B2F2BB': '#22543d', // Darker green
      '#FFDAB9': '#7b341e', // Darker orange/brown
      '#FFF9C4': '#744210', // Darker yellow/brown
      '#FADADD': '#9b2c2c', // Darker pink
      '#B0E0E6': '#2b6cb0', // Darker powder blue
      '#E0B0FF': '#6b46c1', // Darker mauve
    };
    return colors[hex] || hex;
  };

  const tileStyle = customColor ? { backgroundColor: customColor } : {};
  const iconBgStyle = customColor ? { backgroundColor: 'rgba(255, 255, 255, 0.4)', color: 'rgba(0,0,0,0.7)' } : {};
  const textStyle = customColor ? { color: darkenColor(customColor) } : {};

  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-2 sm:p-3 rounded-2xl border border-gray-100 hover:shadow-lg transition-all group ${!customColor ? 'bg-gray-50 hover:bg-white' : ''}`}
      style={tileStyle}
    >
      <div 
        className={`p-2 sm:p-2.5 rounded-xl mb-1.5 transition-colors ${!customColor ? colorClasses[color] : ''}`}
        style={iconBgStyle}
      >
        <Icon className={`w-4 h-4 sm:w-5 sm:h-5 transition-colors ${!customColor ? 'group-hover:text-white' : ''}`} />
      </div>
      <span 
        className="text-[10px] sm:text-xs font-black text-center leading-tight transition-colors"
        style={textStyle}
      >
        {label}
      </span>
    </button>
  );
};
