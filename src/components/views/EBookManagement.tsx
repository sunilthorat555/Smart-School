import React, { useState, useRef } from 'react';
import { UserProfile, ClassData, EBook, SchoolData } from '../../types';
import { db, collection, setDoc, doc, deleteDoc, OperationType, handleFirestoreError } from '../../firebase';
import { Plus, Search, Book, FileText, Loader2, X, Upload, Download, Trash2, FileUp, Filter, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { ConfirmationModal } from '../ConfirmationModal';

interface Props {
  user: UserProfile;
  classes: ClassData[];
  ebooks: EBook[];
  schools: SchoolData[];
}

export const EBookManagement: React.FC<Props> = ({ user, classes, ebooks, schools }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(user.role === 'admin' ? 'all' : user.schoolId || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    classId: '',
    schoolId: user.schoolId || '',
    pdfUrl: '',
    pdfName: ''
  });

  const isTeacherOrAdmin = user.role === 'admin' || user.role === 'teacher';

  const subjects = Array.from(new Set(ebooks.map(eb => eb.subject))).sort();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB limit for demo
      toast.error('File size exceeds 2MB limit for demo');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ 
        ...formData, 
        pdfUrl: reader.result as string,
        pdfName: file.name
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAddEBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.subject || !formData.pdfUrl) {
      toast.error('Please fill all required fields and upload a PDF');
      return;
    }

    setLoading(true);
    try {
      const ebookId = `eb-${Date.now()}`;
      const newEBook: EBook = {
        id: ebookId,
        ...formData,
        schoolId: user.role === 'admin' ? formData.schoolId : (user.schoolId || ''),
        authorId: user.uid,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'ebooks', ebookId), newEBook);
      toast.success('E-Book uploaded successfully');
      resetForm();
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'ebooks');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      subject: '',
      classId: '',
      schoolId: user.schoolId || '',
      pdfUrl: '',
      pdfName: ''
    });
  };

  const handleDeleteEBook = async (id: string) => {
    setDeleteModal({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    if (!deleteModal.id) return;

    try {
      await deleteDoc(doc(db, 'ebooks', deleteModal.id));
      toast.success('E-Book deleted successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `ebooks/${deleteModal.id}`);
    } finally {
      setDeleteModal({ isOpen: false, id: null });
    }
  };

  const filteredEBooks = ebooks.filter(eb => {
    const matchesSearch = eb.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         eb.subject.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesClass = selectedClassId === 'all' || eb.classId === selectedClassId || !eb.classId;
    const matchesSubject = selectedSubject === 'all' || eb.subject === selectedSubject;
    const matchesSchool = selectedSchoolId === 'all' || eb.schoolId === selectedSchoolId;
    
    return matchesSearch && matchesClass && matchesSubject && matchesSchool;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-4 flex-1 max-w-3xl">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search E-Books by title or subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          <div className="flex gap-2">
            {user.role === 'admin' && (
              <select
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                className="px-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-gray-700"
              >
                <option value="all">All Schools</option>
                {schools.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-gray-700"
            >
              <option value="all">All Subjects</option>
              {subjects.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="px-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-gray-700"
            >
              <option value="all">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        {isTeacherOrAdmin && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            <Plus className="w-5 h-5 mr-2" />
            Upload E-Book
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEBooks.map((eb) => (
          <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            key={eb.id}
            className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all group relative"
          >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <Book className="w-6 h-6" />
                </div>
                <div className="flex items-center space-x-2">
                  {user.role === 'admin' && eb.schoolId && (
                    <div className="flex items-center px-2 py-1 bg-gray-50 text-gray-500 rounded-lg text-[10px] font-bold">
                      <Building2 className="w-3 h-3 mr-1" />
                      {schools.find(s => s.id === eb.schoolId)?.name || 'Unknown School'}
                    </div>
                  )}
                  {isTeacherOrAdmin && (
                    <button
                      onClick={() => handleDeleteEBook(eb.id)}
                      className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full uppercase tracking-wider">
                  {eb.subject}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-50 text-gray-600 rounded-full uppercase tracking-wider">
                  {eb.classId ? (classes.find(c => c.id === eb.classId)?.name || eb.classId) : 'School Wide'}
                </span>
              </div>
              <h3 className="text-lg font-bold text-gray-900">{eb.title}</h3>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
              <div className="flex items-center text-xs text-gray-400">
                <FileText className="w-3 h-3 mr-1" />
                {eb.pdfName}
              </div>
              <a
                href={eb.pdfUrl}
                download={eb.pdfName}
                className="flex items-center px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-600 hover:text-white transition-all"
              >
                <Download className="w-3 h-3 mr-1" />
                Download
              </a>
            </div>
          </motion.div>
        ))}

        {filteredEBooks.length === 0 && (
          <div className="col-span-full py-32 text-center bg-white rounded-3xl border border-dashed border-gray-200">
            <Book className="w-16 h-16 text-gray-200 mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold text-gray-400">No E-Books found</h3>
            <p className="text-gray-400 mt-2">
              {isTeacherOrAdmin ? 'Upload your first E-Book to share with students.' : 'No E-Books available for your class yet.'}
            </p>
          </div>
        )}
      </div>

      {/* Upload E-Book Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Upload New E-Book</h3>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleAddEBook} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Book Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="e.g. Physics Part 1 - Mechanics"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Subject</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({...formData, subject: e.target.value})}
                    placeholder="e.g. Physics"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>
                {user.role === 'admin' && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">School</label>
                    <select
                      value={formData.schoolId}
                      onChange={(e) => setFormData({...formData, schoolId: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      required
                    >
                      <option value="">Select School</option>
                      {schools.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className={user.role === 'admin' ? "md:col-span-2" : ""}>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Target Class (Optional)</label>
                  <select
                    value={formData.classId}
                    onChange={(e) => setFormData({...formData, classId: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">All Classes (School Wide)</option>
                    {(user.role === 'admin' ? classes.filter(c => c.schoolId === formData.schoolId) : classes).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">PDF File</label>
                  {formData.pdfUrl ? (
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <div className="flex items-center">
                        <FileText className="w-5 h-5 text-blue-600 mr-2" />
                        <span className="text-sm font-medium text-blue-700 truncate max-w-[200px]">{formData.pdfName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, pdfUrl: '', pdfName: '' })}
                        className="p-1 hover:bg-blue-100 rounded-lg text-blue-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center p-4 border-2 border-dashed border-gray-200 rounded-xl hover:bg-gray-50 hover:border-blue-400 transition-all group"
                    >
                      <FileUp className="w-5 h-5 text-gray-400 group-hover:text-blue-500 mr-2" />
                      <span className="text-sm font-medium text-gray-500 group-hover:text-blue-600">Upload PDF Book</span>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept="application/pdf"
                      />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex space-x-3 pt-4">
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
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Upload Book'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        title="Delete E-Book?"
        message="Are you sure you want to delete this E-Book? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, id: null })}
        confirmText="Delete E-Book"
        type="danger"
      />
    </div>
  );
};
