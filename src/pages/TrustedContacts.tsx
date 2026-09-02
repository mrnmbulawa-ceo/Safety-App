import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../components/AuthProvider';
import { TrustedContact } from '../types';
import { Plus, Trash2, Phone, Mail, User as UserIcon } from 'lucide-react';
import { Navigate } from 'react-router-dom';

export default function TrustedContacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadContacts();
  }, [user]);

  const loadContacts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('trusted_contacts').select('*').order('name');
    if (data) setContacts(data);
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user) return;

    if (!phone && !email) {
      setError('Please provide at least a phone number or email.');
      return;
    }

    if (phone && !/^\d+$/.test(phone)) {
      setError('Phone number must contain only digits (e.g. 27821234567), no spaces or + signs.');
      return;
    }

    setIsSubmitting(true);
    const { error: insertError } = await supabase.from('trusted_contacts').insert({
      user_id: user.id,
      name,
      phone: phone || null,
      email: email || null,
      relationship: relationship || null
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setName('');
      setPhone('');
      setEmail('');
      setRelationship('');
      loadContacts();
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this contact?')) return;
    await supabase.from('trusted_contacts').delete().eq('id', id);
    loadContacts();
  };

  if (!user) return <Navigate to="/login" />;

  return (
    <div className="max-w-4xl mx-auto w-full p-4 sm:p-8">
      <h1 className="text-3xl font-bold text-slate-800 mb-2 tracking-tight">Trusted Contacts</h1>
      <p className="text-slate-600 mb-8 max-w-2xl">
        Add people you trust to be notified in an emergency. If you trigger an SOS, they will receive your live location.
      </p>

      <div className="grid md:grid-cols-3 gap-8">
        
        <div className="md:col-span-1">
          <form onSubmit={handleAdd} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Add Contact</h2>
            
            {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg font-medium">{error}</div>}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Name <span className="text-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserIcon className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="pl-10 w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-sm"
                  placeholder="Jane Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Phone Number</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                  className="pl-10 w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-sm"
                  placeholder="27821234567"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">Digits only, international format</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="pl-10 w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-sm"
                  placeholder="jane@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Relationship</label>
              <input
                type="text"
                value={relationship}
                onChange={e => setRelationship(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-sm"
                placeholder="Sister, Friend, etc."
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 mt-4"
            >
              <Plus className="w-4 h-4" />
              Add Contact
            </button>
          </form>
        </div>

        <div className="md:col-span-2 space-y-4">
          {loading ? (
             <div className="p-8 text-center text-slate-500">Loading contacts...</div>
          ) : contacts.length === 0 ? (
             <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
               No trusted contacts added yet.
             </div>
          ) : (
            contacts.map(c => (
              <div key={c.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                    {c.name}
                    {c.relationship && <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{c.relationship}</span>}
                  </h3>
                  <div className="mt-2 space-y-1">
                    {c.phone && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone className="w-4 h-4 text-slate-400" />
                        {c.phone}
                      </div>
                    )}
                    {c.email && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Mail className="w-4 h-4 text-slate-400" />
                        {c.email}
                      </div>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => handleDelete(c.id)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
