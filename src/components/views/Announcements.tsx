import React, { useState } from 'react';
import { UserProfile, Announcement, ClassData, StudentData, SchoolData } from '../../types';
import { db, collection, setDoc, doc, deleteDoc, OperationType, handleFirestoreError } from '../../firebase';
import { Plus, Bell, Trash2, Calendar as CalendarIcon, User, BookOpen, Loader2, X, Megaphone, AlertTriangle, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ConfirmationModal } from '../ConfirmationModal';

interface Props {
  user: UserProfile;
  announcements: Announcement[];
  classes: ClassData[];
  students: StudentData[];
  schools: SchoolData[];
}

export const Announcements: React.FC<Props> = ({ user, announcements, classes, students, schools }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(user.role === 'admin' ? 'all' : user.schoolId || '');
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    targetClassId: '',
    schoolId: user.schoolId || '',
    type: 'info' as 'info' | 'warning' | 'urgent'
  });

  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.content) return;

    setLoading(true);
    try {
      const selectedClass = classes.find(c => c.id === formData.targetClassId);
      const schoolId = user.role === 'admin' ? formData.schoolId : (selectedClass?.schoolId || user.schoolId || '');

      const announcementId = `ann-${Date.now()}`;
      const newAnnouncement: Announcement = {
        id: announcementId,
        ...formData,
        schoolId,
        date: new Date().toISOString(),
        authorId: user.uid
      };

      await setDoc(doc(db, 'announcements', announcementId), newAnnouncement);
      toast.success('Announcement posted successfully');
      setFormData({ title: '', content: '', targetClassId: '', schoolId: user.schoolId || '', type: 'info' });
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'announcements');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    setDeleteModal({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    if (!deleteModal.id) return;

    try {
      await deleteDoc(doc(db, 'announcements', deleteModal.id));
      toast.success('Announcement deleted successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `announcements/${deleteModal.id}`);
    } finally {
      setDeleteModal({ isOpen: false, id: null });
    }
  };

  const sortedAnnouncements = [...announcements].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const filteredAnnouncements = sortedAnnouncements.filter(ann => {
    // Exclude photo banners from regular announcements list
    if (ann.imageUrl && ann.isBanner) return false;

    const matchesSchool = selectedSchoolId === 'all' || ann.schoolId === selectedSchoolId;
    if (!matchesSchool) return false;

    if (user.role === 'admin') return true;
    if (user.role === 'teacher') return ann.schoolId === user.schoolId;
    
    // For parents, filter by class and school
    const targetStudent = user.role === 'parent' 
      ? students.find(s => s.uid === user.childId)
      : undefined;
      
    const matchesParentSchool = !ann.schoolId || ann.schoolId === targetStudent?.schoolId || ann.schoolId === user.schoolId;
    if (!matchesParentSchool) return false;

    if (!ann.targetClassId) return true; // School-wide
    return ann.targetClassId === targetStudent?.classId;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Announcements</h2>
          <p className="text-sm text-gray-500">Stay updated with the latest school news.</p>
        </div>
        <div className="flex items-center space-x-3">
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
          {(user.role === 'admin' || user.role === 'teacher') && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center px-6 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Announcement
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {filteredAnnouncements.length > 0 ? (
          filteredAnnouncements.map((ann) => (
            <div key={ann.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`p-3 rounded-2xl ${
                    ann.type === 'urgent' ? 'bg-red-50 text-red-600' :
                    ann.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                    ann.targetClassId ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    <Megaphone className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        ann.type === 'urgent' ? 'bg-red-100 text-red-700' :
                        ann.type === 'warning' ? 'bg-amber-100 text-amber-700' :
                        ann.targetClassId ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {ann.type || 'info'}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        ann.targetClassId ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {ann.targetClassId ? `Class: ${classes.find(c => c.id === ann.targetClassId)?.name || ann.targetClassId}` : 'School Wide'}
                      </span>
                      {user.role === 'admin' && ann.schoolId && (
                        <span className="flex items-center text-[10px] font-bold px-2 py-0.5 bg-gray-50 text-gray-600 rounded-full uppercase tracking-wider">
                          <Building2 className="w-3 h-3 mr-1" />
                          {schools.find(s => s.id === ann.schoolId)?.name || 'Unknown School'}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 flex items-center">
                        <CalendarIcon className="w-3 h-3 mr-1" />
                        {format(new Date(ann.date), 'MMM d, yyyy • h:mm a')}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mt-1">{ann.title}</h3>
                  </div>
                </div>
                {(user.role === 'admin' || (user.role === 'teacher' && ann.authorId === user.uid)) && (
                  <button 
                    onClick={() => handleDeleteAnnouncement(ann.id)}
                    className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
              <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{ann.content}</p>
              <div className="mt-6 pt-6 border-t border-gray-50 flex items-center text-sm text-gray-400">
                <User className="w-4 h-4 mr-2" />
                Posted by {ann.authorId === user.uid ? 'You' : 'School Administration'}
              </div>
            </div>
          ))
        ) : (
          <div className="py-32 text-center bg-white rounded-3xl border border-dashed border-gray-200">
            <Bell className="w-16 h-16 text-gray-200 mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold text-gray-400">No announcements yet</h3>
            <p className="text-gray-400 mt-2">Check back later for updates.</p>
          </div>
        )}
      </div>

      {/* New Announcement Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">New Announcement</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleAddAnnouncement} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="Enter announcement title"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-1">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="urgent">Urgent</option>
                  </select>
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
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Target Audience</label>
                <select
                  value={formData.targetClassId}
                  onChange={(e) => setFormData({...formData, targetClassId: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">All School</option>
                  {(user.role === 'admin' ? classes.filter(c => c.schoolId === formData.schoolId) : classes).map(c => (
                    <option key={c.id} value={c.id}>Class: {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Content</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  placeholder="Enter announcement details..."
                  rows={5}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  required
                ></textarea>
              </div>
              <div className="flex space-x-3 pt-4">
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
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Post Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        title="Delete Announcement?"
        message="This will permanently remove this announcement. This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, id: null })}
        confirmText="Delete Announcement"
        type="danger"
      />
    </div>
  );
};
