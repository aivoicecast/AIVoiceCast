
export type SubscriptionTier = 'free' | 'pro';
export type ChannelVisibility = 'public' | 'private' | 'group';
export type ReaderTheme = 'slate' | 'light' | 'dark' | 'sepia';
export type BookStyle = 'brutalist' | 'academic' | 'minimal';

export interface TranscriptItem {
  role: 'user' | 'ai';
  text: string;
  timestamp: number;
}

export interface UserFeedback {
    id: string;
    userId: string;
    userName: string;
    viewId: string;
    message: string;
    type: 'bug' | 'feature' | 'general';
    logs: any[];
    timestamp: number;
    status: 'open' | 'refracted' | 'closed';
}

export interface UserAvailability {
    enabled: boolean;
    startHour: number;
    endHour: number;
    days: number[];
}

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
  publicKey?: string;
  certificate?: string;
}

export interface DualVerse {
  uid: string;
  number: string;
  en: string;
  zh: string;
  audioUrl?: string;   // Baked permanent URL for English audio
  audioZhUrl?: string; // Baked permanent URL for Chinese audio
}

export interface GeneratedLecture {
  uid?: string;
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
  groupId?: string;
  voiceName: string;
  systemInstruction: string;
  likes: number;
  dislikes: number;
  comments: Comment[];
  tags: string[];
  imageUrl: string;
  createdAt?: number;
  welcomeMessage?: string;
  starterPrompts?: string[];
  chapters?: Chapter[];
  fullBookUrl?: string;
  appendix?: Attachment[];
  shares?: number;
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

export interface CommunityDiscussion {
  id: string;
  lectureId?: string;
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

export interface RecordingSession {
  id: string;
  userId: string;
  channelId: string;
  channelTitle: string;
  channelImage?: string;
  timestamp: number;
  mediaUrl: string;
  driveUrl?: string;
  mediaType: 'video/webm' | 'audio/webm' | 'youtube';
  transcriptUrl: string;
  size?: number;
  blob?: Blob;
}

export type AttachmentType = 'image' | 'video' | 'audio' | 'file';

export interface Attachment {
  id: string;
  type: AttachmentType;
  url: string;
  name?: string;
}

export type ViewID = 'dashboard' | 'directory' | 'podcast_detail' | 'live_session' | 'docs' | 'code_studio' | 'whiteboard' | 'blog' | 'chat' | 'careers' | 'calendar' | 'mentorship' | 'recordings' | 'check_designer' | 'check_viewer' | 'shipping_labels' | 'icon_generator' | 'notebook_viewer' | 'card_workshop' | 'card_viewer' | 'mission' | 'firestore_debug' | 'coin_wallet' | 'mock_interview' | 'graph_studio' | 'story' | 'privacy' | 'user_guide' | 'bible_study' | 'scripture_ingest' | 'groups' | 'book_studio' | 'feedback_manager' | 'firestore_inspector' | 'public_channel_inspector' | 'my_channel_inspector' | 'cloud_debug' | 'debug_view';

export interface Group {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  createdAt: number;
  visibility: 'public' | 'private';
}

export interface CodeFile {
  name: string;
  path: string;
  content: string;
  language: 'javascript' | 'typescript' | 'python' | 'cpp' | 'c' | 'java' | 'go' | 'rs' | 'json' | 'markdown' | 'html' | 'css' | 'text' | 'plantuml' | 'whiteboard' | 'pdf' | 'video' | 'audio' | 'youtube' | 'shell' | 'javascript (react)' | 'typescript (react)' | 'c++' | 'c#';
  loaded?: boolean;
  isDirectory?: boolean;
  sha?: string;
  size?: number;
  treeSha?: string;
  childrenFetched?: boolean;
  driveId?: string;
}

export interface AgentMemory {
  id?: string;
  ownerId?: string;
  recipientName: string;
  senderName: string;
  occasion: string;
  cardMessage: string;
  context: string;
  theme: 'festive' | 'minimal' | 'cyberpunk' | 'chinese-poem' | 'abstract';
  customThemePrompt?: string;
  userImages: string[];
  googlePhotosUrl?: string;
  generatedAt: string;
  fontFamily?: string;
  fontSizeScale?: number;
  coverImageUrl?: string;
  backImageUrl?: string;
  voiceMessageUrl?: string;
  songLyrics?: string;
  songUrl?: string;
}

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

export interface ChatChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'public';
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
  status: 'pending' | 'scheduled' | 'completed' | 'rejected' | 'cancelled';
  type: 'p2p' | 'system';
  createdAt: number;
  recordingUrl?: string;
  transcriptUrl?: string;
}

export interface Invitation {
  id: string;
  fromUserId: string;
  fromName: string;
  toEmail: string;
  toUserId?: string;
  groupId?: string;
  groupName?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
  type: 'group' | 'session' | 'coin';
  link?: string;
  amount?: number;
  memo?: string;
}

export interface DigitalReceipt {
    id: string;
    senderId: string;
    senderName: string;
    receiverId: string;
    receiverName: string;
    amount: number;
    memo: string;
    status: 'pending' | 'confirmed' | 'claimed';
    createdAt: number;
    confirmedAt?: number;
    claimedAt?: number;
}

export interface CodeProject {
  id: string;
  name: string;
  files: CodeFile[];
  lastModified: number;
  activeFilePath?: string;
  accessLevel?: 'public' | 'restricted';
  allowedUserIds?: string[];
  activeClientId?: string;
  github?: {
    owner: string;
    repo: string;
    branch: string;
    sha: string;
  };
}

export interface CursorPosition {
  clientId: string;
  userName: string;
  line: number;
  ch: number;
  timestamp: number;
}

export interface CloudItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  updatedAt: number;
}

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
  text?: string;
  fontSize?: number;
  borderRadius?: number;
  rotation?: number;
  startCap?: CapStyle;
  endCap?: CapStyle;
}

export type ToolType = 'pen' | 'eraser' | 'rect' | 'circle' | 'line' | 'arrow' | 'type' | 'hand' | 'move' | 'curve' | 'triangle' | 'star';
export type LineStyle = 'solid' | 'dashed' | 'dotted' | 'dash-dot' | 'long-dash';
export type BrushType = 'standard' | 'pencil' | 'marker' | 'airbrush' | 'calligraphy-pen' | 'writing-brush';
export type CapStyle = 'none' | 'arrow' | 'circle';

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
  publishedAt?: number | null;
  createdAt: number;
  likes: number;
  commentCount: number;
  tags: string[];
  comments?: Comment[];
}

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

export interface NotebookCell {
  id: string;
  type: 'markdown' | 'code';
  content: string;
  language?: string;
  output?: string;
  isExecuting?: boolean;
}

export interface GlobalStats {
  totalLogins: number;
  uniqueUsers: number;
}

export interface GeneratedIcon {
  id: string;
  url: string;
  prompt: string;
  style: string;
  createdAt: number;
  ownerId: string;
}

export interface BankingCheck {
  id: string;
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
  isCoinCheck: boolean;
  coinAmount: number;
  isInsured: boolean;
  isVerified: boolean;
  ownerId?: string;
  checkImageUrl?: string;
  drivePdfUrl?: string;
  watermarkUrl?: string;
  insurancePolicy?: InsurancePolicy;
}

export interface InsurancePolicy {
  amountPerSecond: number;
  maxAmount: number;
  validWindows: { start: number, end: number }[];
  recipientUid?: string;
}

export interface ShippingLabel {
  id: string;
  sender: Address;
  recipient: Address;
  package: PackageDetails;
  trackingNumber: string;
  createdAt: number;
  ownerId: string;
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

export interface CoinTransaction {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
  type: 'transfer' | 'offline' | 'grant' | 'payment' | 'receipt_claim';
  memo?: string;
  timestamp: number;
  isVerified: boolean;
  offlineToken?: string;
}

export interface OfflinePaymentToken {
  senderId: string;
  senderName: string;
  recipientId: string;
  amount: number;
  timestamp: number;
  nonce: string;
  memo: string;
  signature: string;
  certificate: string;
}

export interface PendingClaim {
  id: string;
  token: string;
  amount: number;
  timestamp: number;
}

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
  visibility: ChannelVisibility;
  language: string;
}

export interface TodoItem {
  id: string;
  text: string;
  isCompleted: boolean;
  date: string;
}
