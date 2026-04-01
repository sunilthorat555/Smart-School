import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info, MapPin, Phone, Mail, Globe, Clock, Award, Users, BookOpen, GraduationCap, Edit2, Save, X, Loader2, ExternalLink } from 'lucide-react';
import { db, doc, getDoc, setDoc, collection, onSnapshot, OperationType, handleFirestoreError } from '../../firebase';
import { QuickLink } from '../../types';
import { toast } from 'sonner';

interface AboutUsProps {
  user: any;
}

const DEFAULT_SCHOOL_INFO = {
  name: "SmartAttend International School",
  description: "SmartAttend International School is a premier educational institution dedicated to fostering academic excellence, character development, and global citizenship. Founded in 2005, we have consistently provided a nurturing environment where students are encouraged to explore their potential and achieve their dreams.",
  mission: "To empower students with the knowledge, skills, and values necessary to succeed in an ever-changing world.",
  vision: "To be a leading center of educational innovation and excellence, recognized globally for our commitment to student success.",
  photoUrl: "https://images.unsplash.com/photo-1523050853063-bd8012fec046?auto=format&fit=crop&q=80&w=1000",
  contact: {
    address: "123 Education Lane, Knowledge City, ST 56789",
    phone: "+1 (555) 123-4567",
    email: "info@smartattend.edu",
    website: "www.smartattend.edu",
    hours: "Mon - Fri: 8:00 AM - 4:00 PM"
  },
  stats: [
    { label: "Students", value: "1,200+", icon: 'Users', color: "text-blue-600" },
    { label: "Teachers", value: "85+", icon: 'GraduationCap', color: "text-emerald-600" },
    { label: "Classes", value: "40+", icon: 'BookOpen', color: "text-amber-600" },
    { label: "Awards", value: "15+", icon: 'Award', color: "text-purple-600" }
  ]
};

const iconMap: { [key: string]: any } = {
  Users,
  GraduationCap,
  BookOpen,
  Award
};

const AboutUs: React.FC<AboutUsProps> = ({ user }) => {
  const [schoolInfo, setSchoolInfo] = useState(DEFAULT_SCHOOL_INFO);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState(DEFAULT_SCHOOL_INFO);
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([]);

  useEffect(() => {
    const fetchSchoolInfo = async () => {
      try {
        const docRef = doc(db, 'school', 'info');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSchoolInfo(docSnap.data() as any);
          setEditForm(docSnap.data() as any);
        }
      } catch (err) {
        console.error('Error fetching school info:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSchoolInfo();

    // Fetch Quick Links
    const unsubscribeLinks = onSnapshot(collection(db, 'quickLinks'), (snapshot) => {
      const links = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuickLink));
      setQuickLinks(links);
    });

    return () => unsubscribeLinks();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'school', 'info'), editForm);
      setSchoolInfo(editForm);
      setIsEditing(false);
      toast.success('School information updated successfully');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'school/info');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 relative">
      {user.role === 'admin' && !isEditing && (
        <button
          onClick={() => setIsEditing(true)}
          className="fixed bottom-8 right-8 z-50 p-4 bg-blue-600 text-white rounded-full shadow-2xl hover:bg-blue-700 transition-all flex items-center space-x-2 group"
        >
          <Edit2 className="w-5 h-5" />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 font-bold whitespace-nowrap">
            Edit School Info
          </span>
        </button>
      )}

      {isEditing && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] shadow-2xl p-8 lg:p-12"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-black text-gray-900">Edit School Details</h2>
              <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">School Name</label>
                  <input 
                    type="text" 
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Description</label>
                  <textarea 
                    rows={4}
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                    className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Mission</label>
                  <textarea 
                    rows={2}
                    value={editForm.mission}
                    onChange={(e) => setEditForm({...editForm, mission: e.target.value})}
                    className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Vision</label>
                  <textarea 
                    rows={2}
                    value={editForm.vision}
                    onChange={(e) => setEditForm({...editForm, vision: e.target.value})}
                    className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Hero Photo URL</label>
                  <input 
                    type="text" 
                    value={editForm.photoUrl}
                    onChange={(e) => setEditForm({...editForm, photoUrl: e.target.value})}
                    className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-2">Contact Information</h3>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Address</label>
                  <input 
                    type="text" 
                    value={editForm.contact.address}
                    onChange={(e) => setEditForm({...editForm, contact: {...editForm.contact, address: e.target.value}})}
                    className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Phone</label>
                    <input 
                      type="text" 
                      value={editForm.contact.phone}
                      onChange={(e) => setEditForm({...editForm, contact: {...editForm.contact, phone: e.target.value}})}
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Email</label>
                    <input 
                      type="email" 
                      value={editForm.contact.email}
                      onChange={(e) => setEditForm({...editForm, contact: {...editForm.contact, email: e.target.value}})}
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Website</label>
                  <input 
                    type="text" 
                    value={editForm.contact.website}
                    onChange={(e) => setEditForm({...editForm, contact: {...editForm.contact, website: e.target.value}})}
                    className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Office Hours</label>
                  <input 
                    type="text" 
                    value={editForm.contact.hours}
                    onChange={(e) => setEditForm({...editForm, contact: {...editForm.contact, hours: e.target.value}})}
                    className="w-full px-5 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="pt-4">
                  <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-2 mb-4">School Stats</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {editForm.stats.map((stat, idx) => (
                      <div key={idx}>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{stat.label}</label>
                        <input 
                          type="text" 
                          value={stat.value}
                          onChange={(e) => {
                            const newStats = [...editForm.stats];
                            newStats[idx] = { ...newStats[idx], value: e.target.value };
                            setEditForm({ ...editForm, stats: newStats });
                          }}
                          className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12 flex items-center justify-end space-x-4">
              <button 
                onClick={() => setIsEditing(false)}
                className="px-8 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-2xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="px-10 py-3 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative h-64 md:h-96 rounded-[2.5rem] overflow-hidden shadow-2xl"
      >
        <img 
          src={schoolInfo.photoUrl} 
          alt={schoolInfo.name} 
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8 md:p-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-3xl md:text-5xl font-black text-white mb-2 tracking-tight">
              {schoolInfo.name}
            </h1>
            <p className="text-white/80 text-sm md:text-lg max-w-2xl font-medium italic">
              "Empowering Minds, Shaping Futures"
            </p>
          </motion.div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* About Section */}
          <motion.section 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-[#f0fdf4] p-8 rounded-[2.5rem] shadow-sm border border-emerald-100"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
                <Info className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">About Our School</h2>
            </div>
            <p className="text-gray-700 leading-relaxed mb-6">
              {schoolInfo.description}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-white/60 rounded-3xl border border-emerald-100">
                <h3 className="font-bold text-emerald-900 mb-2 flex items-center">
                  <span className="w-2 h-2 bg-emerald-600 rounded-full mr-2"></span>
                  Our Mission
                </h3>
                <p className="text-sm text-emerald-900/80 italic">
                  {schoolInfo.mission}
                </p>
              </div>
              <div className="p-6 bg-white/60 rounded-3xl border border-emerald-100">
                <h3 className="font-bold text-emerald-900 mb-2 flex items-center">
                  <span className="w-2 h-2 bg-emerald-600 rounded-full mr-2"></span>
                  Our Vision
                </h3>
                <p className="text-sm text-emerald-900/80 italic">
                  {schoolInfo.vision}
                </p>
              </div>
            </div>
          </motion.section>

          {/* Stats Section */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {schoolInfo.stats.map((stat, idx) => {
              const Icon = iconMap[stat.icon] || Info;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + idx * 0.1 }}
                  className="bg-[#f0fdf4] p-6 rounded-3xl shadow-sm border border-emerald-100 flex flex-col items-center text-center"
                >
                  <div className={`p-3 rounded-2xl bg-white/60 mb-3 ${stat.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-2xl font-black text-gray-800">{stat.value}</span>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">{stat.label}</span>
                </motion.div>
              );
            })}
          </div>

          {/* Map Section */}
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-[#f0fdf4] p-8 rounded-[2.5rem] shadow-sm border border-emerald-100"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
                <MapPin className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Find Us</h2>
            </div>
            <div className="relative h-64 rounded-3xl overflow-hidden border border-emerald-100 bg-white/40">
              {/* Placeholder for Map */}
              <iframe 
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3022.2157071449924!2d-73.98784412424684!3d40.757978634839106!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c25855c6480293%3A0x519120a265c955f2!2sTimes%20Square!5e0!3m2!1sen!2sus!4v1711782810000!5m2!1sen!2sus" 
                width="100%" 
                height="100%" 
                style={{ border: 0 }} 
                allowFullScreen={true} 
                loading="lazy" 
                referrerPolicy="no-referrer-when-downgrade"
                title="School Location"
              ></iframe>
            </div>
          </motion.section>
        </div>

        {/* Sidebar Content */}
        <div className="space-y-8">
          {/* Contact Info */}
          <motion.section 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-[#f0fdf4] p-8 rounded-[2.5rem] shadow-sm border border-emerald-100"
          >
            <h2 className="text-xl font-bold text-gray-800 mb-6">Contact Details</h2>
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="p-2.5 bg-white/60 text-blue-600 rounded-xl shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Address</p>
                  <p className="text-sm text-gray-700 font-medium">{schoolInfo.contact.address}</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="p-2.5 bg-white/60 text-emerald-600 rounded-xl shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Phone</p>
                  <p className="text-sm text-gray-700 font-medium">{schoolInfo.contact.phone}</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="p-2.5 bg-white/60 text-amber-600 rounded-xl shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Email</p>
                  <p className="text-sm text-gray-700 font-medium">{schoolInfo.contact.email}</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="p-2.5 bg-white/60 text-purple-600 rounded-xl shrink-0">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Website</p>
                  <p className="text-sm text-gray-700 font-medium">{schoolInfo.contact.website}</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="p-2.5 bg-white/60 text-gray-600 rounded-xl shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Office Hours</p>
                  <p className="text-sm text-gray-700 font-medium">{schoolInfo.contact.hours}</p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Quick Links Sidebar Section */}
          {quickLinks.length > 0 && (
            <motion.section
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100"
            >
              <h2 className="text-xl font-bold text-gray-800 mb-6">Quick Links</h2>
              <div className="space-y-4">
                {quickLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center p-3 bg-gray-50 rounded-2xl hover:bg-blue-50 transition-all group"
                  >
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mr-3 shadow-sm group-hover:scale-110 transition-transform overflow-hidden">
                      {link.iconUrl ? (
                        <img src={link.iconUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <Globe className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{link.title}</p>
                      <p className="text-[10px] text-gray-400 truncate">{link.url}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-blue-600" />
                  </a>
                ))}
              </div>
            </motion.section>
          )}

          {/* Role Specific Message */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7 }}
            className="p-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] text-white shadow-xl shadow-blue-100"
          >
            <h3 className="text-lg font-bold mb-3">
              {user.role === 'parent' ? 'Parent Support' : 'Staff Resources'}
            </h3>
            <p className="text-white/80 text-sm leading-relaxed mb-6">
              {user.role === 'parent' 
                ? "We are here to support you and your child. Feel free to reach out for any queries regarding attendance, results, or school activities."
                : "As a valued member of our staff, you have access to all school resources and support systems. Let's work together for our students' success."}
            </p>
            <button className="w-full py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl text-sm font-bold transition-all border border-white/20">
              {user.role === 'parent' ? 'Request Meeting' : 'Internal Portal'}
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AboutUs;
