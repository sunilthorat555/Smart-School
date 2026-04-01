import React, { useState, useEffect } from 'react';
import { UserProfile, ClassData, StudentData, AttendanceRecord, SchoolData } from '../../types';
import { db, collection, setDoc, doc, OperationType, handleFirestoreError } from '../../firebase';
import { Search, Check, X, Clock, Loader2, Save, Calendar as CalendarIcon, Filter, Users, Camera, Scan, RotateCcw, UserCheck, AlertCircle, CheckCircle2, Building2 } from 'lucide-react';
import { format, differenceInMinutes, parse } from 'date-fns';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import * as faceapi from 'face-api.js';

interface Props {
  user: UserProfile;
  classes: ClassData[];
  students: StudentData[];
  attendance: AttendanceRecord[];
  schools: SchoolData[];
}

export const AttendanceMarking: React.FC<Props> = ({ user, classes, students, attendance, schools }) => {
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(user.role === 'admin' ? 'all' : user.schoolId || '');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSession, setSelectedSession] = useState<'morning' | 'afternoon' | 'subject'>('morning');
  const [sessionName, setSessionName] = useState('General');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [records, setRecords] = useState<Record<string, 'present' | 'absent' | 'late'>>({});
  const [timeRecords, setTimeRecords] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ 
    type: 'success' | 'error' | 'info'; 
    message: string; 
    studentName?: string 
  } | null>(null);
  const [autoSave, setAutoSave] = useState(true);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [markingMode, setMarkingMode] = useState<'face' | 'manual'>('face');

  const loadModels = async () => {
    const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      setModelsLoaded(true);
      return true;
    } catch (err) {
      console.error('Error loading face-api models:', err);
      toast.error('Failed to load face recognition models');
      return false;
    }
  };

  // Automatic scanning loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCameraActive && !isScanning && !scanResult && selectedClassId && modelsLoaded) {
      interval = setInterval(() => {
        handleRecognition();
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isCameraActive, isScanning, scanResult, selectedClassId, modelsLoaded]);

  // Clear scan result after a few seconds
  useEffect(() => {
    if (scanResult) {
      const timer = setTimeout(() => setScanResult(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [scanResult]);

  // Load existing attendance if available
  useEffect(() => {
    if (selectedClassId && date && selectedSession) {
      const existing = attendance.find(a => 
        a.classId === selectedClassId && 
        a.date === date && 
        a.sessionId === selectedSession
      );
      
      if (existing) {
        setRecords(existing.records);
        // Ensure timeRecords are arrays
        const normalizedTimeRecords: Record<string, string[]> = {};
        if (existing.timeRecords) {
          Object.entries(existing.timeRecords).forEach(([id, times]) => {
            normalizedTimeRecords[id] = Array.isArray(times) ? times : [times];
          });
        }
        setTimeRecords(normalizedTimeRecords);
        setSessionName(existing.sessionName);
      } else {
        // Initialize with all absent
        const initialRecords: Record<string, 'present' | 'absent' | 'late'> = {};
        const initialTimeRecords: Record<string, string[]> = {};
        students.filter(s => s.classId === selectedClassId).forEach(s => {
          initialRecords[s.id] = 'absent';
          initialTimeRecords[s.id] = [];
        });
        setRecords(initialRecords);
        setTimeRecords(initialTimeRecords);
      }
    }
  }, [selectedClassId, date, selectedSession, attendance, students]);

  const handleToggleStatus = (studentId: string) => {
    const now = format(new Date(), 'HH:mm:ss');
    setRecords(prev => {
      const current = prev[studentId] || 'present';
      let next: 'present' | 'absent' | 'late' = 'present';
      if (current === 'present') next = 'absent';
      else if (current === 'absent') next = 'late';
      else if (current === 'late') next = 'present';
      
      return { ...prev, [studentId]: next };
    });
    setTimeRecords(prev => ({ 
      ...prev, 
      [studentId]: [...(prev[studentId] || []), now] 
    }));
  };

  const handleBulkMark = (status: 'present' | 'absent') => {
    const now = format(new Date(), 'HH:mm:ss');
    const newRecords = { ...records };
    const newTimeRecords = { ...timeRecords };
    filteredStudents.forEach(s => {
      newRecords[s.id] = status;
      newTimeRecords[s.id] = [...(newTimeRecords[s.id] || []), now];
    });
    setRecords(newRecords);
    setTimeRecords(newTimeRecords);
  };

  const saveAttendance = async (currentRecords: Record<string, any>, currentTimeRecords: Record<string, string[]>) => {
    if (!selectedClassId) return;

    try {
      const selectedClass = classes.find(c => c.id === selectedClassId);
      const schoolId = selectedClass?.schoolId || user.schoolId || '';
      
      const attendanceId = `${selectedClassId}-${date}-${selectedSession}`;
      const newAttendance: AttendanceRecord = {
        id: attendanceId,
        date,
        classId: selectedClassId,
        schoolId,
        sessionId: selectedSession,
        sessionName,
        records: currentRecords,
        timeRecords: currentTimeRecords,
        markedBy: user.uid,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'attendance', attendanceId), newAttendance);
      if (!autoSave) toast.success('Attendance saved successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'attendance');
    }
  };

  const handleSave = async () => {
    if (!selectedClassId) {
      toast.error('Please select a class');
      return;
    }

    setLoading(true);
    await saveAttendance(records, timeRecords);
    setLoading(false);
  };

  const filteredStudents = students.filter(s => 
    s.classId === selectedClassId && 
    (s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     s.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const stats = {
    present: Object.values(records).filter(v => v === 'present').length,
    absent: Object.values(records).filter(v => v === 'absent').length,
    late: Object.values(records).filter(v => v === 'late').length,
    total: filteredStudents.length
  };

  const allScans = Object.entries(timeRecords).flatMap(([studentId, times]) => {
    const student = students.find(s => s.id === studentId);
    if (!student || student.classId !== selectedClassId || !Array.isArray(times)) return [];
    return times.map((time, idx) => ({
      student,
      time,
      scanIndex: idx + 1
    }));
  }).sort((a, b) => b.time.localeCompare(a.time));

  const startCamera = async () => {
    try {
      if (!modelsLoaded) {
        const loaded = await loadModels();
        if (!loaded) return;
      }

      console.log("Starting camera...");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      
      // Wait a bit for the ref to be populated if it's not yet
      if (!videoRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        console.log("Camera started successfully");
      } else {
        console.error("Video ref is still null after waiting");
        toast.error('Camera preview element not found. Please try again.');
        // Stop the stream if we can't use it
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (err) {
      toast.error('Could not access camera. Please check permissions.');
      console.error("Camera error:", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
    }
  };

  const handleRecognition = async () => {
    if (!selectedClassId || !videoRef.current || !modelsLoaded) return;
    
    const registeredInClass = filteredStudents.filter(s => s.faceDescriptor);
    if (registeredInClass.length === 0) return;

    setIsScanning(true);
    setScanResult(null);
    
    try {
      const detection = await faceapi.detectSingleFace(
        videoRef.current, 
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks().withFaceDescriptor();

      if (detection) {
        // Create labeled descriptors for matching
        const labeledDescriptors = registeredInClass.map(student => {
          // Convert back to Float32Array for face-api
          const descriptor = new Float32Array(student.faceDescriptor!);
          return new faceapi.LabeledFaceDescriptors(student.id, [descriptor]);
        });

        const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
        const bestMatch = faceMatcher.findBestMatch(detection.descriptor);

        if (bestMatch.label !== 'unknown') {
          const matchedStudent = registeredInClass.find(s => s.id === bestMatch.label);
          
          if (matchedStudent) {
            const now = new Date();
            const nowStr = format(now, 'HH:mm:ss');
            
            // Check for 5-minute cooldown
            const studentTimes = timeRecords[matchedStudent.id] || [];
            const lastTimeStr = studentTimes[studentTimes.length - 1];
            
            if (lastTimeStr) {
              const lastTime = parse(lastTimeStr, 'HH:mm:ss', new Date());
              const diff = differenceInMinutes(now, lastTime);
              
              if (diff < 5) {
                setScanResult({ 
                  type: 'info', 
                  message: 'Already Present', 
                  studentName: matchedStudent.name 
                });
                setIsScanning(false);
                return;
              }
            }

            const updatedRecords = { ...records, [matchedStudent.id]: 'present' };
            const updatedTimeRecords = { 
              ...timeRecords, 
              [matchedStudent.id]: [...(timeRecords[matchedStudent.id] || []), nowStr] 
            };
            
            setRecords(updatedRecords);
            setTimeRecords(updatedTimeRecords);
            setScanResult({ 
              type: 'success', 
              message: 'Attendance Marked', 
              studentName: matchedStudent.name 
            });
            toast.success(`Recognized: ${matchedStudent.name}`);

            if (autoSave) {
              saveAttendance(updatedRecords, updatedTimeRecords);
            }
          }
        } else {
          setScanResult({ type: 'error', message: 'Face not Recognized' });
        }
      }
    } catch (err) {
      console.error('Recognition error:', err);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (selectedClassId && markingMode === 'face') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [selectedClassId, markingMode]);

  const filteredClasses = classes.filter(c => 
    selectedSchoolId === 'all' || c.schoolId === selectedSchoolId
  );

  return (
    <div className="space-y-6">
      {/* Configuration Header */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {user.role === 'admin' && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Select School</label>
              <select
                value={selectedSchoolId}
                onChange={(e) => {
                  setSelectedSchoolId(e.target.value);
                  setSelectedClassId('');
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
          <div className={user.role === 'admin' ? "" : "lg:col-span-1"}>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Select Class</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
            >
              <option value="">Choose a class...</option>
              {filteredClasses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {selectedSchoolId === 'all' ? `(${schools.find(s => s.id === c.schoolId)?.name || 'Unknown School'})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Date</label>
            <div className="relative">
              <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Session Type</label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value as any)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
            >
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="subject">Subject-wise</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Session Name</label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="e.g. Mathematics"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold"
            />
          </div>
        </div>

        <div className="flex items-center justify-center p-1 bg-gray-100 rounded-2xl w-full max-w-md mx-auto">
          <button
            onClick={() => setMarkingMode('face')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl font-bold transition-all ${
              markingMode === 'face' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Scan className="w-4 h-4" />
            <span>Face Recognition</span>
          </button>
          <button
            onClick={() => setMarkingMode('manual')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl font-bold transition-all ${
              markingMode === 'manual' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Manual Marking</span>
          </button>
        </div>
      </div>

      {selectedClassId ? (
        <>
          {/* Stats & Search */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center space-x-4">
              <div className="px-4 py-2 bg-present-light text-present rounded-xl font-bold text-sm">
                Present: {stats.present}
              </div>
              <div className="px-4 py-2 bg-absent-light text-absent rounded-xl font-bold text-sm">
                Absent: {stats.absent}
              </div>
              <div className="px-4 py-2 bg-late-light text-late rounded-xl font-bold text-sm">
                Late: {stats.late}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Left Column: Camera & Recent Scans */}
            <div className={`${markingMode === 'face' ? 'xl:col-span-4' : 'hidden'} space-y-6`}>
              {/* Camera Preview */}
              <div className="bg-gray-900 rounded-[2.5rem] overflow-hidden relative aspect-video shadow-2xl">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                
                {/* Scanning Overlay */}
                <AnimatePresence>
                  {isScanning && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 border-4 border-blue-500/50 flex items-center justify-center"
                    >
                      <div className="absolute inset-0 bg-blue-500/10 animate-pulse" />
                      <div className="relative w-48 h-48 border-2 border-blue-400 rounded-3xl">
                        <motion.div
                          animate={{ top: ['0%', '100%', '0%'] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          className="absolute left-0 right-0 h-0.5 bg-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.8)]"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Scan Result Overlay */}
                <AnimatePresence>
                  {scanResult && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className={`absolute inset-0 flex items-center justify-center backdrop-blur-sm z-30 ${
                        scanResult.type === 'success' ? 'bg-present/20' : 
                        scanResult.type === 'error' ? 'bg-absent/20' : 
                        'bg-late/20'
                      }`}
                    >
                      <div className="bg-white p-4 rounded-3xl shadow-2xl text-center max-w-[200px] mx-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${
                          scanResult.type === 'success' ? 'bg-present-light text-present' : 
                          scanResult.type === 'error' ? 'bg-absent-light text-absent' : 
                          'bg-late-light text-late'
                        }`}>
                          {scanResult.type === 'success' ? <CheckCircle2 className="w-8 h-8" /> : 
                           scanResult.type === 'error' ? <AlertCircle className="w-8 h-8" /> : 
                           <Clock className="w-8 h-8" />}
                        </div>
                        <h3 className={`text-lg font-bold mb-1 ${
                          scanResult.type === 'success' ? 'text-present' : 
                          scanResult.type === 'error' ? 'text-absent' : 
                          'text-late'
                        }`}>
                          {scanResult.message}
                        </h3>
                        {scanResult.studentName && (
                          <p className="text-gray-600 text-sm font-medium">{scanResult.studentName}</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="absolute bottom-4 right-4 flex items-center space-x-2">
                  <div className="flex items-center bg-white/20 backdrop-blur px-3 py-1.5 rounded-xl">
                    <label className="flex items-center cursor-pointer">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          className="sr-only" 
                          checked={autoSave}
                          onChange={() => setAutoSave(!autoSave)}
                        />
                        <div className={`block w-8 h-5 rounded-full transition-colors ${autoSave ? 'bg-blue-500' : 'bg-gray-600'}`}></div>
                        <div className={`absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform ${autoSave ? 'translate-x-3' : ''}`}></div>
                      </div>
                      <span className="ml-2 text-white text-[10px] font-bold">Auto-Save</span>
                    </label>
                  </div>
                  <button
                    onClick={() => {
                      setRecords({});
                      setTimeRecords({});
                    }}
                    className="p-2 bg-white/20 backdrop-blur text-white rounded-xl hover:bg-white/30 transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Recent Scans List */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-col">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Scans</h3>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar max-h-[300px]">
                  {allScans.map((scan, index) => (
                    <motion.div
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      key={`${scan.student.id}-${scan.time}-${index}`}
                      className="flex items-center justify-between p-3 bg-present-light rounded-2xl border border-present-light"
                    >
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-present text-white rounded-full flex items-center justify-center text-xs font-bold mr-3">
                          {scan.student.rollNumber}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{scan.student.name}</p>
                          <div className="flex items-center space-x-2">
                            <p className="text-[10px] text-present font-bold uppercase">Present</p>
                            <span className="text-[9px] bg-present-light text-present px-1.5 py-0.5 rounded font-bold">
                              #{scan.scanIndex}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] text-gray-400 font-medium flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {scan.time}
                      </div>
                    </motion.div>
                  ))}
                  {allScans.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center py-8">
                      <Camera className="w-10 h-10 text-gray-200 mb-2" />
                      <p className="text-gray-400 text-sm font-medium">Waiting for face...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Student List */}
            <div className={`${markingMode === 'face' ? 'xl:col-span-8' : 'xl:col-span-12'} space-y-6`}>
              {/* Stats & Search */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row gap-4 w-full">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search student..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => handleBulkMark('present')}
                      className="px-6 py-3 bg-present text-white font-bold rounded-xl hover:opacity-90 transition-all text-sm whitespace-nowrap"
                    >
                      Mark All Present
                    </button>
                    <button 
                      onClick={() => handleBulkMark('absent')}
                      className="px-6 py-3 bg-absent text-white font-bold rounded-xl hover:opacity-90 transition-all text-sm whitespace-nowrap"
                    >
                      Mark All Absent
                    </button>
                  </div>
                </div>
              </div>

              {/* Student List */}
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                  {filteredStudents.map((s) => {
                    const status = records[s.id] || 'present';
                    return (
                      <button
                        key={s.id}
                        onClick={() => handleToggleStatus(s.id)}
                        className={`p-4 rounded-2xl border-2 transition-all text-left flex items-center justify-between group ${
                          status === 'present' ? 'bg-present-light border-present-light hover:border-present' :
                          status === 'absent' ? 'bg-absent-light border-absent-light hover:border-absent' :
                          'bg-late-light border-late-light hover:border-late'
                        }`}
                      >
                        <div className="flex items-center">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mr-3 transition-colors ${
                            status === 'present' ? 'bg-present text-white' :
                            status === 'absent' ? 'bg-absent text-white' :
                            'bg-late text-white'
                          }`}>
                            {s.rollNumber}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 truncate max-w-[100px]">{s.name}</p>
                            <div className="flex items-center space-x-2">
                              <p className={`text-[10px] font-bold uppercase tracking-wider ${
                                status === 'present' ? 'text-present' :
                                status === 'absent' ? 'text-absent' :
                                'text-late'
                              }`}>
                                {status}
                              </p>
                              {timeRecords[s.id] && (
                                <span className="text-[9px] text-gray-400 font-mono">
                                  {(timeRecords[s.id] || []).slice(-1)[0]}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                          status === 'present' ? 'bg-present text-white' :
                          status === 'absent' ? 'bg-absent text-white' :
                          'bg-late text-white'
                        }`}>
                          {status === 'present' ? <Check className="w-4 h-4" /> : 
                           status === 'absent' ? <X className="w-4 h-4" /> : 
                           <Clock className="w-4 h-4" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {filteredStudents.length === 0 && (
                  <div className="py-20 text-center">
                    <Users className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium">No students found in this class.</p>
                  </div>
                )}

                <div className="p-6 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-xs text-gray-500 text-center sm:text-left">
                    Click on student to toggle: <span className="text-present font-bold">Present</span> | <span className="text-absent font-bold">Absent</span> | <span className="text-late font-bold">Late</span>
                  </p>
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className="w-full sm:w-auto flex items-center justify-center px-8 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                    Save Attendance
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="py-32 text-center bg-white rounded-3xl border border-dashed border-gray-200">
          <Filter className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-400">Select a class to start marking attendance</h3>
          <p className="text-gray-400 mt-2">Choose from the dropdown above to load student list.</p>
        </div>
      )}
    </div>
  );
};
