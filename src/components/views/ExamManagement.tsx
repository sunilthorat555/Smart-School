import React, { useState, useEffect } from 'react';
import { UserProfile, ClassData, StudentData, Exam, ExamResult, SchoolData, MCQQuestion, ExamType, ExamFormat } from '../../types';
import { db, collection, addDoc, deleteDoc, doc, updateDoc, OperationType, handleFirestoreError, onSnapshot, query, where, setDoc, storage, ref, uploadBytes, getDownloadURL } from '../../firebase';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Save, 
  X, 
  FileText, 
  ClipboardList, 
  ChevronRight, 
  Search,
  Calendar as CalendarIcon,
  Award,
  CheckCircle2,
  Clock,
  Upload,
  Eye,
  Check,
  AlertCircle,
  FileDown,
  Image as ImageIcon
} from 'lucide-react';
import { format, isAfter, isBefore, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface Props {
  user: UserProfile;
  classes: ClassData[];
  students: StudentData[];
  exams: Exam[];
  examResults: ExamResult[];
  schools: SchoolData[];
}

export const ExamManagement: React.FC<Props> = ({ user, classes, students, exams, examResults, schools }) => {
  const [isAddingExam, setIsAddingExam] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [isTakingExam, setIsTakingExam] = useState(false);
  const [isViewingResults, setIsViewingResults] = useState(false);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(user.schoolId || 'all');
  
  const isTeacherOrAdmin = user.role === 'admin' || user.role === 'teacher';
  const isAdmin = user.role === 'admin';
  const targetStudentUid = user.role === 'parent' ? user.childId : (user.role === 'student' ? user.uid : null);

  // New Exam State
  const [newExam, setNewExam] = useState<{
    title: string;
    type: ExamType;
    format: ExamFormat;
    subject: string;
    classId: string;
    date: string;
    startTime: string;
    endTime: string;
    maxMarks: number;
    questions: MCQQuestion[];
    questionPaperUrl: string;
  }>({
    title: '',
    type: 'Unit Test',
    format: 'MCQ',
    subject: '',
    classId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    endTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    maxMarks: 0,
    questions: [],
    questionPaperUrl: ''
  });

  // MCQ Question Form State
  const [currentQuestion, setCurrentQuestion] = useState<MCQQuestion>({
    id: Math.random().toString(36).substr(2, 9),
    question: '',
    options: ['', '', '', ''],
    correctOptionIndex: 0,
    marks: 1
  });

  // Student Exam State
  const [studentAnswers, setStudentAnswers] = useState<Record<string, number>>({});
  const [answerSheetFiles, setAnswerSheetFiles] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (file: File, path: string) => {
    try {
      setUploading(true);
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      return url;
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload file');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleAddQuestion = () => {
    if (!currentQuestion.question || currentQuestion.options.some(o => !o)) {
      toast.error('Please fill the question and all 4 options');
      return;
    }
    setNewExam(prev => ({
      ...prev,
      questions: [...prev.questions, currentQuestion],
      maxMarks: prev.maxMarks + currentQuestion.marks
    }));
    setCurrentQuestion({
      id: Math.random().toString(36).substr(2, 9),
      question: '',
      options: ['', '', '', ''],
      correctOptionIndex: 0,
      marks: 1
    });
  };

  const handleRemoveQuestion = (id: string) => {
    setNewExam(prev => {
      const q = prev.questions.find(q => q.id === id);
      return {
        ...prev,
        questions: prev.questions.filter(q => q.id !== id),
        maxMarks: prev.maxMarks - (q?.marks || 0)
      };
    });
  };

  const handleAddExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExam.title || !newExam.classId || !newExam.subject) {
      toast.error('Please fill all required fields');
      return;
    }

    if (newExam.format === 'MCQ' && newExam.questions.length === 0) {
      toast.error('Please add at least one question');
      return;
    }

    try {
      const targetClass = classes.find(c => c.id === newExam.classId);
      const examData = {
        ...newExam,
        schoolId: targetClass?.schoolId || user.schoolId || '',
        authorId: user.uid,
        updatedAt: new Date().toISOString()
      };

      if (editingExamId) {
        await updateDoc(doc(db, 'exams', editingExamId), examData);
        toast.success('Exam updated successfully');
      } else {
        await addDoc(collection(db, 'exams'), {
          ...examData,
          createdAt: new Date().toISOString()
        });
        toast.success('Exam created successfully');
      }

      setIsAddingExam(false);
      setEditingExamId(null);
      setNewExam({
        title: '',
        type: 'Unit Test',
        format: 'MCQ',
        subject: '',
        classId: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        startTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        endTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        maxMarks: 0,
        questions: [],
        questionPaperUrl: ''
      });
    } catch (err) {
      handleFirestoreError(err, editingExamId ? OperationType.UPDATE : OperationType.CREATE, 'exams');
    }
  };

  const handleEditExam = (exam: Exam) => {
    setNewExam({
      title: exam.title,
      type: exam.type,
      format: exam.format,
      subject: exam.subject,
      classId: exam.classId,
      date: exam.date,
      startTime: exam.startTime,
      endTime: exam.endTime,
      maxMarks: exam.maxMarks,
      questions: exam.questions || [],
      questionPaperUrl: exam.questionPaperUrl || ''
    });
    setEditingExamId(exam.id);
    setIsAddingExam(true);
  };

  const handleDeleteExam = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this exam and all its results?')) return;
    
    try {
      await deleteDoc(doc(db, 'exams', id));
      toast.success('Exam deleted');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `exams/${id}`);
    }
  };

  const submitExam = async () => {
    if (!selectedExam || !targetStudentUid) return;
    setIsSubmitting(true);

    try {
      let marksObtained = 0;
      let status: 'Pending' | 'Graded' = 'Graded';

      if (selectedExam.format === 'MCQ') {
        selectedExam.questions?.forEach((q, idx) => {
          if (studentAnswers[q.id] === q.correctOptionIndex) {
            marksObtained += q.marks;
          }
        });
      } else {
        status = 'Pending';
      }

      const resultId = `${selectedExam.id}_${targetStudentUid}`;
      await setDoc(doc(db, 'examResults', resultId), {
        id: resultId,
        examId: selectedExam.id,
        studentId: targetStudentUid,
        classId: selectedExam.classId,
        schoolId: selectedExam.schoolId,
        marksObtained,
        answers: selectedExam.format === 'MCQ' ? selectedExam.questions?.map(q => studentAnswers[q.id] ?? -1) : [],
        answerSheetUrls: answerSheetFiles,
        status,
        createdAt: new Date().toISOString()
      });

      toast.success('Exam submitted successfully');
      setIsTakingExam(false);
      setSelectedExam(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'examResults');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredExams = exams.filter(exam => {
    let matchesRole = false;
    if (user.role === 'admin') {
      matchesRole = !user.schoolId || exam.schoolId === user.schoolId;
    } else if (user.role === 'teacher') {
      matchesRole = exam.schoolId === user.schoolId;
    } else if (user.role === 'parent' || user.role === 'student') {
      const student = students.find(s => s.uid === targetStudentUid);
      if (!student) return false;
      return exam.classId === student.classId;
    }

    const matchesSchool = selectedSchoolId === 'all' || exam.schoolId === selectedSchoolId;
    
    return matchesRole && matchesSchool;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const availableClasses = isAdmin 
    ? (selectedSchoolId === 'all' ? classes : classes.filter(c => c.schoolId === selectedSchoolId))
    : (user.schoolId ? classes.filter(c => c.schoolId === user.schoolId) : classes);

  const getExamStatus = (exam: Exam) => {
    const now = new Date();
    const start = parseISO(exam.startTime);
    const end = parseISO(exam.endTime);

    if (isBefore(now, start)) return 'Upcoming';
    if (isAfter(now, end)) return 'Expired';
    return 'Ongoing';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            {isTeacherOrAdmin ? 'Exam Management' : 'Online Exams'}
          </h2>
          <p className="text-sm text-gray-500">
            {isTeacherOrAdmin ? 'Create exams, manage questions and view results' : 'View and participate in scheduled assessments'}
          </p>
        </div>
        {isTeacherOrAdmin && !isAddingExam && !isTakingExam && !isViewingResults && (
          <div className="flex flex-col sm:flex-row gap-2">
            {isAdmin && !user.schoolId && (
              <select
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                className="px-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-gray-700"
              >
                <option value="all">All Schools</option>
                {schools.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
            <button 
              onClick={() => setIsAddingExam(true)}
              className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Exam
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isAddingExam && isTeacherOrAdmin ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100"
          >
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-gray-900">{editingExamId ? 'Edit Assessment' : 'Create New Assessment'}</h3>
              <button onClick={() => {
                setIsAddingExam(false);
                setEditingExamId(null);
              }} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleAddExam} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Exam Title</label>
                  <input 
                    type="text" 
                    value={newExam.title}
                    onChange={e => setNewExam({...newExam, title: e.target.value})}
                    placeholder="e.g. Unit Test 1" 
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Subject</label>
                  <input 
                    type="text" 
                    value={newExam.subject}
                    onChange={e => setNewExam({...newExam, subject: e.target.value})}
                    placeholder="e.g. Mathematics" 
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Exam Type</label>
                  <select 
                    value={newExam.type}
                    onChange={e => setNewExam({...newExam, type: e.target.value as ExamType})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none font-bold"
                  >
                    <option value="Unit Test">Unit Test</option>
                    <option value="Semester Exam">Semester Exam</option>
                    <option value="Practice Test">Practice Test</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Class</label>
                  <select 
                    value={newExam.classId}
                    onChange={e => setNewExam({...newExam, classId: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none font-bold"
                    required
                  >
                    <option value="">Select Class</option>
                    {availableClasses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Start Time</label>
                  <input 
                    type="datetime-local" 
                    value={newExam.startTime}
                    onChange={e => setNewExam({...newExam, startTime: e.target.value, date: e.target.value.split('T')[0]})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">End Time</label>
                  <input 
                    type="datetime-local" 
                    value={newExam.endTime}
                    onChange={e => setNewExam({...newExam, endTime: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Exam Format</label>
                  <div className="flex space-x-4">
                    <button
                      type="button"
                      onClick={() => setNewExam({...newExam, format: 'MCQ'})}
                      className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all border ${newExam.format === 'MCQ' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-500 border-gray-100'}`}
                    >
                      MCQ (Auto-grading)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewExam({...newExam, format: 'Subjective'})}
                      className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all border ${newExam.format === 'Subjective' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-500 border-gray-100'}`}
                    >
                      Subjective (Upload)
                    </button>
                  </div>
                </div>
                {newExam.format === 'Subjective' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Question Paper (PDF/Image)</label>
                      <div className="flex items-center space-x-4">
                        <input 
                          type="url" 
                          value={newExam.questionPaperUrl}
                          onChange={e => setNewExam({...newExam, questionPaperUrl: e.target.value})}
                          placeholder="https://example.com/paper.pdf" 
                          className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                          required
                        />
                        <div className="relative">
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const url = await handleFileUpload(file, `exams/${Date.now()}_${file.name}`);
                                if (url) setNewExam({ ...newExam, questionPaperUrl: url });
                              }
                            }}
                            className="hidden"
                            id="paper-upload"
                          />
                          <label
                            htmlFor="paper-upload"
                            className="flex items-center px-4 py-3 bg-blue-50 text-blue-600 rounded-2xl font-bold text-sm cursor-pointer hover:bg-blue-100 transition-all"
                          >
                            <Upload className="w-4 h-4 mr-2" />
                            {uploading ? 'Uploading...' : 'Upload'}
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {newExam.format === 'MCQ' && (
                <div className="space-y-6 pt-6 border-t border-gray-100">
                  <h4 className="font-bold text-gray-900 flex items-center">
                    <ClipboardList className="w-5 h-5 mr-2 text-blue-600" />
                    Add Questions
                  </h4>
                  
                  <div className="bg-gray-50 p-6 rounded-3xl space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Question Text</label>
                      <textarea 
                        value={currentQuestion.question}
                        onChange={e => setCurrentQuestion({...currentQuestion, question: e.target.value})}
                        className="w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {currentQuestion.options.map((opt, idx) => (
                        <div key={idx} className="flex items-center space-x-2">
                          <input 
                            type="radio" 
                            name="correctOption"
                            checked={currentQuestion.correctOptionIndex === idx}
                            onChange={() => setCurrentQuestion({...currentQuestion, correctOptionIndex: idx})}
                            className="w-4 h-4 text-blue-600"
                          />
                          <input 
                            type="text" 
                            value={opt}
                            onChange={e => {
                              const newOpts = [...currentQuestion.options];
                              newOpts[idx] = e.target.value;
                              setCurrentQuestion({...currentQuestion, options: newOpts});
                            }}
                            placeholder={`Option ${idx + 1}`}
                            className="flex-1 px-4 py-2 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-sm"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <label className="text-xs font-bold text-gray-500">Marks:</label>
                        <input 
                          type="number" 
                          value={currentQuestion.marks}
                          onChange={e => setCurrentQuestion({...currentQuestion, marks: Number(e.target.value)})}
                          className="w-16 px-3 py-1 bg-white border border-gray-100 rounded-lg font-bold"
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={handleAddQuestion}
                        className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all"
                      >
                        Add to Paper
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {newExam.questions.map((q, idx) => (
                      <div key={q.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl">
                        <div className="flex items-center space-x-3">
                          <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">{idx + 1}</span>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{q.question}</p>
                            <p className="text-xs text-gray-500">{q.marks} Marks • Correct: Option {q.correctOptionIndex + 1}</p>
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => handleRemoveQuestion(q.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={() => {
                    setIsAddingExam(false);
                    setEditingExamId(null);
                  }}
                  className="px-6 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
                >
                  {editingExamId ? 'Update Exam' : 'Publish Exam'}
                </button>
              </div>
            </form>
          </motion.div>
        ) : isTakingExam && selectedExam ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden"
          >
            <div className="p-8 bg-blue-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold">{selectedExam.title}</h3>
                  <p className="text-blue-100">{selectedExam.subject} • {selectedExam.type}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center text-blue-100 text-sm mb-1">
                    <Clock className="w-4 h-4 mr-2" />
                    Ends at {format(parseISO(selectedExam.endTime), 'h:mm a')}
                  </div>
                  <div className="font-bold">Max Marks: {selectedExam.maxMarks}</div>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-8">
              {selectedExam.format === 'MCQ' ? (
                <div className="space-y-8">
                  {selectedExam.questions?.map((q, idx) => (
                    <div key={q.id} className="space-y-4">
                      <div className="flex items-start space-x-4">
                        <span className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold shrink-0">{idx + 1}</span>
                        <div className="flex-1">
                          <p className="text-lg font-bold text-gray-900 mb-4">{q.question}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {q.options.map((opt, optIdx) => (
                              <button
                                key={optIdx}
                                onClick={() => setStudentAnswers({...studentAnswers, [q.id]: optIdx})}
                                className={`p-4 text-left rounded-2xl border transition-all font-bold text-sm ${
                                  studentAnswers[q.id] === optIdx 
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100' 
                                    : 'bg-white text-gray-600 border-gray-100 hover:border-blue-200'
                                }`}
                              >
                                <span className="mr-2 opacity-60">{String.fromCharCode(65 + optIdx)}.</span>
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-6 text-center py-12">
                  <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <FileText className="w-10 h-10" />
                  </div>
                  <h4 className="text-xl font-bold text-gray-900">Subjective Exam Instructions</h4>
                  <p className="text-gray-500 max-w-md mx-auto">
                    Please download the question paper, write your answers on paper, and upload the photos of your answer sheets below.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                    <a 
                      href={selectedExam.questionPaperUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all"
                    >
                      <FileDown className="w-5 h-5 mr-2" />
                      Download Paper
                    </a>
                    <div className="relative">
                      <input
                        type="file"
                        multiple
                        accept=".pdf,image/*"
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []) as File[];
                          const urls: string[] = [];
                          for (const file of files) {
                            const url = await handleFileUpload(file, `answers/${selectedExam.id}/${user.uid}/${Date.now()}_${file.name}`);
                            if (url) urls.push(url);
                          }
                          setAnswerSheetFiles(prev => [...prev, ...urls]);
                        } }
                        className="hidden"
                        id="answer-upload"
                      />
                      <label
                        htmlFor="answer-upload"
                        className="flex items-center px-6 py-3 bg-white border-2 border-blue-600 text-blue-600 rounded-2xl font-bold hover:bg-blue-50 transition-all cursor-pointer"
                      >
                        <Upload className="w-5 h-5 mr-2" />
                        {uploading ? 'Uploading...' : 'Upload Answer Sheets'}
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-8 border-t border-gray-100">
                <button 
                  onClick={() => {
                    if (window.confirm('Are you sure you want to exit? Your progress will be lost.')) {
                      setIsTakingExam(false);
                      setSelectedExam(null);
                    }
                  }}
                  className="px-6 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-2xl transition-all"
                >
                  Exit
                </button>
                <button 
                  onClick={submitExam}
                  disabled={isSubmitting}
                  className="flex items-center px-10 py-3 bg-emerald-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Exam'}
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredExams.map((exam) => {
              const examClass = classes.find(c => c.id === exam.classId);
              const status = getExamStatus(exam);
              const studentResult = targetStudentUid ? examResults.find(r => r.examId === exam.id && r.studentId === targetStudentUid) : null;
              const isAttempted = !!studentResult;

              return (
                <div key={exam.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 hover:shadow-md transition-all group relative overflow-hidden">
                  <div className={`absolute top-0 right-0 px-4 py-1 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest ${
                    status === 'Ongoing' ? 'bg-emerald-500 text-white' :
                    status === 'Upcoming' ? 'bg-blue-500 text-white' :
                    'bg-gray-500 text-white'
                  }`}>
                    {status}
                  </div>

                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-2xl ${exam.format === 'MCQ' ? 'bg-purple-50 text-purple-600' : 'bg-amber-50 text-amber-600'}`}>
                      {exam.format === 'MCQ' ? <ClipboardList className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                    </div>
                    {isTeacherOrAdmin && (
                      <div className="flex items-center space-x-1">
                        <button 
                          onClick={() => handleEditExam(exam)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                          title="Edit Exam"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteExam(exam.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Delete Exam"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <h4 className="text-lg font-bold text-gray-900 mb-1">{exam.title}</h4>
                  <p className="text-sm text-gray-500 mb-4">{exam.subject} • {examClass?.name}</p>

                  <div className="space-y-2 mb-6">
                    <div className="flex items-center text-xs text-gray-500 font-bold">
                      <CalendarIcon className="w-3.5 h-3.5 mr-2" />
                      {format(parseISO(exam.startTime), 'MMM d, yyyy')}
                    </div>
                    <div className="flex items-center text-xs text-gray-500 font-bold">
                      <Clock className="w-3.5 h-3.5 mr-2" />
                      {format(parseISO(exam.startTime), 'h:mm a')} - {format(parseISO(exam.endTime), 'h:mm a')}
                    </div>
                    <div className="flex items-center text-xs text-gray-500 font-bold">
                      <Award className="w-3.5 h-3.5 mr-2" />
                      {exam.maxMarks} Max Marks
                    </div>
                  </div>

                  {isTeacherOrAdmin ? (
                    <button 
                      onClick={() => {
                        setSelectedExam(exam);
                        setIsViewingResults(true);
                      }}
                      className="w-full py-3 bg-gray-50 text-gray-600 rounded-xl font-bold text-sm hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center"
                    >
                      View Submissions
                      <ChevronRight className="w-4 h-4 ml-2" />
                    </button>
                  ) : (
                    isAttempted ? (
                      <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Submitted</span>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div className="text-lg font-black text-emerald-700">
                          {studentResult.status === 'Graded' ? `${studentResult.marksObtained} / ${exam.maxMarks}` : 'Awaiting Grading'}
                        </div>
                      </div>
                    ) : (
                      <button 
                        disabled={status !== 'Ongoing'}
                        onClick={() => {
                          setSelectedExam(exam);
                          setIsTakingExam(true);
                          setStudentAnswers({});
                          setAnswerSheetFiles([]);
                        }}
                        className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center ${
                          status === 'Ongoing' 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 hover:bg-blue-700' 
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {status === 'Upcoming' ? 'Starts Soon' : status === 'Expired' ? 'Exam Ended' : 'Start Exam'}
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </button>
                    )
                  )}
                </div>
              );
            })}

            {filteredExams.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border border-dashed border-gray-200">
                <ClipboardList className="w-16 h-16 text-gray-200 mx-auto mb-4 opacity-20" />
                <p className="text-gray-400 font-medium">No exams found</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submissions Modal */}
      <AnimatePresence>
        {isViewingResults && selectedExam && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsViewingResults(false)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{selectedExam.title} Submissions</h3>
                  <p className="text-sm text-gray-500">{selectedExam.subject} • {classes.find(c => c.id === selectedExam.classId)?.name}</p>
                </div>
                <button onClick={() => setIsViewingResults(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>
              
              <div className="p-8 max-h-[70vh] overflow-y-auto">
                <div className="space-y-4">
                  {students.filter(s => s.classId === selectedExam.classId).map(student => {
                    const result = examResults.find(r => r.examId === selectedExam.id && r.studentId === student.uid);
                    return (
                      <div key={student.uid} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center font-bold text-blue-600 border border-gray-100 shadow-sm">
                            {student.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{student.name}</p>
                            <p className="text-xs text-gray-500">Roll No: {student.rollNumber}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-4">
                          {result ? (
                            <div className="text-right">
                              <div className={`text-sm font-black ${result.status === 'Graded' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {result.status === 'Graded' ? `${result.marksObtained} / ${selectedExam.maxMarks}` : 'Awaiting Grading'}
                              </div>
                              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">{result.status}</p>
                            </div>
                          ) : (
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Not Attempted</span>
                          )}
                          
                          {result && selectedExam.format === 'Subjective' && result.status === 'Pending' && (
                            <button 
                              onClick={() => {
                                const marks = prompt(`Enter marks for ${student.name} (Max: ${selectedExam.maxMarks}):`);
                                if (marks !== null) {
                                  updateDoc(doc(db, 'examResults', result.id), {
                                    marksObtained: Number(marks),
                                    status: 'Graded'
                                  }).then(() => toast.success('Marks updated'));
                                }
                              }}
                              className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-all"
                            >
                              Grade
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
