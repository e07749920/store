import React, { useState } from 'react';
import { UserProfile as UserProfileType } from '../types';
import { UserCircle, Mail, Shield, Save, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { userApi } from '../services/api';

interface UserProfileProps {
  currentUser: UserProfileType;
  setCurrentUser: (user: UserProfileType) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ currentUser, setCurrentUser }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(currentUser.name);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const updatedProfile = {
        ...currentUser,
        name: name,
        lastActive: new Date().toLocaleString()
      };

      await userApi.update(updatedProfile);
      setCurrentUser(updatedProfile);
      setSaveSuccess(true);
      setIsEditing(false);

      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      setSaveError(error.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);

      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (error: any) {
      setPasswordError(error.message || 'Failed to change password');
    } finally {
      setIsSaving(false);
    }
  };

  const getPasswordStrength = (password: string): { strength: string; color: string } => {
    if (password.length === 0) return { strength: '', color: '' };
    if (password.length < 6) return { strength: 'Weak', color: 'text-rose-400' };
    if (password.length < 10) return { strength: 'Medium', color: 'text-amber-400' };
    return { strength: 'Strong', color: 'text-emerald-400' };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 max-w-4xl mx-auto">

      <div className="flex items-center gap-4">
        <div className="p-4 bg-slate-800 rounded-2xl border border-slate-300 dark:border-white/10 shadow-lg">
          <UserCircle className="w-8 h-8 text-slate-200" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white font-[Space_Grotesk] tracking-tight">User Profile</h2>
          <p className="text-slate-600 dark:text-slate-400 font-mono text-sm">Manage your account settings</p>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 text-emerald-400 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-mono text-sm">Profile updated successfully!</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 animate-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5" />
          <span className="font-mono text-sm">{saveError}</span>
        </div>
      )}

      {passwordSuccess && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 text-emerald-400 animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-mono text-sm">Password changed successfully!</span>
        </div>
      )}

      <div className="glass-panel rounded-3xl p-8 border border-slate-200 dark:border-white/10">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
          <UserCircle className="w-6 h-6 text-indigo-400" />
          Profile Information
        </h3>

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-500 uppercase tracking-widest mb-2">
              Full Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
              />
            ) : (
              <p className="text-lg text-slate-900 dark:text-white font-mono">{currentUser.name}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Mail className="w-3 h-3" />
              Email Address
            </label>
            <p className="text-lg text-slate-900 dark:text-white font-mono">{currentUser.email}</p>
            <p className="text-xs text-slate-600 dark:text-slate-500 mt-1">Email cannot be changed</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Shield className="w-3 h-3" />
              Role
            </label>
            <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-sm ${
              currentUser.role === 'ADMIN' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
              currentUser.role === 'STAFF' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
              'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
            }`}>
              {currentUser.role}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Calendar className="w-3 h-3" />
              Last Active
            </label>
            <p className="text-sm text-slate-900 dark:text-white font-mono">{currentUser.lastActive}</p>
          </div>

          <div className="flex gap-3 pt-4">
            {isEditing ? (
              <>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setName(currentUser.name);
                  }}
                  className="px-6 py-3 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex-1 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50"
                >
                  {isSaving ? (
                    <>Saving...</>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg transition-all hover:scale-[1.02]"
              >
                Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-3xl p-8 border border-slate-200 dark:border-white/10">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
          <Lock className="w-6 h-6 text-indigo-400" />
          Change Password
        </h3>

        {!isChangingPassword ? (
          <button
            onClick={() => setIsChangingPassword(true)}
            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-white/5 dark:hover:bg-white/10 text-white font-bold transition-all"
          >
            Change Password
          </button>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-5">
            {passwordError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{passwordError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-500 uppercase tracking-widest mb-2">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-3 pr-12 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-500 uppercase tracking-widest mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-3 pr-12 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordStrength.strength && (
                <p className={`text-xs mt-1 ${passwordStrength.color}`}>
                  Password strength: {passwordStrength.strength}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-500 uppercase tracking-widest mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-3 pr-12 text-slate-900 dark:text-white focus:border-indigo-500 outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsChangingPassword(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setPasswordError(null);
                }}
                className="px-6 py-3 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50"
              >
                {isSaving ? (
                  <>Updating...</>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Update Password
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
