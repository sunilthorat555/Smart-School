import React, { useState } from 'react';
import { UserProfile, Announcement, ClassData, StudentData, SchoolData } from '../../types';
import { db, collection, setDoc, doc, deleteDoc, OperationType, handleFirestoreError, restoreDefaultBanners } from '../../firebase';
import { Plus, Trash2, Calendar as CalendarIcon, Loader2, X, Megaphone, Upload, Image as ImageIcon, AlertTriangle, RotateCcw, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ConfirmationModal } from '../ConfirmationModal';

interface Props {
  user: UserProfile;
  announcements: Announcement[];
  classes: ClassData[];
  schools: SchoolData[];
}

export const BannerManagement: React.FC<Props> = ({ user, announcements, classes, schools }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(user.role === 'admin' ? 'all' : user.schoolId || '');
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    targetClassId: '',
    schoolId: user.schoolId || '',
    imageUrl: ''
  });

  const photoBanners = announcements.filter(ann => {
    const isBanner = ann.isBanner && ann.imageUrl;
    const matchesSchool = selectedSchoolId === 'all' || ann.schoolId === selectedSchoolId;
    return isBanner && matchesSchool;
  });

  const handleRestoreDefaults = async () => {
    setRestoring(true);
    await restoreDefaultBanners();
    setRestoring(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500000) {
      toast.error('Image is too large. Please select an image smaller than 500KB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, imageUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.content || !formData.imageUrl) {
      toast.error('Please fill all fields and upload a photo');
      return;
    }

    setLoading(true);
    try {
      const bannerId = `banner-${Date.now()}`;
      const newBanner: Announcement = {
        id: bannerId,
        ...formData,
        schoolId: user.role === 'admin' ? formData.schoolId : (user.schoolId || ''),
        isBanner: true,
        type: 'info',
        date: new Date().toISOString(),
        authorId: user.uid
      };

      await setDoc(doc(db, 'announcements', bannerId), newBanner);
      toast.success('Photo banner added successfully');
      setFormData({ title: '', content: '', targetClassId: '', schoolId: user.schoolId || '', imageUrl: '' });
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'announcements');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    setDeleteModal({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    if (!deleteModal.id) return;

    try {
      await deleteDoc(doc(db, 'announcements', deleteModal.id));
      toast.success('Banner removed successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `announcements/${deleteModal.id}`);
    } finally {
      setDeleteModal({ isOpen: false, id: null });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Scrolling Photo Banners</h2>
          <p className="text-sm text-gray-500">Manage the images displayed at the top of the dashboard.</p>
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
          <button
            onClick={handleRestoreDefaults}
            disabled={restoring}
            className="flex items-center px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-2xl hover:bg-gray-200 transition-all disabled:opacity-50"
            title="Restore original welcome banner"
          >
            <RotateCcw className={`w-5 h-5 mr-2 ${restoring ? 'animate-spin' : ''}`} />
            Restore Defaults
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center px-6 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Photo Banner
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {photoBanners.length > 0 ? (
          photoBanners.map((banner) => (
            <div key={banner.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden group">
              <div className="relative h-48">
                <img 
                  src={banner.imageUrl} 
                  alt={banner.title} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button 
                    onClick={() => handleDeleteBanner(banner.id)}
                    className="p-3 bg-red-600 text-white rounded-2xl shadow-xl hover:scale-110 transition-transform"
                  >
                    <Trash2 className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex flex-wrap gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full uppercase tracking-wider">
                      {banner.targetClassId ? `Class: ${classes.find(c => c.id === banner.targetClassId)?.name || banner.targetClassId}` : 'School Wide'}
                    </span>
                    {user.role === 'admin' && banner.schoolId && (
                      <span className="flex items-center text-[10px] font-bold px-2 py-0.5 bg-gray-50 text-gray-600 rounded-full uppercase tracking-wider">
                        <Building2 className="w-3 h-3 mr-1" />
                        {schools.find(s => s.id === banner.schoolId)?.name || 'Unknown School'}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {format(new Date(banner.date), 'MMM d, yyyy')}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{banner.title}</h3>
                <p className="text-sm text-gray-500 line-clamp-2">{banner.content}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-32 text-center bg-white rounded-3xl border border-dashed border-gray-200">
            <ImageIcon className="w-16 h-16 text-gray-200 mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold text-gray-400">No photo banners active</h3>
            <p className="text-gray-400 mt-2">Add a banner to display it on the dashboard.</p>
          </div>
        )}
      </div>

      {/* New Banner Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Add Photo Banner</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleAddBanner} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Banner Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="e.g., Annual Sports Day 2026"
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
                <label className="block text-sm font-bold text-gray-700 mb-2">Banner Photo</label>
                <div className="space-y-3">
                  {formData.imageUrl ? (
                    <div className="relative group rounded-2xl overflow-hidden border border-gray-200 aspect-video bg-gray-50">
                      <img 
                        src={formData.imageUrl} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, imageUrl: '' })}
                        className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-all group">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors mb-2">
                          <Upload className="w-6 h-6 text-blue-600" />
                        </div>
                        <p className="text-sm text-gray-500 font-medium">Click to upload photo</p>
                        <p className="text-xs text-gray-400 mt-1">Recommended: 1920x1080 (16:9)</p>
                        <p className="text-[10px] text-gray-400">PNG, JPG up to 500KB</p>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleFileChange}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Description (Optional)</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  placeholder="Short description for the banner..."
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
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
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Add Banner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        title="Remove Banner?"
        message="This will permanently remove this photo banner. This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, id: null })}
        confirmText="Remove Banner"
        type="danger"
      />
    </div>
  );
};
