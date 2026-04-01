import React, { useState, useRef } from 'react';
import { UserProfile, SchoolData, ClassData, StudentData } from '../../types';
import { db, collection, setDoc, doc, deleteDoc, updateDoc, OperationType, handleFirestoreError } from '../../firebase';
import { Plus, Search, Edit2, Trash2, Users, Loader2, Upload, Download, FileSpreadsheet, X, Camera, CheckCircle2, AlertCircle, AlertTriangle, School } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { ConfirmationModal } from '../ConfirmationModal';
import * as faceapi from 'face-api.js';

interface Props {
  user: UserProfile;
  schools: SchoolData[];
  classes: ClassData[];
  students: StudentData[];
}

export const StudentManagement: React.FC<Props> = ({ user, schools, classes, students }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; student: StudentData | null }>({ isOpen: false, student: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(user.schoolId || 'all');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    rollNumber: '',
    classId: '',
    parentEmail: '',
    parentPhone: '',
    dateOfBirth: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    faceDescriptor: undefined as number[] | undefined
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);

  // Face Registration State
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false);
  const [selectedStudentForFace, setSelectedStudentForFace] = useState<StudentData | null>(null);
  const [isRegisteringFace, setIsRegisteringFace] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const loadModels = async () => {
    const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      return true;
    } catch (err) {
      console.error('Error loading face-api models:', err);
      toast.error('Failed to load face recognition models');
      return false;
    }
  };

  const startCamera = async () => {
    try {
      const modelsLoaded = await loadModels();
      if (!modelsLoaded) return;

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      
      // Wait a bit for the ref to be populated
      if (!videoRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      } else {
        toast.error('Camera preview element not found. Please try again.');
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (err) {
      toast.error('Could not access camera. Please check permissions.');
      console.error(err);
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

  const captureFace = async () => {
    if (!videoRef.current) return;
    
    setIsScanning(true);
    try {
      const detection = await faceapi.detectSingleFace(
        videoRef.current, 
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks().withFaceDescriptor();

      if (detection) {
        // Convert Float32Array to regular array for Firestore
        const descriptor = Array.from(detection.descriptor);
        
        if (selectedStudentForFace) {
          // Direct update from table action
          await updateDoc(doc(db, 'students', selectedStudentForFace.id), {
            faceDescriptor: descriptor
          });
          toast.success(`Face data registered for ${selectedStudentForFace.name}`);
          setIsFaceModalOpen(false);
        } else {
          // Update form data in Add/Edit modal
          setFormData(prev => ({ ...prev, faceDescriptor: descriptor }));
          toast.success('Face data captured successfully');
        }
        
        setIsScanning(false);
        setIsRegisteringFace(false);
        stopCamera();
      } else {
        toast.error('No face detected. Please position your face clearly in the frame.');
        setIsScanning(false);
      }
    } catch (err) {
      console.error('Face capture error:', err);
      toast.error('Failed to process face data');
      setIsScanning(false);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.rollNumber || !formData.classId) return;

    setLoading(true);
    try {
      const selectedClass = classes.find(c => c.id === formData.classId);
      const schoolId = selectedClass?.schoolId || user.schoolId || '';

      if (isEditing && editingStudentId) {
        await updateDoc(doc(db, 'students', editingStudentId), {
          ...formData,
          schoolId
        });
        toast.success('Student updated successfully');
      } else {
        const studentId = `std-${Date.now()}`;
        const newStudent: StudentData = {
          id: studentId,
          uid: studentId, // Placeholder UID
          ...formData,
          schoolId
        };

        await setDoc(doc(db, 'students', studentId), newStudent);
        
        // Update class student count
        const classRef = doc(db, 'classes', formData.classId);
        const classData = classes.find(c => c.id === formData.classId);
        if (classData) {
          await updateDoc(classRef, { studentCount: (classData.studentCount || 0) + 1 });
        }

        toast.success('Student added successfully');
      }
      
      resetForm();
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'students');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ 
      name: '', 
      rollNumber: '', 
      classId: '', 
      parentEmail: '', 
      parentPhone: '',
      dateOfBirth: '',
      address: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      faceDescriptor: undefined
    });
    setIsEditing(false);
    setEditingStudentId(null);
    setIsRegisteringFace(false);
    stopCamera();
  };

  const handleEditClick = (student: StudentData) => {
    setFormData({
      name: student.name,
      rollNumber: student.rollNumber,
      classId: student.classId,
      parentEmail: student.parentEmail || '',
      parentPhone: student.parentPhone || '',
      dateOfBirth: student.dateOfBirth || '',
      address: student.address || '',
      emergencyContactName: student.emergencyContactName || '',
      emergencyContactPhone: student.emergencyContactPhone || '',
      faceDescriptor: student.faceDescriptor
    });
    setIsEditing(true);
    setEditingStudentId(student.id);
    setSelectedStudentForFace(null); // Ensure we're not in standalone mode
    setIsModalOpen(true);
  };

  const handleFaceRegistrationClick = (student: StudentData) => {
    setSelectedStudentForFace(student);
    setIsFaceModalOpen(true);
    setIsRegisteringFace(true);
    startCamera();
  };

  const handleDeleteStudent = async (student: StudentData) => {
    setDeleteModal({ isOpen: true, student });
  };

  const confirmDelete = async () => {
    if (!deleteModal.student) return;

    try {
      await deleteDoc(doc(db, 'students', deleteModal.student.id));
      
      // Update class student count
      const classRef = doc(db, 'classes', deleteModal.student.classId);
      const classData = classes.find(c => c.id === deleteModal.student?.classId);
      if (classData) {
        await updateDoc(classRef, { studentCount: Math.max(0, (classData.studentCount || 0) - 1) });
      }

      toast.success('Student deleted successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `students/${deleteModal.student.id}`);
    } finally {
      setDeleteModal({ isOpen: false, student: null });
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        setLoading(true);
        let importedCount = 0;

        for (const row of data) {
          if (row.Name && row.RollNumber && row.ClassID) {
            const selectedClass = classes.find(c => c.id === row.ClassID);
            const schoolId = selectedClass?.schoolId || user.schoolId || '';
            
            const studentId = `std-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
            const newStudent: StudentData = {
              id: studentId,
              uid: studentId, // Placeholder UID
              name: row.Name,
              rollNumber: row.RollNumber.toString(),
              classId: row.ClassID,
              schoolId,
              parentEmail: row.ParentEmail || '',
              parentPhone: row.ParentPhone?.toString() || '',
              dateOfBirth: row.DateOfBirth || '',
              address: row.Address || '',
              emergencyContactName: row.EmergencyContactName || '',
              emergencyContactPhone: row.EmergencyContactPhone?.toString() || ''
            };
            await setDoc(doc(db, 'students', studentId), newStudent);
            
            // Update class count (simplified for bulk)
            const classRef = doc(db, 'classes', row.ClassID);
            const classData = classes.find(c => c.id === row.ClassID);
            if (classData) {
              await updateDoc(classRef, { studentCount: (classData.studentCount || 0) + 1 });
            }
            importedCount++;
          }
        }

        toast.success(`Successfully imported ${importedCount} students`);
      } catch (err) {
        console.error('Import error:', err);
        toast.error('Failed to import students. Check file format.');
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const template = [
      { 
        Name: 'John Doe', 
        RollNumber: '101', 
        ClassID: 'grade-10-a', 
        ParentEmail: 'parent@example.com', 
        ParentPhone: '1234567890',
        DateOfBirth: '2010-05-15',
        Address: '123 School St, City',
        EmergencyContactName: 'Jane Doe',
        EmergencyContactPhone: '0987654321'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "student_import_template.xlsx");
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         s.rollNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSchool = selectedSchoolId === 'all' || s.schoolId === selectedSchoolId;
    const matchesClass = selectedClassId === 'all' || s.classId === selectedClassId;
    return matchesSearch && matchesSchool && matchesClass;
  });

  const availableClasses = classes.filter(c => selectedSchoolId === 'all' || c.schoolId === selectedSchoolId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-4 flex-1 max-w-3xl">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or roll number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          {user.role === 'admin' && (
            <select
              value={selectedSchoolId}
              onChange={(e) => {
                setSelectedSchoolId(e.target.value);
                setSelectedClassId('all');
              }}
              className="px-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-gray-700"
            >
              <option value="all">All Schools</option>
              {schools.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        {user.role !== 'admin' && (
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-gray-700"
          >
            <option value="all">All Classes</option>
            {availableClasses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={downloadTemplate}
            className="flex items-center px-4 py-3 bg-white border border-gray-200 text-gray-600 font-bold rounded-2xl hover:bg-gray-50 transition-all shadow-sm"
          >
            <Download className="w-5 h-5 mr-2" />
            <span className="hidden sm:inline">Template</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center px-4 py-3 bg-white border border-gray-200 text-gray-600 font-bold rounded-2xl hover:bg-gray-50 transition-all shadow-sm"
          >
            <Upload className="w-5 h-5 mr-2" />
            <span className="hidden sm:inline">Bulk Import</span>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImportExcel} 
              className="hidden" 
              accept=".xlsx, .xls, .csv" 
            />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Student
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Roll No</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Student Name</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Class</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Face Data</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Parent Contact</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStudents.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="font-bold text-gray-900">{s.rollNumber}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs mr-3">
                        {s.name.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-900">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold w-fit">
                        {classes.find(c => c.id === s.classId)?.name || s.classId}
                      </span>
                      {user.role === 'admin' && (
                        <span className="text-[10px] text-blue-600 font-bold mt-1 flex items-center">
                          <School className="w-2.5 h-2.5 mr-1" />
                          {schools.find(sch => sch.id === s.schoolId)?.name || 'Unknown'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {s.faceDescriptor ? (
                      <span className="flex items-center text-emerald-600 text-xs font-bold">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Registered
                      </span>
                    ) : (
                      <span className="flex items-center text-amber-600 text-xs font-bold">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Not Registered
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <p className="text-gray-900">{s.parentPhone || 'N/A'}</p>
                      <p className="text-gray-400 text-xs">{s.parentEmail || 'N/A'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleFaceRegistrationClick(s)}
                        className="p-2 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 rounded-xl"
                        title="Register Face"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleEditClick(s)}
                        className="p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded-xl"
                        title="Edit Student"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteStudent(s)}
                        className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-xl"
                        title="Delete Student"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredStudents.length === 0 && (
          <div className="py-20 text-center">
            <Users className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No students found matching your criteria.</p>
          </div>
        )}
      </div>

      {/* Face Registration Standalone Modal */}
      {isFaceModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-600 to-indigo-600">
              <div>
                <h3 className="text-xl font-bold text-white">Face Registration</h3>
                <p className="text-blue-100 text-sm">{selectedStudentForFace?.name}</p>
              </div>
              <button 
                onClick={() => { setIsFaceModalOpen(false); stopCamera(); }} 
                className="p-2 hover:bg-white/10 rounded-2xl transition-colors text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8">
              <div className="bg-gray-900 rounded-[2rem] overflow-hidden relative aspect-square shadow-2xl mb-8 group">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 border-[40px] border-gray-900/40" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-dashed border-blue-400/50 rounded-full" />
                </div>

                <AnimatePresence>
                  {isScanning && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-[2px]" />
                      <div className="relative w-72 h-72">
                        <motion.div
                          animate={{ top: ['0%', '100%', '0%'] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          className="absolute left-0 right-0 h-1 bg-blue-400 shadow-[0_0_20px_rgba(59,130,246,1)] z-10"
                        />
                        <div className="absolute inset-0 border-4 border-blue-400 rounded-[3rem] animate-pulse" />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="absolute top-6 left-6 right-6 flex justify-between items-start">
                  <div className="px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 flex items-center">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">Live Preview</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start">
                  <AlertCircle className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
                  <p className="text-sm text-blue-800 leading-relaxed">
                    Ensure the student is in a well-lit area and looking directly at the camera. Remove glasses or masks for better accuracy.
                  </p>
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={captureFace}
                    disabled={isScanning}
                    className="flex-1 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all flex items-center justify-center shadow-lg shadow-blue-100 disabled:opacity-50"
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Camera className="w-5 h-5 mr-2" />
                        Capture & Register
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsFaceModalOpen(false); stopCamera(); }}
                    className="px-8 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">{isEditing ? 'Edit Student' : 'Add New Student'}</h3>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleAddStudent} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. John Doe"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Roll Number</label>
                  <input
                    type="text"
                    value={formData.rollNumber}
                    onChange={(e) => setFormData({...formData, rollNumber: e.target.value})}
                    placeholder="e.g. 101"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Class</label>
                  <select
                    value={formData.classId}
                    onChange={(e) => setFormData({...formData, classId: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  >
                    <option value="">Select Class</option>
                    {availableClasses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Address</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    placeholder="Full residential address"
                    rows={2}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                </div>
                
                <div className="md:col-span-2 border-t border-gray-100 pt-4 mt-2">
                  <h4 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4">Face Registration</h4>
                  
                  {isRegisteringFace ? (
                    <div className="bg-gray-900 rounded-2xl overflow-hidden relative aspect-video shadow-lg mb-4">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
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
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
                        <button
                          type="button"
                          onClick={captureFace}
                          disabled={isScanning}
                          className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all flex items-center disabled:opacity-50"
                        >
                          {isScanning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
                          Capture Face
                        </button>
                        <button
                          type="button"
                          onClick={() => { setIsRegisteringFace(false); stopCamera(); }}
                          className="px-6 py-2 bg-white/20 backdrop-blur text-white font-bold rounded-xl hover:bg-white/30 transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-200">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${formData.faceDescriptor ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                          {formData.faceDescriptor ? <CheckCircle2 className="w-6 h-6" /> : <Camera className="w-6 h-6" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            {formData.faceDescriptor ? 'Face Data Registered' : 'No Face Data Registered'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formData.faceDescriptor ? 'Student can use face recognition' : 'Required for face recognition attendance'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setIsRegisteringFace(true); startCamera(); }}
                        className="px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-50 transition-all shadow-sm"
                      >
                        {formData.faceDescriptor ? 'Re-register Face' : 'Register Face'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="md:col-span-2 border-t border-gray-100 pt-4 mt-2">
                  <h4 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-4">Parent / Guardian Information</h4>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Parent Email</label>
                  <input
                    type="email"
                    value={formData.parentEmail}
                    onChange={(e) => setFormData({...formData, parentEmail: e.target.value})}
                    placeholder="parent@example.com"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Parent Phone</label>
                  <input
                    type="tel"
                    value={formData.parentPhone}
                    onChange={(e) => setFormData({...formData, parentPhone: e.target.value})}
                    placeholder="1234567890"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="md:col-span-2 border-t border-gray-100 pt-4 mt-2">
                  <h4 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-4">Emergency Contact</h4>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Contact Name</label>
                  <input
                    type="text"
                    value={formData.emergencyContactName}
                    onChange={(e) => setFormData({...formData, emergencyContactName: e.target.value})}
                    placeholder="Emergency contact person"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Contact Phone</label>
                  <input
                    type="tel"
                    value={formData.emergencyContactPhone}
                    onChange={(e) => setFormData({...formData, emergencyContactPhone: e.target.value})}
                    placeholder="Emergency phone number"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
              <div className="flex space-x-3 pt-6">
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); resetForm(); }}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center shadow-lg shadow-blue-100"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isEditing ? 'Update Student' : 'Add Student')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        title="Delete Student?"
        message={`Are you sure you want to delete ${deleteModal.student?.name}? This will permanently remove their record and attendance history.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, student: null })}
        confirmText="Delete Student"
        type="danger"
      />
    </div>
  );
};
