import React, { useState } from 'react';
import { UserProfile, SchoolData, ClassData, StudentData, AttendanceRecord, Exam, ExamResult } from '../../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  LineChart,
  Line
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from 'date-fns';
import { Download, FileSpreadsheet, FileText, Filter, Calendar as CalendarIcon, Search, Loader2, Check, Clock } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface Props {
  user: UserProfile;
  schools: SchoolData[];
  classes: ClassData[];
  students: StudentData[];
  attendance: AttendanceRecord[];
  exams: Exam[];
  examResults: ExamResult[];
}

export const Reports: React.FC<Props> = ({ user, schools, classes, students, attendance, exams, examResults }) => {
  const [reportType, setReportType] = useState<'attendance' | 'exams'>('attendance');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(user.schoolId || 'all');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedExamId, setSelectedExamId] = useState<string>('all');
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [activeReportTab, setActiveReportTab] = useState<'summary' | 'log'>('summary');

  const isAdmin = user.role === 'admin';
  const isParent = user.role === 'parent';
  const targetStudentUid = isParent ? user.childId : null;

  // Filter classes based on selected school
  const filteredClasses = (isAdmin && selectedSchoolId !== 'all')
    ? classes.filter(c => c.schoolId === selectedSchoolId)
    : (user.schoolId ? classes.filter(c => c.schoolId === user.schoolId) : classes);

  // Filter exams based on selected school and class
  const filteredExams = exams.filter(exam => {
    const schoolMatch = selectedSchoolId === 'all' || exam.schoolId === selectedSchoolId;
    const classMatch = selectedClassId === 'all' || exam.classId === selectedClassId;
    return schoolMatch && classMatch;
  });

  // Attendance Report Logic
  const filteredAttendance = attendance.filter(a => {
    const matchesSchool = selectedSchoolId === 'all' || a.schoolId === selectedSchoolId;
    const matchesClass = isParent ? true : (selectedClassId === 'all' || a.classId === selectedClassId);
    const matchesDate = a.date >= dateRange.start && a.date <= dateRange.end;
    return matchesSchool && matchesClass && matchesDate;
  });

  const studentStats = students
    .filter(s => {
      if (isParent) return s.uid === targetStudentUid;
      const matchesSchool = selectedSchoolId === 'all' || s.schoolId === selectedSchoolId;
      const matchesClass = selectedClassId === 'all' || s.classId === selectedClassId;
      return matchesSchool && matchesClass;
    })
    .map(s => {
      const studentAttendance = filteredAttendance.map(a => a.records[s.uid || s.id]).filter(Boolean);
      const present = studentAttendance.filter(v => v === 'present').length;
      const total = studentAttendance.length;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      
      return {
        id: s.id,
        uid: s.uid,
        name: s.name,
        rollNumber: s.rollNumber,
        className: classes.find(c => c.id === s.classId)?.name || s.classId,
        schoolName: schools.find(sch => sch.id === s.schoolId)?.name || 'N/A',
        present,
        absent: total - present,
        total,
        rate
      };
    })
    .sort((a, b) => a.rate - b.rate);

  // Exam Report Logic
  const examReportData = React.useMemo(() => {
    if (reportType !== 'exams') return [];

    const targetExams = selectedExamId === 'all' ? filteredExams : filteredExams.filter(e => e.id === selectedExamId);
    
    return targetExams.map(exam => {
      const results = examResults.filter(r => r.examId === exam.id);
      const classInfo = classes.find(c => c.id === exam.classId);
      const schoolInfo = schools.find(s => s.id === exam.schoolId);
      
      if (results.length === 0) return null;

      const totalMarks = results.reduce((acc, curr) => acc + curr.marksObtained, 0);
      const avgMarks = Math.round(totalMarks / results.length);
      const passCount = results.filter(r => (r.marksObtained / exam.totalMarks) * 100 >= 35).length;
      const passRate = Math.round((passCount / results.length) * 100);

      const sortedResults = [...results].sort((a, b) => b.marksObtained - a.marksObtained);
      const topScorer = students.find(s => s.uid === sortedResults[0].studentId);

      return {
        id: exam.id,
        name: exam.title,
        subject: exam.subject,
        className: classInfo ? `${classInfo.name}-${classInfo.section}` : 'Unknown',
        schoolName: schoolInfo?.name || 'N/A',
        avgMarks,
        passRate,
        totalStudents: results.length,
        topScorer: topScorer?.name || 'N/A',
        topMarks: sortedResults[0].marksObtained,
        totalMarks: exam.totalMarks
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);
  }, [exams, examResults, selectedExamId, filteredExams, classes, schools, students, reportType]);

  const exportToExcel = () => {
    let data;
    if (reportType === 'attendance') {
      if (activeReportTab === 'summary') {
        data = studentStats.map(s => ({
          'School': s.schoolName,
          'Roll No': s.rollNumber,
          'Name': s.name,
          'Class': s.className,
          'Present': s.present,
          'Absent': s.absent,
          'Total Sessions': s.total,
          'Attendance %': `${s.rate}%`
        }));
      } else {
        data = attendanceLog.map(log => ({
          'Date': log.date,
          'Student': log.studentName,
          'Roll No': log.rollNumber,
          'Session': log.session,
          'Status': log.status,
          'Scan Times': Array.isArray(log.times) ? log.times.join(', ') : log.times
        }));
      }
    } else {
      data = examReportData.map(row => ({
        'School': row.schoolName,
        'Exam': row.name,
        'Subject': row.subject,
        'Class': row.className,
        'Avg Marks': `${row.avgMarks}/${row.totalMarks}`,
        'Pass Rate %': `${row.passRate}%`,
        'Top Scorer': row.topScorer,
        'Top Marks': row.topMarks
      }));
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, reportType === 'attendance' ? "Attendance Report" : "Exam Report");
    XLSX.writeFile(wb, `${reportType}_report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Excel report exported');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text(`${reportType === 'attendance' ? 'Attendance' : 'Exam'} Report`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${format(new Date(), 'PPP')}`, 14, 22);
    
    let tableData;
    let head;

    if (reportType === 'attendance') {
      if (activeReportTab === 'summary') {
        head = [['School', 'Roll No', 'Name', 'Class', 'Present', 'Absent', '%']];
        tableData = studentStats.map(s => [s.schoolName, s.rollNumber, s.name, s.className, s.present, s.absent, `${s.rate}%`]);
      } else {
        head = [['Date', 'Student', 'Session', 'Status', 'Scan Times']];
        tableData = attendanceLog.map(log => [log.date, log.studentName, log.session, log.status, Array.isArray(log.times) ? log.times.join(', ') : log.times]);
      }
    } else {
      head = [['School', 'Exam', 'Subject', 'Class', 'Avg Marks', 'Pass %', 'Top Scorer']];
      tableData = examReportData.map(row => [row.schoolName, row.name, row.subject, row.className, `${row.avgMarks}/${row.totalMarks}`, `${row.passRate}%`, row.topScorer]);
    }

    (doc as any).autoTable({
      head: head,
      body: tableData,
      startY: 30,
      theme: 'striped',
      headStyles: { fillColor: [0, 43, 154] }
    });

    doc.save(`${reportType}_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('PDF report exported');
  };

  const attendanceLog = filteredAttendance.flatMap(a => {
    return Object.entries(a.records).map(([studentId, status]) => {
      const student = students.find(s => s.uid === studentId || s.id === studentId);
      if (!student) return null;
      if (selectedClassId !== 'all' && student.classId !== selectedClassId) return null;
      if (isParent && student.uid !== targetStudentUid) return null;

      return {
        id: `${a.id}-${studentId}`,
        date: a.date,
        session: a.sessionName,
        studentName: student.name,
        rollNumber: student.rollNumber,
        status,
        times: a.timeRecords?.[studentId] || []
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);
  }).sort((a, b) => b.date.localeCompare(a.date));

  const schoolWiseSummary = React.useMemo(() => {
    if (!isAdmin || selectedSchoolId !== 'all') return [];

    return schools.map(school => {
      // Attendance Stats
      const schoolAttendance = filteredAttendance.filter(a => a.schoolId === school.id);
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
      const schoolExams = examReportData.filter(e => e.schoolName === school.name);
      const passRate = schoolExams.length > 0 
        ? Math.round(schoolExams.reduce((acc, curr) => acc + curr.passRate, 0) / schoolExams.length)
        : 0;
      const avgMarks = schoolExams.length > 0
        ? Math.round(schoolExams.reduce((acc, curr) => acc + curr.avgMarks, 0) / schoolExams.length)
        : 0;

      return {
        name: school.name,
        attendanceRate,
        passRate,
        avgMarks
      };
    });
  }, [isAdmin, selectedSchoolId, schools, filteredAttendance, examReportData]);

  return (
    <div className="space-y-6">
      {/* Report Type Selector */}
      <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-2 w-fit">
        <button
          onClick={() => setReportType('attendance')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            reportType === 'attendance' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          Attendance
        </button>
        <button
          onClick={() => setReportType('exams')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            reportType === 'exams' ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
          }`}
        >
          Exam Results
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col lg:flex-row lg:items-end gap-4">
        {!isParent && isAdmin && (
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Select School</label>
            <select
              value={selectedSchoolId}
              onChange={(e) => {
                setSelectedSchoolId(e.target.value);
                setSelectedClassId('all');
                setSelectedExamId('all');
              }}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
            >
              <option value="all">All Schools</option>
              {schools.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
        {!isParent && user.role !== 'admin' && (
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Select Class</label>
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setSelectedExamId('all');
              }}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
            >
              <option value="all">All Classes</option>
              {filteredClasses.map(c => (
                <option key={c.id} value={c.id}>{c.name} - {c.section}</option>
              ))}
            </select>
          </div>
        )}
        {reportType === 'attendance' ? (
          <>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Start Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">End Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              />
            </div>
          </>
        ) : (
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Select Exam</label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
            >
              <option value="all">All Exams</option>
              {filteredExams.map(e => (
                <option key={e.id} value={e.id}>{e.title} ({e.subject})</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex space-x-2">
          <button 
            onClick={exportToExcel}
            className="flex items-center px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
          >
            <FileSpreadsheet className="w-5 h-5 mr-2" />
            Excel
          </button>
          <button 
            onClick={exportToPDF}
            className="flex items-center px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100"
          >
            <FileText className="w-5 h-5 mr-2" />
            PDF
          </button>
        </div>
      </div>

      {reportType === 'attendance' && (
        <div className="flex items-center p-1 bg-gray-100 rounded-2xl w-fit">
          <button
            onClick={() => setActiveReportTab('summary')}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeReportTab === 'summary' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setActiveReportTab('log')}
            className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeReportTab === 'log' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Daily Log
          </button>
        </div>
      )}

      {reportType === 'attendance' ? (
        activeReportTab === 'summary' ? (
          <div className="space-y-6">
            {isAdmin && selectedSchoolId === 'all' && schoolWiseSummary.length > 0 && (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">School-wise Attendance Comparison</h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={schoolWiseSummary}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} unit="%" />
                        <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                        <Bar dataKey="attendanceRate" fill="#1B5E20" radius={[4, 4, 0, 0]} name="Attendance Rate" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-6 border-b border-gray-50">
                    <h3 className="text-lg font-bold text-gray-900">School-wise Attendance Summary</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">School Name</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Attendance Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {schoolWiseSummary.map(school => (
                          <tr key={school.name}>
                            <td className="px-6 py-4 text-sm font-bold text-gray-900">{school.name}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                                school.attendanceRate >= 75 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                              }`}>
                                {school.attendanceRate}%
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-6">
                  {selectedSchoolId === 'all' ? 'Top Students Attendance' : 'Attendance Trend'}
                </h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={studentStats.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} unit="%" />
                      <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                      <Bar dataKey="rate" fill="#1B5E20" radius={[4, 4, 0, 0]} name="Attendance Rate" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Quick Stats</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <p className="text-xs font-bold text-blue-600 uppercase mb-1">Avg Attendance</p>
                    <p className="text-2xl font-black text-blue-700">
                      {studentStats.length > 0 ? Math.round(studentStats.reduce((acc, curr) => acc + curr.rate, 0) / studentStats.length) : 0}%
                    </p>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Total Present</p>
                    <p className="text-2xl font-black text-emerald-700">{studentStats.reduce((acc, curr) => acc + curr.present, 0)}</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                    <p className="text-xs font-bold text-red-600 uppercase mb-1">Total Absent</p>
                    <p className="text-2xl font-black text-red-700">{studentStats.reduce((acc, curr) => acc + curr.absent, 0)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Student</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Times</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {attendanceLog.map(log => (
                    <tr key={log.id}>
                      <td className="px-6 py-4 text-sm font-medium">{log.date}</td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-sm">{log.studentName}</p>
                        <p className="text-[10px] text-gray-500">Roll: {log.rollNumber}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          log.status === 'present' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">{Array.isArray(log.times) ? log.times.join(', ') : log.times}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <div className="space-y-6">
          {isAdmin && selectedSchoolId === 'all' && schoolWiseSummary.length > 0 && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-6">School-wise Exam Comparison</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={schoolWiseSummary}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} unit="%" />
                      <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                      <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                      <Bar dataKey="passRate" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Pass Rate %" />
                      <Bar dataKey="avgMarks" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Avg Marks %" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-50">
                  <h3 className="text-lg font-bold text-gray-900">School-wise Exam Summary</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">School Name</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Pass Rate</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Avg Marks %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {schoolWiseSummary.map(school => (
                        <tr key={school.name}>
                          <td className="px-6 py-4 text-sm font-bold text-gray-900">{school.name}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                              school.passRate >= 75 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                            }`}>
                              {school.passRate}%
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center font-bold text-blue-600">{school.avgMarks}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-6">
                {selectedSchoolId === 'all' ? 'Top Exams Performance' : 'Exam Performance'}
              </h3>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={examReportData.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} unit="%" />
                    <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="passRate" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Pass Rate %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Exam Stats</h3>
              <div className="space-y-4">
                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <p className="text-xs font-bold text-indigo-600 uppercase mb-1">Avg Pass Rate</p>
                  <p className="text-2xl font-black text-indigo-700">
                    {examReportData.length > 0 ? Math.round(examReportData.reduce((acc, curr) => acc + curr.passRate, 0) / examReportData.length) : 0}%
                  </p>
                </div>
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                  <p className="text-xs font-bold text-amber-600 uppercase mb-1">Avg Marks</p>
                  <p className="text-2xl font-black text-amber-700">
                    {examReportData.length > 0 ? Math.round(examReportData.reduce((acc, curr) => acc + curr.avgMarks, 0) / examReportData.length) : 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">School</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Exam</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Class</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Avg Marks</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">Pass %</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Top Scorer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {examReportData.map(row => (
                    <tr key={row.id}>
                      <td className="px-6 py-4 text-sm font-bold">{row.schoolName}</td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-sm">{row.name}</p>
                        <p className="text-[10px] text-gray-500">{row.subject}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{row.className}</td>
                      <td className="px-6 py-4 text-center font-bold text-blue-600">{row.avgMarks}/{row.totalMarks}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                          row.passRate >= 75 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                        }`}>
                          {row.passRate}%
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-sm">{row.topScorer}</p>
                        <p className="text-[10px] text-amber-600 font-black">{row.topMarks} Marks</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color }: any) => {
  const colorClasses: any = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
      <div className={`w-12 h-12 rounded-2xl ${colorClasses[color]} flex items-center justify-center mb-4`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <h4 className="text-2xl font-black text-gray-900">{value}</h4>
    </div>
  );
};
