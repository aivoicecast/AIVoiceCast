
export type SubscriptionTier = 'free' | 'pro';
export type ChannelVisibility = 'public' | 'private' | 'group';
export type ReaderTheme = 'slate' | 'light' | 'dark' | 'sepia';

export interface TranscriptItem {
  role: 'user' | 'ai';
  text: string;
  timestamp: number;
}

// Added UserAvailability for Mentorship features
export interface UserAvailability {
    enabled: boolean;
    startHour: number;
    endHour: number;
    days: number[];
}

// Added TrustScore for Finance Lab verification features
export interface TrustScore {
    score: number;
    totalChecksIssued: number;
    averageAmount: number;
    verifiedVolume: number;
    lastActivity: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: number;
  lastLogin: number;
  subscriptionTier: SubscriptionTier;
  groups: string[];
  coinBalance: number;
  languagePreference?: 'en' | 'zh';
  preferredScriptureView?: 'dual' | 'en' | 'zh';
  preferredReaderTheme?: ReaderTheme;
  preferredRecordingTarget?: 'youtube' | 'drive';
  cloudTtsApiKey?: string;
  // Added missing properties to resolve firestoreService and SettingsModal errors
  apiUsageCount?: number;
  lastCoinGrantAt?: number;
  preferredAiProvider?: 'gemini' | 'openai';
  followers?: string[];
  following?: string[];
  likedChannelIds?: string[];
  resumeUrl?: string;
  resumeText?: string;
  defaultRepoUrl?: string;
  defaultLanguage?: string;
  headline?: string;
  company?: string;
  linkedinUrl?: string;
  availability?: UserAvailability;
  senderAddress?: string;
  savedSignatureUrl?: string;
  nextCheckNumber?: number;
  interests?: string[];
}

export interface DualVerse {
  uid: string;
  number: string;
  en: string;
  zh: string;
}

export interface GeneratedLecture {
  uid?: string; // New: Unique ID for caching
  topic: string;
  professorName: string;
  studentName: string;
  sections: { speaker: string; text: string }[];
  readingMaterial?: string;
  homework?: string;
}

export interface Channel {
  id: string;
  title: string;
  description: string;
  author: string;
  ownerId?: string;
  visibility?: ChannelVisibility;
  // Added groupId to resolve CreateChannelModal error
  groupId?: string;
  voiceName: string;
  systemInstruction: string;
  likes: number;
  dislikes: number;
  comments: Comment[];
  tags: string[];
  imageUrl: string;
  createdAt: number;
  chapters?: Chapter[];
  welcomeMessage?: string;
  starterPrompts?: string[];
  shares?: number;
}

// Added ChannelStats for real-time engagement tracking
export interface ChannelStats {
    likes: number;
    dislikes: number;
    shares: number;
}

export interface Comment {
  id: string;
  userId: string;
  user: string;
  text: string;
  timestamp: number;
  attachments?: Attachment[];
}

// Added Attachment types for the collaborative workspace
export type AttachmentType = 'image' | 'video' | 'audio' | 'file';

export interface Attachment {
    id: string;
    type: AttachmentType;
    url: string;
    name?: string;
}

export interface Chapter {
  id: string;
  title: string;
  subTopics: SubTopic[];
}

export interface SubTopic {
  id: string;
  title: string;
}

// Added Group for Community features
export interface Group {
    id: string;
    name: string;
    ownerId: string;
    memberIds: string[];
    createdAt: number;
    visibility: 'public' | 'private';
}

// Added Chat types for Team Space
export interface ChatChannel {
    id: string;
    name: string;
    type: 'public' | 'group' | 'dm';
    memberIds: string[];
    createdAt: number;
}

export interface RealTimeMessage {
    id: string;
    text: string;
    senderId: string;
    senderName: string;
    senderImage?: string;
    timestamp: any; // Firestore Timestamp
    replyTo?: {
        id: string;
        text: string;
        senderName: string;
    };
    attachments?: Attachment[];
}

// Added CommunityDiscussion for Document Studio features
export interface CommunityDiscussion {
    id: string;
    lectureId: string;
    channelId: string;
    userId: string;
    userName: string;
    transcript: TranscriptItem[];
    createdAt: number;
    updatedAt?: number;
    isManual?: boolean;
    title: string;
    designDoc?: string;
    segmentIndex?: number;
    visibility?: ChannelVisibility;
    groupIds?: string[];
}

// Added RecordingSession for Archive features
export interface RecordingSession {
    id: string;
    userId: string;
    channelId: string;
    channelTitle: string;
    channelImage?: string;
    timestamp: number;
    mediaUrl: string;
    driveUrl?: string;
    mediaType: 'audio/webm' | 'video/webm';
    transcriptUrl: string;
    size: number;
    blob?: Blob;
}

// Added Code types for Builder Studio
export interface CodeFile {
    name: string;
    path: string;
    language: 'javascript' | 'typescript' | 'python' | 'c++' | 'c' | 'java' | 'go' | 'rs' | 'json' | 'markdown' | 'html' | 'css' | 'text' | 'plantuml' | 'whiteboard' | 'pdf' | 'video' | 'youtube' | 'audio' | 'javascript (react)' | 'typescript (react)' | 'shell' | 'c#';
    content: string;
    loaded?: boolean;
    isDirectory?: boolean;
    sha?: string;
    size?: number;
    treeSha?: string;
    childrenFetched?: boolean;
    driveId?: string;
}

export interface CodeProject {
    id: string;
    name: string;
    files: CodeFile[];
    lastModified: number;
    activeFilePath?: string;
    activeClientId?: string;
    accessLevel?: 'public' | 'restricted';
    allowedUserIds?: string[];
    github?: {
        owner: string;
        repo: string;
        branch: string;
        sha: string;
    };
}

export interface CursorPosition {
    clientId: string;
    userId: string;
    userName: string;
    filePath: string;
    line: number;
    ch: number;
    timestamp: number;
}

// Added Cloud types for VFS integration
export type CloudItemType = 'file' | 'folder';

export interface CloudItem {
    id: string;
    name: string;
    type: CloudItemType;
    path: string;
    mimeType: string;
}

// Added Whiteboard types for Visual Canvas
export type ToolType = 'pen' | 'eraser' | 'move' | 'rect' | 'circle' | 'line' | 'arrow' | 'type' | 'hand' | 'curve' | 'triangle' | 'star';
export type LineStyle = 'solid' | 'dashed' | 'dotted' | 'dash-dot' | 'long-dash';
export type BrushType = 'standard' | 'pencil' | 'marker' | 'airbrush' | 'calligraphy-pen' | 'writing-brush';
export type CapStyle = 'none' | 'arrow' | 'circle';

export interface WhiteboardElement {
    id: string;
    type: ToolType;
    x: number;
    y: number;
    color: string;
    strokeWidth: number;
    lineStyle?: LineStyle;
    brushType?: BrushType;
    points?: { x: number, y: number }[];
    width?: number;
    height?: number;
    endX?: number;
    endY?: number;
    borderRadius?: number;
    rotation?: number;
    startCap?: CapStyle;
    endCap?: CapStyle;
    text?: string;
    fontSize?: number;
}

// Added Blog types for Community Feed
export interface Blog {
    id: string;
    ownerId: string;
    authorName: string;
    title: string;
    description: string;
    createdAt: number;
}

export interface BlogPost {
    id: string;
    blogId: string;
    authorId: string;
    authorName: string;
    authorImage?: string;
    title: string;
    excerpt: string;
    content: string;
    status: 'draft' | 'published';
    publishedAt: number | null;
    createdAt: number;
    likes: number;
    commentCount: number;
    tags: string[];
    comments?: Comment[];
}

// Added Career types for Talent Hub
export interface JobPosting {
    id?: string;
    title: string;
    company: string;
    location: string;
    type: 'full-time' | 'part-time' | 'contract' | 'freelance';
    description: string;
    requirements?: string;
    contactEmail: string;
    postedBy: string;
    postedAt: number;
}

export interface CareerApplication {
    id?: string;
    userId: string;
    userName: string;
    userEmail: string;
    userPhotoURL?: string;
    role: 'mentor' | 'expert';
    expertise: string[];
    bio: string;
    resumeUrl: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: number;
}

// Added Notebook types for Research Lab
export interface NotebookCell {
    id: string;
    type: 'markdown' | 'code';
    content: string;
    language?: string;
    output?: string;
    isExecuting?: boolean;
}

export interface Notebook {
    id: string;
    title: string;
    author: string;
    ownerId?: string;
    description: string;
    kernel: string;
    tags: string[];
    createdAt: number;
    updatedAt: number;
    cells: NotebookCell[];
}

// Added Memory types for Gift Workshop
export interface AgentMemory {
    id?: string;
    ownerId?: string;
    recipientName: string;
    senderName: string;
    occasion: string;
    cardMessage: string;
    context?: string;
    theme: 'festive' | 'minimal' | 'cyberpunk' | 'chinese-poem' | 'abstract' | 'cozy';
    customThemePrompt?: string;
    userImages: string[];
    googlePhotosUrl?: string;
    generatedAt: string;
    fontFamily?: string;
    fontSizeScale?: number;
    coverImageUrl?: string;
    backImageUrl?: string;
    voiceMessageUrl?: string;
    songUrl?: string;
    songLyrics?: string;
}

// Added System Stats types
export interface GlobalStats {
    totalLogins: number;
    uniqueUsers: number;
}

// Added Icon types for Brand Lab
export interface GeneratedIcon {
    id: string;
    url: string;
    prompt: string;
    style: string;
    createdAt: number;
}

// Added Finance types for Finance Lab
export interface InsurancePolicy {
    amountPerSecond: number;
    maxAmount: number;
    validWindows: { start: number, end: number }[];
    recipientUid?: string;
}

export interface BankingCheck {
    id: string;
    ownerId?: string;
    payee: string;
    amount: number;
    amountWords: string;
    date: string;
    memo: string;
    checkNumber: string;
    routingNumber: string;
    accountNumber: string;
    bankName: string;
    senderName: string;
    senderAddress: string;
    signature: string;
    signatureUrl?: string;
    watermarkUrl?: string;
    checkImageUrl?: string;
    drivePdfUrl?: string;
    isCoinCheck: boolean;
    coinAmount: number;
    isClaimed?: boolean;
    isInsured: boolean;
    isVerified: boolean;
    insurancePolicy?: InsurancePolicy;
}

// Added Shipping types for Logistics Lab
export interface ShippingLabel {
    id: string;
    ownerId: string;
    sender: Address;
    recipient: Address;
    package: PackageDetails;
    trackingNumber: string;
    createdAt: number;
}

export interface Address {
    name: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
}

export interface PackageDetails {
    weight: string;
    unit: 'lbs' | 'kg';
    type: 'box' | 'envelope' | 'pallet';
    service: string;
    carrier: 'USPS' | 'UPS' | 'FedEx';
}

// Added Coin types for Neural Wallet
export interface CoinTransaction {
    id: string;
    fromId: string;
    fromName: string;
    toId: string;
    toName: string;
    amount: number;
    type: 'transfer' | 'offline' | 'grant';
    memo?: string;
    timestamp: number;
    isVerified: boolean;
    offlineToken?: string;
}

// Added Todo types for Productivity features
export interface TodoItem {
    id: string;
    text: string;
    isCompleted: boolean;
    date: string;
}

// Added Token types for Secure Exchange
export interface OfflinePaymentToken {
    senderId: string;
    senderName: string;
    recipientId: string;
    amount: number;
    timestamp: number;
    nonce: string;
    memo?: string;
    signature: string;
    certificate: string;
}

// Added Interview types for Career Lab
export interface MockInterviewRecording {
    id: string;
    userId: string;
    userName: string;
    mode: string;
    jobDescription: string;
    timestamp: number;
    videoUrl: string;
    feedback: string;
    transcript: TranscriptItem[];
    visibility: 'public' | 'private';
    language?: string;
}

// Added Booking types for Mentor Matching
export interface Booking {
    id: string;
    userId: string;
    hostName: string;
    mentorId: string;
    mentorName: string;
    mentorImage?: string;
    date: string;
    time: string;
    duration: number;
    endTime: string;
    topic: string;
    invitedEmail: string;
    status: 'pending' | 'scheduled' | 'rejected' | 'cancelled' | 'completed';
    type: 'p2p' | 'official';
    createdAt: number;
    recordingUrl?: string;
    transcriptUrl?: string;
}

export interface Invitation {
    id: string;
    fromUserId: string;
    fromName: string;
    toEmail: string;
    groupId?: string;
    groupName?: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: number;
    type: 'group' | 'session' | 'coin';
    link?: string;
    amount?: number;
}

export interface PendingClaim {
    id: string;
    token: string;
    amount: number;
    expiresAt: number;
}

export type ViewID = 'dashboard' | 'directory' | 'podcast_detail' | 'live_session' | 'docs' | 'code_studio' | 'whiteboard' | 'blog' | 'chat' | 'careers' | 'calendar' | 'groups' | 'mentorship' | 'recordings' | 'check_designer' | 'check_viewer' | 'shipping_labels' | 'shipping_viewer' | 'icon_generator' | 'icon_viewer' | 'notebook_viewer' | 'card_workshop' | 'card_viewer' | 'mission' | 'firestore_debug' | 'coin_wallet' | 'mock_interview' | 'graph_studio' | 'story' | 'privacy' | 'user_guide' | 'bible_study' | 'book_studio';
