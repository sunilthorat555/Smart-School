import React, { useState } from 'react';
import { UserProfile, AttendanceRecord, StudentData } from '../../types';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isToday, 
  addMonths, 
  subMonths, 
  startOfWeek, 
  endOfWeek,
  isSameMonth,
  getDaysInMonth
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, UserCheck, UserMinus, Clock, Info, ArrowLeft, ChevronDown } from 'lucide-react';

interface Props {
  user: UserProfile;
  attendance: AttendanceRecord[];
  students: StudentData[];
}

export const CalendarView: React.FC<Props> = ({ user, attendance, students }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  
  // The image shows a grid that seems to be just the days of the month, 
  // but usually calendars show full weeks. 
  // However, looking at the image, it's a 7-column grid.
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const isStudentOrParent = user.role === 'student' || user.role === 'parent';
  const targetStudentUid = user.role === 'parent' ? user.childId : user.uid;

  const getStudentStatusForDate = (date: Date) => {
    if (!isStudentOrParent || !targetStudentUid) return 'H'; // Default to Holiday/Neutral if not student
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayAttendance = attendance.filter(a => a.date === dateStr);
    
    // Priority: Absent > Late > Present
    let finalStatus = 'H';
    for (const session of dayAttendance) {
      const status = session.records[targetStudentUid];
      if (status === 'absent') return 'A';
      if (status === 'late') finalStatus = 'L';
      if (status === 'present' && finalStatus === 'H') finalStatus = 'P';
    }
    return finalStatus;
  };

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  
  // Find all punch times for selected date
  const allPunches: { time: string; session: string; status: string }[] = [];

  if (targetStudentUid) {
    const dayRecords = attendance.filter(a => a.date === selectedDateStr && a.records[targetStudentUid]);
    dayRecords.forEach(r => {
      const status = r.records[targetStudentUid];
      const times = r.timeRecords?.[targetStudentUid] || [];
      const timeList = Array.isArray(times) ? times : [times];
      
      timeList.forEach(t => {
        allPunches.push({
          time: t,
          session: r.sessionName || r.sessionId,
          status: status
        });
      });
    });
    allPunches.sort((a, b) => a.time.localeCompare(b.time));
  }

  const inTime = allPunches.length > 0 ? allPunches[0].time : "--:--";
  const outTime = allPunches.length > 0 ? allPunches[allPunches.length - 1].time : "--:--";

  return (
    <div className="flex flex-col space-y-4 pb-20">
      {/* Header */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-bold text-[#002B9A]">View Attendance</h2>
        </div>
        <div className="w-fit bg-[#002B9A] text-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-md">
          CLASS ATTENDANCE
        </div>
      </div>

      {/* Calendar Card */}
      <div className="bg-white p-5 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-50">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-1 hover:bg-gray-100 rounded-full text-[#002B9A]"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button className="flex items-center space-x-1 text-[#002B9A] font-bold text-sm">
              <span>{format(currentMonth, 'MMMM yyyy')}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-1 hover:bg-gray-100 rounded-full text-[#002B9A]"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 rounded-full bg-[#1B5E20]"></div>
              <span className="text-[10px] font-bold text-gray-400 uppercase">P</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 rounded-full bg-[#A18800]"></div>
              <span className="text-[10px] font-bold text-gray-400 uppercase">L</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 rounded-full bg-[#D32F2F]"></div>
              <span className="text-[10px] font-bold text-gray-400 uppercase">A</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 rounded-full bg-[#9C27B0]"></div>
              <span className="text-[10px] font-bold text-gray-400 uppercase">H</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-y-4">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center text-[11px] font-bold text-gray-500">
              {day}
            </div>
          ))}
          
          {calendarDays.map((day, idx) => {
            const status = getStudentStatusForDate(day);
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, monthStart);
            
            let bgColor = "bg-[#9C27B0]"; // Default Purple (H)
            if (status === 'P') bgColor = "bg-[#1B5E20]";
            if (status === 'A') bgColor = "bg-[#D32F2F]";
            if (status === 'L') bgColor = "bg-[#A18800]";
            if (isSelected) bgColor = "bg-[#002B9A]"; // Selected Blue
            if (!isCurrentMonth) bgColor = "bg-gray-200"; // Light gray for other month

            return (
              <div key={idx} className="flex justify-center">
                <button
                  onClick={() => setSelectedDate(day)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold text-white transition-all active:scale-90 ${bgColor} shadow-sm`}
                >
                  {format(day, 'd')}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Details Card */}
      <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-50 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#002B9A] mb-1">Punches of {format(selectedDate, 'MMM d, yyyy')}</h3>
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-xs font-bold text-[#1B5E20]">
                <Clock className="w-3 h-3 mr-1" />
                In: {inTime}
              </div>
              <div className="flex items-center text-xs font-bold text-[#D32F2F]">
                <Clock className="w-3 h-3 mr-1" />
                Out: {outTime}
              </div>
            </div>
          </div>
          <div className="bg-blue-50 px-3 py-1 rounded-full">
            <span className="text-[10px] font-bold text-blue-600 uppercase">
              {getStudentStatusForDate(selectedDate) === 'P' ? 'Present' : 
               getStudentStatusForDate(selectedDate) === 'A' ? 'Absent' :
               getStudentStatusForDate(selectedDate) === 'L' ? 'Late' : 'Holiday'}
            </span>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-50">
          <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
            <Info className="w-4 h-4 mr-2 text-blue-600" />
            Punch Report
          </h3>
          
          <div className="space-y-3">
            {allPunches.length > 0 ? (
              allPunches.map((punch, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      punch.status === 'present' ? 'bg-[#1B5E20]/10 text-[#1B5E20]' :
                      punch.status === 'late' ? 'bg-[#A18800]/10 text-[#A18800]' :
                      'bg-[#D32F2F]/10 text-[#D32F2F]'
                    }`}>
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">{punch.session}</p>
                      <p className="text-[10px] text-gray-500 capitalize">{punch.status}</p>
                    </div>
                  </div>
                  <div className="text-xs font-bold text-[#002B9A]">
                    {punch.time}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6">
                <Clock className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400 font-medium">No punches recorded for this date</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
