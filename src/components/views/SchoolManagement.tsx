import React, { useState } from 'react';
import { UserProfile, SchoolData } from '../../types';
import { db, collection, addDoc, doc, updateDoc, deleteDoc, OperationType, handleFirestoreError } from '../../firebase';
import { Plus, Search, School, MapPin, Phone, Mail, Trash2, Pencil, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Props {
  user: UserProfile;
  schools: SchoolData[];
}

export const SchoolManagement: React.FC<Props> = ({ user, schools }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingSchool, setEditingSchool] = useState<SchoolData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
  });

  const filteredSchools = schools.filter(school => 
    school.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    school.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingSchool) {
        await updateDoc(doc(db, 'schools', editingSchool.id), {
          ...formData,
          updatedAt: new Date().toISOString(),
        });
        toast.success('School updated successfully');
      } else {
        await addDoc(collection(db, 'schools'), {
          ...formData,
          createdAt: new Date().toISOString(),
        });
        toast.success('School added successfully');
      }
      setIsAdding(false);
      setEditingSchool(null);
      setFormData({ name: '', address: '', phone: '', email: '' });
    } catch (err) {
      handleFirestoreError(err, editingSchool ? OperationType.UPDATE : OperationType.CREATE, editingSchool ? `schools/${editingSchool.id}` : 'schools');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this school? This will not delete associated data but may cause issues.')) return;

    try {
      await deleteDoc(doc(db, 'schools', id));
      toast.success('School deleted successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `schools/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">School Management</h2>
          <p className="text-gray-500">Add and manage schools in the system</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add New School
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search schools by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredSchools.map((school) => (
            <motion.div
              key={school.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                  <School className="w-6 h-6" />
                </div>
                <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      setEditingSchool(school);
                      setFormData({
                        name: school.name,
                        address: school.address,
                        phone: school.phone,
                        email: school.email,
                      });
                      setIsAdding(true);
                    }}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(school.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-bold text-gray-900 mb-4">{school.name}</h3>

              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-500">
                  <MapPin className="w-4 h-4 mr-2 shrink-0" />
                  <span className="truncate">{school.address}</span>
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <Phone className="w-4 h-4 mr-2 shrink-0" />
                  <span>{school.phone}</span>
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <Mail className="w-4 h-4 mr-2 shrink-0" />
                  <span className="truncate">{school.email}</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-50 flex items-center justify-between">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Added {format(new Date(school.createdAt), 'MMM d, yyyy')}
                </span>
                <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full uppercase">
                  Active
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingSchool ? 'Edit School' : 'Add New School'}
                </h3>
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setEditingSchool(null);
                    setFormData({ name: '', address: '', phone: '', email: '' });
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                >
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">School Name</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Enter school name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Address</label>
                  <textarea
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none h-24"
                    placeholder="Enter school address"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Phone Number</label>
                    <input
                      required
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="Phone number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Email Address</label>
                    <input
                      required
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="Email address"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      setEditingSchool(null);
                      setFormData({ name: '', address: '', phone: '', email: '' });
                    }}
                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-2 px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50 flex items-center justify-center"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      editingSchool ? 'Update School' : 'Create School'
                    )}
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
