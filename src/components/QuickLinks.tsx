import React, { useState, useEffect } from 'react';
import { db, collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc, OperationType, handleFirestoreError, storage, ref, uploadBytes, getDownloadURL } from '../firebase';
import { QuickLink, UserProfile } from '../types';
import { Plus, Trash2, ExternalLink, Link as LinkIcon, Globe, Instagram, Facebook, Twitter, Youtube, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface QuickLinksProps {
  user: UserProfile;
}

export const QuickLinks: React.FC<QuickLinksProps> = ({ user }) => {
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newLink, setNewLink] = useState({ title: '', url: '', iconUrl: '' });
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (file: File) => {
    try {
      setUploading(true);
      const storageRef = ref(storage, `quicklinks/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setNewLink(prev => ({ ...prev, iconUrl: url }));
      toast.success('Icon uploaded successfully');
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload icon');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'quickLinks'), (snapshot) => {
      const linksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuickLink));
      setLinks(linksData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'quickLinks');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLink.title || !newLink.url) return;

    setSubmitting(true);
    try {
      const linkData: Omit<QuickLink, 'id'> = {
        title: newLink.title,
        url: newLink.url.startsWith('http') ? newLink.url : `https://${newLink.url}`,
        iconUrl: newLink.iconUrl,
        authorId: user.uid,
        schoolId: user.schoolId || 'default',
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'quickLinks'), linkData);
      toast.success('Quick link added successfully');
      setIsAddModalOpen(false);
      setNewLink({ title: '', url: '', iconUrl: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'quickLinks');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLink = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this link?')) return;
    try {
      await deleteDoc(doc(db, 'quickLinks', id));
      toast.success('Link deleted successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `quickLinks/${id}`);
    }
  };

  const getIcon = (url: string, iconUrl?: string) => {
    if (iconUrl) {
      return <img src={iconUrl} alt="icon" className="w-6 h-6 rounded-md object-cover" referrerPolicy="no-referrer" />;
    }
    
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('facebook')) return <Facebook className="w-6 h-6 text-blue-600" />;
    if (lowerUrl.includes('instagram')) return <Instagram className="w-6 h-6 text-pink-600" />;
    if (lowerUrl.includes('twitter') || lowerUrl.includes('x.com')) return <Twitter className="w-6 h-6 text-sky-500" />;
    if (lowerUrl.includes('youtube')) return <Youtube className="w-6 h-6 text-red-600" />;
    return <Globe className="w-6 h-6 text-gray-400" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quick Links</h1>
          <p className="text-gray-500 mt-1">Access social media and important school resources</p>
        </div>
        {user.role === 'teacher' && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Link
          </button>
        )}
      </div>

      {links.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
          <LinkIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No quick links available yet.</p>
          {user.role === 'teacher' && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="mt-4 text-blue-600 font-bold hover:underline"
            >
              Add the first link
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {links.map((link) => (
            <motion.div
              layout
              key={link.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="group relative bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  {getIcon(link.url, link.iconUrl)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-gray-900 truncate">{link.title}</h3>
                  <p className="text-sm text-gray-500 truncate">{link.url}</p>
                </div>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                >
                  <ExternalLink className="w-5 h-5" />
                </a>
              </div>

              {user.role === 'teacher' && (
                <button
                  onClick={() => handleDeleteLink(link.id)}
                  className="absolute -top-2 -right-2 p-2 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Link Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Add Quick Link</h2>
              <form onSubmit={handleAddLink} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={newLink.title}
                    onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. Official Facebook Page"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">URL</label>
                  <input
                    type="text"
                    required
                    value={newLink.url}
                    onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="e.g. facebook.com/school"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Icon URL (Optional)</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={newLink.iconUrl}
                      onChange={(e) => setNewLink({ ...newLink, iconUrl: e.target.value })}
                      className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="https://example.com/icon.png"
                    />
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                        }}
                        className="hidden"
                        id="icon-upload"
                      />
                      <label
                        htmlFor="icon-upload"
                        className="flex items-center px-4 py-3 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm cursor-pointer hover:bg-blue-100 transition-all"
                      >
                        <Plus className="w-4 h-4" />
                      </label>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Upload an icon or provide a URL. If blank, we'll try to detect it.</p>
                </div>
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 p-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-2 p-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                  >
                    {submitting ? 'Adding...' : 'Add Link'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
