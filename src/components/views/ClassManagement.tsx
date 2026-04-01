import React, { useState } from 'react';
import { UserProfile, SchoolData, ClassData } from '../../types';
import { db, collection, setDoc, doc, deleteDoc, OperationType, handleFirestoreError } from '../../firebase';
import { Plus, Search, MoreVertical, Edit2, Trash2, BookOpen, Users, Loader2, AlertTriangle, School } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmationModal } from '../ConfirmationModal';

interface Props {
  user: UserProfile;
  schools: SchoolData[];
  classes: ClassData[];
}

export const ClassManagement: React.FC<Props> = ({ user, schools, classes }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [className, setClassName] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState(user.schoolId || '');
  const [loading, setLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
  const [searchTerm, setSearchTerm] = useState('');

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) return;

    setLoading(true);
    try {
      const classId = className.toLowerCase().replace(/\s+/g, '-');
      const newClass: ClassData = {
        id: classId,
        name: className,
        schoolId: selectedSchoolId,
        teacherId: user.uid,
        studentCount: 0
      };

      await setDoc(doc(db, 'classes', classId), newClass);
      toast.success('Class added successfully');
      setClassName('');
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'classes');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClass = async (id: string) => {
    setDeleteModal({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    if (!deleteModal.id) return;

    try {
      await deleteDoc(doc(db, 'classes', deleteModal.id));
      toast.success('Class deleted successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `classes/${deleteModal.id}`);
    } finally {
      setDeleteModal({ isOpen: false, id: null });
    }
  };

  const filteredClasses = classes.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search classes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          />
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Class
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClasses.map((c) => (
          <div key={c.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-2 text-gray-400 hover:bg-gray-50 hover:text-blue-600 rounded-xl">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDeleteClass(c.id)}
                  className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-xl"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{c.name}</h3>
            <div className="flex flex-col space-y-2">
              <div className="flex items-center text-sm text-gray-500 space-x-4">
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-1.5" />
                  {c.studentCount} Students
                </div>
                <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                <div className="flex items-center">
                  ID: {c.id}
                </div>
              </div>
              {user.role === 'admin' && (
                <div className="flex items-center text-xs text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-lg w-fit">
                  <School className="w-3 h-3 mr-1" />
                  {schools.find(s => s.id === c.schoolId)?.name || 'Unknown School'}
                </div>
              )}
            </div>
          </div>
        ))}

        {filteredClasses.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200">
            <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No classes found. Add your first class to get started.</p>
          </div>
        )}
      </div>

      {/* Add Class Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Add New Class</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <Plus className="w-6 h-6 text-gray-500 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleAddClass} className="p-6 space-y-4">
              {user.role === 'admin' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Select School</label>
                  <select
                    value={selectedSchoolId}
                    onChange={(e) => setSelectedSchoolId(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                    required
                  >
                    <option value="">Select a school</option>
                    {schools.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Class Name</label>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="e.g. Grade 10-A"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  required
                />
              </div>
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        title="Delete Class?"
        message="This will permanently remove this class and all associated data. This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, id: null })}
        confirmText="Delete Class"
        type="danger"
      />
    </div>
  );
};
