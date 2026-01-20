
import React, { useState, useEffect } from 'react';
import { X, User, MessageSquare, Heart, Users, Check, Bell, Play, ShieldCheck } from 'lucide-react';
import { Channel, UserProfile } from '../types';
import { getUserProfile, followUser, unfollowUser, getUserProfileByEmail, getChannelsByIds, getCreatorChannels, isUserAdmin } from '../services/firestoreService';

interface CreatorProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel;
  onMessage: () => void;
  onChannelClick: (id: string) => void;
  currentUser?: any;
  userProfile?: UserProfile | null;
}

export const CreatorProfileModal: React.FC<CreatorProfileModalProps> = ({ isOpen, onClose, channel, onMessage, onChannelClick, currentUser, userProfile: currentUserProfile }) => {
  const [creatorProfile, setCreatorProfile] = useState<UserProfile | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'posts' | 'community'>('posts');
  const [isLoading, setIsLoading] = useState(false);
  const [targetOwnerId, setTargetOwnerId] = useState<string | null>(null);
  
  // Recent Episodes (Channels) State
  const [recentChannels, setRecentChannels] = useState<Channel[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  
  // Liked Channels State
  const [likedChannels, setLikedChannels] = useState<Channel[]>([]);
  const [loadingLikes, setLoadingLikes] = useState(false);

  const isAdmin = isUserAdmin(currentUserProfile || null);

  // Load creator profile data
  useEffect(() => {
    if (!isOpen) return;

    let isActive = true;
    
    const loadProfile = async () => {
        setIsLoading(true);
        let oid = channel.ownerId;

        if (oid) {
            if (isActive) setTargetOwnerId(oid);
            try {
                const profile = await getUserProfile(oid);
                if (profile && isActive) {
                    setCreatorProfile(profile);
                    setFollowerCount(profile.followers?.length || 0);
                    if (currentUser && profile.followers?.includes(currentUser.uid)) {
                        setIsFollowing(true);
                    }
                    
                    // Load Liked Channels
                    if (profile.likedChannelIds && profile.likedChannelIds.length > 0) {
                        setLoadingLikes(true);
                        try {
                            const channels = await getChannelsByIds(profile.likedChannelIds);
                            if (isActive) setLikedChannels(channels);
                        } catch (e) {
                            console.error("Failed to load liked channels", e);
                        } finally {
                            if (isActive) setLoadingLikes(false);
                        }
                    }
                }
                
                // NEW: Load Created Channels (Episodes)
                setLoadingRecent(true);
                getCreatorChannels(oid).then(channels => {
                    if (isActive) setRecentChannels(channels);
                    setLoadingRecent(false);
                }).catch(() => {
                    if (isActive) setLoadingRecent(false);
                });

            } catch (err) {
                console.error("Failed to load creator profile", err);
            }
        } else {
            // Fallback purely for display if no owner found at all (Prism Official)
            if (isActive) setFollowerCount(9999); 
        }
        if (isActive) setIsLoading(false);
    };

    loadProfile();

    return () => { isActive = false; };
  }, [isOpen, channel.ownerId, currentUser]);

  if (!isOpen) return null;

  const handleFollow = async () => {
    if (!currentUser) {
        alert("Please sign in to follow creators.");
        return;
    }
    
    if (!targetOwnerId) {
        alert("Creator profile not found. Cannot follow at this time.");
        return;
    }

    const prevIsFollowing = isFollowing;
    const prevCount = followerCount;

    if (isFollowing) {
        setIsFollowing(false);
        setFollowerCount(prev => Math.max(0, prev - 1));
        try {
            await unfollowUser(currentUser.uid, targetOwnerId);
        } catch (e) {
            console.error("Unfollow failed", e);
            setIsFollowing(prevIsFollowing);
            setFollowerCount(prevCount);
            alert("Failed to unfollow. Please try again.");
        }
    } else {
        setIsFollowing(true);
        setFollowerCount(prev => prev + 1);
        try {
            await followUser(currentUser.uid, targetOwnerId);
        } catch (e) {
            console.error("Follow failed", e);
            setIsFollowing(prevIsFollowing);
            setFollowerCount(prevCount);
            alert("Failed to follow. Please check your connection.");
        }
    }
  };

  const isThirdParty = (url?: string) => {
    if (!url) return true;
    const lowUrl = url.toLowerCase();
    return lowUrl.includes('ui-avatars.com') || lowUrl.includes('placehold.co') || lowUrl.includes('placeholder');
  };

  const profileImage = creatorProfile?.photoURL && !isThirdParty(creatorProfile.photoURL) 
    ? creatorProfile.photoURL 
    : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full sm:w-[400px] bg-slate-900 border-t sm:border border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Header / Cover */}
        <div className="h-24 bg-gradient-to-r from-indigo-900 to-purple-900 relative">
            <button 
                onClick={onClose}
                className="absolute top-4 right-4 bg-black/20 hover:bg-black/40 text-white p-2 rounded-full backdrop-blur-md transition-colors z-10"
            >
                <X size={20} />
            </button>
        </div>

        <div className="px-6 pb-6 -mt-12 flex flex-col items-center text-center">
            {/* Avatar */}
            <div className="relative">
                {profileImage ? (
                    <img 
                        src={profileImage}
                        alt={creatorProfile?.displayName || channel.author} 
                        className="w-24 h-24 rounded-full border-4 border-slate-900 object-cover bg-slate-800"
                    />
                ) : (
                    <div className="w-24 h-24 rounded-full border-4 border-slate-900 bg-slate-800 flex items-center justify-center text-2xl font-black text-indigo-400">
                        {(creatorProfile?.displayName || channel.author).substring(0, 1).toUpperCase()}
                    </div>
                )}
                {isFollowing && (
                    <div className="absolute bottom-1 right-1 bg-emerald-500 text-white p-1 rounded-full border-2 border-slate-900">
                        <Check size={12} strokeWidth={4} />
                    </div>
                )}
            </div>

            <h2 className="text-xl font-bold text-white mt-3">
                {creatorProfile?.displayName || channel.author}
                {!channel.ownerId && <span className="ml-1 text-[10px] text-indigo-400 bg-indigo-900/30 px-1 rounded border border-indigo-500/30 align-top">OFFICIAL</span>}
                {isUserAdmin(creatorProfile) && <ShieldCheck size={16} className="inline ml-1 text-indigo-400" />}
            </h2>
            <p className="text-sm text-slate-400">@{channel.author.toLowerCase().replace(/\s+/g, '_')}</p>

            {/* Stats Row */}
            <div className="flex items-center gap-6 mt-4 text-sm">
                <div className="flex flex-col items-center">
                    <span className="font-bold text-white">{creatorProfile?.following?.length || 0}</span>
                    <span className="text-slate-500 text-xs">Following</span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="font-bold text-white">{followerCount.toLocaleString()}</span>
                    <span className="text-slate-500 text-xs">Followers</span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="font-bold text-white">{creatorProfile?.likedChannelIds?.length || 0}</span>
                    <span className="text-slate-500 text-xs">Loved</span>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 w-full mt-6">
                <button 
                    onClick={handleFollow}
                    disabled={isLoading || !targetOwnerId}
                    className={`flex-1 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                        isFollowing 
                        ? 'bg-slate-800 text-slate-200 border border-slate-700' 
                        : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20'
                    } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {isFollowing ? 'Following' : 'Follow'}
                </button>
                <button 
                    onClick={onMessage}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold border border-slate-700 transition-colors flex items-center justify-center gap-2"
                >
                    <MessageSquare size={18} />
                    Message
                </button>
            </div>
            
            {/* Bio */}
            <p className="text-sm text-slate-300 mt-6 leading-relaxed line-clamp-3">
                {channel.description}
            </p>
        </div>

        {/* Content Tabs */}
        <div className="flex border-t border-slate-800 mt-2 bg-slate-900">
            <button 
                onClick={() => setActiveTab('posts')}
                className={`flex-1 py-3 flex justify-center border-b-2 transition-colors ${activeTab === 'posts' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
                <Users size={20} />
            </button>
            <button 
                onClick={() => setActiveTab('community')}
                className={`flex-1 py-3 flex justify-center border-b-2 transition-colors ${activeTab === 'community' ? 'border-indigo-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
                <Heart size={20} />
            </button>
        </div>
        
        {/* Content Grid */}
        <div className="flex-1 overflow-y-auto bg-slate-900">
            {activeTab === 'posts' ? (
                <>
                    <div className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider sticky top-0 bg-slate-900 z-10 border-b border-slate-800">
                        Recent Episodes
                    </div>
                    {loadingRecent ? (
                        <div className="p-12 text-center flex justify-center">
                            <span className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></span>
                        </div>
                    ) : recentChannels.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 text-xs italic">
                            No public episodes found.
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-0.5">
                            {recentChannels.map(ch => (
                                <div 
                                    key={ch.id} 
                                    onClick={() => onChannelClick(ch.id)}
                                    className="aspect-[3/4] bg-slate-800 relative group cursor-pointer border border-slate-900"
                                >
                                    {ch.imageUrl && !isThirdParty(ch.imageUrl) ? (
                                        <img 
                                            src={ch.imageUrl} 
                                            alt={ch.title}
                                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-slate-900 font-black text-xs text-indigo-400">
                                            {ch.title.substring(0, 1).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="absolute bottom-1 right-1 flex items-center gap-1 text-[10px] text-white font-bold drop-shadow-md bg-black/40 px-1 rounded backdrop-blur-sm">
                                        <Play size={8} fill="white" /> {ch.likes || 0}
                                    </div>
                                    {ch.createdAt && (Date.now() - ch.createdAt < 86400000 * 7) && (
                                        <div className="absolute top-1 left-1 w-2 h-2 bg-red-500 rounded-full border border-white shadow-sm"></div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <div className="pb-4">
                    <div className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider sticky top-0 bg-slate-900 z-10 border-b border-slate-800">
                        Loved Podcasts
                    </div>
                    {loadingLikes ? (
                        <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                            <span className="w-6 h-6 border-2 border-slate-600 border-t-white rounded-full animate-spin"></span>
                            <p className="text-xs mt-2">Loading...</p>
                        </div>
                    ) : likedChannels.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                            <Heart size={32} className="mb-2 opacity-20"/>
                            <p className="text-sm">No loved podcasts yet.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {likedChannels.map(ch => (
                                <div 
                                    key={ch.id} 
                                    onClick={() => onChannelClick(ch.id)}
                                    className="flex items-center gap-3 p-3 border-b border-slate-800 hover:bg-slate-800/50 transition-colors cursor-pointer"
                                >
                                    {ch.imageUrl && !isThirdParty(ch.imageUrl) ? (
                                        <img src={ch.imageUrl} className="w-12 h-12 rounded-lg object-cover bg-slate-800" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center font-black text-indigo-400">
                                            {ch.title.substring(0, 1).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-white truncate">{ch.title}</p>
                                        <p className="text-xs text-slate-400">{ch.author}</p>
                                    </div>
                                    <div className="text-red-500 p-2"><Heart size={16} fill="currentColor"/></div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>

      </div>
    </div>
  );
};
