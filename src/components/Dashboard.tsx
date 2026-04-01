import React, { useState, useEffect } from 'react';
import { UserProfile, SchoolData, ClassData, StudentData, AttendanceRecord, Announcement, Exam, ExamResult, Homework, EBook } from '../types';
import { auth, signOut, db, collection, onSnapshot, query, where, deleteDoc, doc, OperationType, handleFirestoreError, restoreDefaultBanners } from '../firebase';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Calendar, 
  BarChart3, 
  Bell, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Plus,
  Trash2,
  Image as ImageIcon,
  Search,
  Filter,
  Download,
  Upload,
  Building2,
  ChevronRight,
  ChevronLeft,
  UserCheck,
  UserMinus,
  Clock,
  Megaphone,
  AlertTriangle,
  ClipboardList,
  Pencil,
  RotateCcw,
  Info,
  Book,
  Link as LinkIcon,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { toast } from 'sonner';
import { ConfirmationModal } from './ConfirmationModal';

// Views
import { Overview } from './views/Overview';
import { ClassManagement } from './views/ClassManagement';
import { StudentManagement } from './views/StudentManagement';
import { AttendanceMarking } from './views/AttendanceMarking';
import { Reports } from './views/Reports';
import { CalendarView } from './views/CalendarView';
import { Announcements } from './views/Announcements';
import { BannerManagement } from './views/BannerManagement';
import { ExamManagement } from './views/ExamManagement';
import { HomeworkView } from './views/Homework';
import { EBookManagement } from './views/EBookManagement';
import { SchoolManagement } from './views/SchoolManagement';
import AboutUs from './views/AboutUs';
import { QuickLinks } from './QuickLinks';

interface Props {
  user: UserProfile;
  onLogout?: () => void;
  onRoleSwitch?: (role: 'admin' | 'teacher' | 'parent') => void;
}

export const Dashboard: React.FC<Props> = ({ user, onLogout, onRoleSwitch }) => {
  const [activeView, setActiveView] = useState('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [dismissedBanners, setDismissedBanners] = useState<string[]>([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
  const [students, setStudents] = useState<StudentData[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [ebooks, setEbooks] = useState<EBook[]>([]);

  useEffect(() => {
    // Real-time listeners
    const schoolsUnsubscribe = onSnapshot(collection(db, 'schools'), (snapshot) => {
      setSchools(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SchoolData)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'schools'));

    const classesUnsubscribe = onSnapshot(collection(db, 'classes'), (snapshot) => {
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassData)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'classes'));

    const studentsUnsubscribe = onSnapshot(collection(db, 'students'), (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentData)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'students'));

    const attendanceUnsubscribe = onSnapshot(collection(db, 'attendance'), (snapshot) => {
      setAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'attendance'));

    const announcementsUnsubscribe = onSnapshot(collection(db, 'announcements'), (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Announcement)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'announcements'));

    const examsUnsubscribe = onSnapshot(collection(db, 'exams'), (snapshot) => {
      setExams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'exams'));

    const examResultsUnsubscribe = onSnapshot(collection(db, 'examResults'), (snapshot) => {
      setExamResults(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExamResult)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'examResults'));

    const homeworkUnsubscribe = onSnapshot(collection(db, 'homework'), (snapshot) => {
      setHomework(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Homework)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'homework'));

    const ebooksUnsubscribe = onSnapshot(collection(db, 'ebooks'), (snapshot) => {
      setEbooks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EBook)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'ebooks'));

    return () => {
      schoolsUnsubscribe();
      classesUnsubscribe();
      studentsUnsubscribe();
      attendanceUnsubscribe();
      announcementsUnsubscribe();
      examsUnsubscribe();
      examResultsUnsubscribe();
      homeworkUnsubscribe();
      ebooksUnsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      if (user.uid.startsWith('demo-')) {
        onLogout?.();
      } else {
        await signOut(auth);
      }
      toast.success('Logged out successfully');
    } catch (err) {
      toast.error('Failed to logout');
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    setDeleteModal({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    if (!deleteModal.id) return;

    try {
      await deleteDoc(doc(db, 'announcements', deleteModal.id));
      toast.success('Banner deleted successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `announcements/${deleteModal.id}`);
    } finally {
      setDeleteModal({ isOpen: false, id: null });
    }
  };

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, roles: ['admin', 'teacher', 'parent'] },
    { id: 'schools', label: 'Schools', icon: Building2, roles: ['admin'] },
    { id: 'classes', label: 'Classes', icon: BookOpen, roles: ['teacher'] },
    { id: 'students', label: 'Students', icon: Users, roles: ['admin', 'teacher'] },
    { id: 'attendance', label: 'Mark Attendance', icon: UserCheck, roles: ['teacher'] },
    { id: 'exams', label: 'Exams', icon: ClipboardList, roles: ['teacher', 'parent'] },
    { id: 'homework', label: 'Homework', icon: Pencil, roles: ['teacher', 'parent'] },
    { id: 'ebooks', label: 'E-Books', icon: Book, roles: ['teacher', 'parent'] },
    { id: 'calendar', label: 'Calendar', icon: Calendar, roles: ['teacher', 'parent'] },
    { id: 'reports', label: 'Reports', icon: BarChart3, roles: ['admin', 'teacher', 'parent'] },
    { id: 'about', label: 'About Us', icon: Info, roles: ['admin'] },
    { id: 'quicklinks', label: 'Quick Links', icon: LinkIcon, roles: ['admin', 'teacher', 'parent'] },
    { id: 'banners', label: 'Banners', icon: ImageIcon, roles: ['admin', 'teacher'] },
    { id: 'announcements', label: 'Announcements', icon: Bell, roles: ['admin', 'teacher', 'parent'] },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(user.role));

  const relevantAnnouncements = announcements.filter(ann => {
    if (user.role === 'admin' || user.role === 'teacher') return true;
    const targetStudent = user.role === 'parent' 
      ? students.find(s => s.uid === user.childId)
      : students.find(s => s.uid === user.uid);
    
    const matchesSchool = !ann.schoolId || ann.schoolId === targetStudent?.schoolId || ann.schoolId === user.schoolId;
    if (!matchesSchool) return false;

    if (!ann.targetClassId) return true;
    return ann.targetClassId === targetStudent?.classId;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const activeBanners = relevantAnnouncements.filter(ann => ann.isBanner && !dismissedBanners.includes(ann.id));
  const photoBanners = activeBanners.filter(ann => ann.imageUrl);
  const textBanners = activeBanners.filter(ann => !ann.imageUrl);
  const notificationAnnouncements = relevantAnnouncements.filter(ann => !(ann.isBanner && ann.imageUrl));

  useEffect(() => {
    if (photoBanners.length > 1) {
      const interval = setInterval(() => {
        setCurrentBannerIndex(prev => (prev + 1) % photoBanners.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [photoBanners.length]);

  useEffect(() => {
    if (currentBannerIndex >= photoBanners.length && photoBanners.length > 0) {
      setCurrentBannerIndex(0);
    }
  }, [photoBanners.length, currentBannerIndex]);

  const renderView = () => {
    switch (activeView) {
      case 'overview': return <Overview user={user} classes={classes} students={students} attendance={attendance} announcements={announcements} homework={homework} ebooks={ebooks} exams={exams} examResults={examResults} schools={schools} onViewChange={setActiveView} />;
      case 'schools': return <SchoolManagement user={user} schools={schools} />;
      case 'classes': return <ClassManagement user={user} classes={classes} schools={schools} />;
      case 'students': return <StudentManagement user={user} classes={classes} students={students} schools={schools} />;
      case 'attendance': return <AttendanceMarking user={user} classes={classes} students={students} attendance={attendance} schools={schools} />;
      case 'calendar': return <CalendarView user={user} attendance={attendance} students={students} />;
      case 'reports': return <Reports user={user} classes={classes} students={students} attendance={attendance} exams={exams} examResults={examResults} schools={schools} />;
      case 'banners': return <BannerManagement user={user} announcements={announcements} classes={classes} schools={schools} />;
      case 'announcements': return <Announcements user={user} announcements={announcements} classes={classes} students={students} schools={schools} />;
      case 'exams': return <ExamManagement user={user} classes={classes} students={students} exams={exams} examResults={examResults} schools={schools} />;
      case 'homework': return <HomeworkView user={user} classes={classes} students={students} homework={homework} schools={schools} />;
      case 'ebooks': return <EBookManagement user={user} classes={classes} ebooks={ebooks} schools={schools} />;
      case 'about': return <AboutUs user={user} />;
      case 'quicklinks': return <QuickLinks user={user} />;
      default: return <Overview user={user} classes={classes} students={students} attendance={attendance} announcements={announcements} onViewChange={setActiveView} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar for Desktop */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-100">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">SmartAttend</span>
          </div>

          <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
            {filteredNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveView(item.id);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center px-4 py-3 text-sm font-black rounded-xl transition-all ${
                  activeView === item.id 
                    ? 'bg-blue-50 text-blue-600 shadow-sm' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon className={`w-5 h-5 mr-3 ${activeView === item.id ? 'text-blue-600' : 'text-gray-400'}`} />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-100">
            <div className="flex items-center p-3 bg-gray-50 rounded-2xl mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold mr-3">
                {user.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{user.name}</p>
                <p className="text-xs text-gray-500 truncate capitalize">{user.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white border-bottom border-gray-200 h-16 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-40">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex-1 px-4 lg:px-0 flex items-center space-x-4">
            {activeView === 'overview' ? (
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-black text-gray-900 tracking-tight">SmartAttend Academy</h2>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => setActiveView('overview')} 
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <ArrowLeft className="w-6 h-6 text-[#002B9A]" />
                </button>
                <h2 className="text-lg font-black text-gray-900 capitalize">
                  {filteredNavItems.find(i => i.id === activeView)?.label || 'Overview'}
                </h2>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={`p-2 rounded-full relative transition-colors ${isNotificationsOpen ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-100'}`}
              >
                <Bell className="w-5 h-5" />
                {notificationAnnouncements.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setIsNotificationsOpen(false)}
                      className="fixed inset-0 z-40"
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-80 bg-white rounded-3xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
                    >
                      <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                        <h3 className="font-bold text-gray-900">Notifications</h3>
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full uppercase">
                          {notificationAnnouncements.length} New
                        </span>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {notificationAnnouncements.length > 0 ? (
                          notificationAnnouncements.map((ann) => (
                            <button
                              key={ann.id}
                              onClick={() => {
                                setActiveView('announcements');
                                setIsNotificationsOpen(false);
                              }}
                              className="w-full p-4 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 flex items-start space-x-3"
                            >
                              <div className={`p-2 rounded-xl shrink-0 ${
                                ann.type === 'urgent' ? 'bg-red-50 text-red-600' :
                                ann.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                                'bg-blue-50 text-blue-600'
                              }`}>
                                <Bell className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{ann.title}</p>
                                <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{ann.content}</p>
                                <p className="text-[10px] text-gray-400 mt-2">{format(new Date(ann.date), 'MMM d, h:mm a')}</p>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="p-8 text-center">
                            <Bell className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                            <p className="text-sm text-gray-400">No new notifications</p>
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => {
                          setActiveView('announcements');
                          setIsNotificationsOpen(false);
                        }}
                        className="w-full p-3 text-center text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors border-t border-gray-50"
                      >
                        View All Announcements
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <div className="h-8 w-px bg-gray-200 mx-2"></div>
            <div className="hidden sm:block text-right">
              <p className="text-sm font-bold text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user.role}</p>
            </div>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          {/* Photo Banners (Scrolling) */}
          {activeView !== 'calendar' && activeView !== 'about' && (
            photoBanners.length > 0 ? (
              <div className="relative group">
                <div className="relative h-48 md:h-64 lg:h-80 w-full overflow-hidden rounded-3xl shadow-lg">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={photoBanners[currentBannerIndex]?.id || 'empty'}
                      initial={{ opacity: 0, x: 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      transition={{ duration: 0.5 }}
                      className="absolute inset-0"
                    >
                      {photoBanners[currentBannerIndex] ? (
                        <>
                          <img 
                            src={photoBanners[currentBannerIndex].imageUrl} 
                            alt={photoBanners[currentBannerIndex].title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-6 lg:p-10">
                            <h3 className="text-xl lg:text-3xl font-bold text-white mb-2">{photoBanners[currentBannerIndex].title}</h3>
                            <p className="text-white/80 text-sm lg:text-base line-clamp-2 max-w-2xl">{photoBanners[currentBannerIndex].content}</p>
                          </div>
                        </>
                      ) : null}
                    </motion.div>
                  </AnimatePresence>

                  <div className="absolute top-4 right-4 flex items-center space-x-2">
                    {(user.role === 'admin' || user.role === 'teacher') && photoBanners[currentBannerIndex] && (
                      <>
                        <button 
                          onClick={() => handleDeleteAnnouncement(photoBanners[currentBannerIndex].id)}
                          className="p-2 bg-red-600/80 hover:bg-red-600 backdrop-blur-md rounded-full text-white transition-colors shadow-lg"
                          title="Delete Banner Forever"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setDismissedBanners([...dismissedBanners, photoBanners[currentBannerIndex].id])}
                          className="p-2 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full text-white transition-colors"
                          title="Dismiss for now"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>

                  {photoBanners.length > 1 && (
                    <>
                      <button 
                        onClick={() => setCurrentBannerIndex(prev => (prev - 1 + photoBanners.length) % photoBanners.length)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <button 
                        onClick={() => setCurrentBannerIndex(prev => (prev + 1) % photoBanners.length)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
                        {photoBanners.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setCurrentBannerIndex(idx)}
                            className={`w-2 h-2 rounded-full transition-all ${idx === currentBannerIndex ? 'bg-white w-6' : 'bg-white/40'}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (user.role === 'admin' || user.role === 'teacher') && (
              <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                <ImageIcon className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-gray-400">No active banners</h3>
                <button 
                  onClick={() => restoreDefaultBanners()}
                  className="mt-4 px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center mx-auto"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restore Original Banner
                </button>
              </div>
            )
          )}

          {/* Text Banners */}
          <AnimatePresence>
            {activeView !== 'calendar' && activeView !== 'about' && textBanners.map((banner) => (
              <motion.div
                key={banner.id}
                initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                animate={{ height: 'auto', opacity: 1, marginBottom: 12 }}
                exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                className="overflow-hidden"
              >
                <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm ${
                  banner.type === 'urgent' ? 'bg-red-50 border-red-100 text-red-800' :
                  banner.type === 'warning' ? 'bg-amber-50 border-amber-100 text-amber-800' :
                  'bg-blue-50 border-blue-100 text-blue-800'
                }`}>
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-xl ${
                      banner.type === 'urgent' ? 'bg-red-100 text-red-600' :
                      banner.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      <Megaphone className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{banner.title}</p>
                      <p className="text-xs opacity-80 line-clamp-1">{banner.content}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => setActiveView('announcements')}
                      className="px-3 py-1.5 text-xs font-bold bg-white/50 hover:bg-white rounded-lg transition-colors"
                    >
                      View Details
                    </button>
                    {(user.role === 'admin' || user.role === 'teacher') && (
                      <>
                        <button 
                          onClick={() => handleDeleteAnnouncement(banner.id)}
                          className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg transition-colors"
                          title="Delete Banner Forever"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setDismissedBanners([...dismissedBanners, banner.id])}
                          className="p-1.5 hover:bg-black/5 rounded-lg transition-colors"
                          title="Dismiss for now"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        title="Delete Banner?"
        message="This will permanently remove this banner from the dashboard. This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, id: null })}
        confirmText="Delete Forever"
        type="danger"
      />

      {/* Floating Back to Home Button */}
      <AnimatePresence>
        {activeView !== 'overview' && ['admin', 'teacher', 'parent'].includes(user.role) && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveView('overview')}
            className="fixed bottom-6 right-6 z-50 bg-blue-600 text-white px-4 py-2 rounded-full shadow-2xl hover:bg-blue-700 transition-all flex items-center justify-center group border border-blue-500/20"
          >
            <LayoutDashboard className="w-4 h-4 mr-2" />
            <span className="text-xs font-bold uppercase tracking-wider">{user.role === 'admin' ? 'Overview' : 'Home'}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
