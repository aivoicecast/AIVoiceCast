
export type SubscriptionTier = 'free' | 'pro';

export type ChannelVisibility = 'public' | 'private' | 'group';

export type ReaderTheme = 'slate' | 'light' | 'dark' | 'sepia';

export interface TranscriptItem {
  role: 'user' | 'ai';
  text: string;
  timestamp: number;
}

export interface UserAvailability {
  days: number[]; // 0-6
  startHour: number; // 0-23
  endHour: number; // 0-23
  enabled: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: number;
  lastLogin: number;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus?: string;
  apiUsageCount: number;
  groups: string[];
  coinBalance: number;
  lastCoinGrantAt?: number;
  lastBackup?: any; // Firestore Timestamp
  backupSize?: number;
  itemCount?: number;
  preferredAiProvider?: 'gemini' | 'openai';
  preferredReaderTheme?: ReaderTheme;
  preferredRecordingTarget?: 'youtube' | 'drive';
  interests?: string[];
  senderAddress?: string;
  savedSignatureUrl?: string;
  nextCheckNumber?: number;
  defaultRepoUrl?: string;
  defaultLanguage?: string; 
  availability?: UserAvailability;
  checkTemplate?: {
      bankName: string;
      routingNumber: string;
      accountNumber: string;
      senderAddress: string;
      senderName: string;
  };
  headline?: string;
  company?: string;
  resumeText?: string;
  resumeUrl?: string;
  linkedinUrl?: string;
  likedChannelIds?: string[];
  following?: string[];
  followers?: string[];
  certificate?: string;
  publicKey?: string;
}

export type AttachmentType = 'image' | 'video' | 'audio' | 'file';

export interface Attachment {
  id: string;
  type: AttachmentType;
  url: string;
  name?: string;
}

export interface Comment {
  id: string;
  userId: string;
  user: string;
  text: string;
  timestamp: number;
  attachments?: Attachment[];
}

export interface SubTopic {
  id: string;
  title: string;
}

export interface Chapter {
  id: string;
  title: string;
  subTopics: SubTopic[];
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
  createdAt: number;
  chapters?: Chapter[];
  welcomeMessage?: string;
  starterPrompts?: string[];
  appendix?: Attachment[];
  shares?: number;
}

export interface ChannelStats {
  likes: number;
  dislikes: number;
  shares: number;
}

export interface GeneratedLecture {
  topic: string;
  professorName: string;
  studentName: string;
  sections: { speaker: string; text: string }[];
  readingMaterial?: string;
  homework?: string;
}

export interface CommunityDiscussion {
  id: string;
  lectureId: string;
  channelId: string;
  userId: string;
  userName: string;
  transcript: TranscriptItem[];
  createdAt: number;
  updatedAt?: number;
  title: string;
  isManual?: boolean;
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
  mediaType?: string;
  transcriptUrl: string;
}

export interface Group {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  createdAt: number;
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

export interface CodeFile {
  name: string;
  path: string;
  language: 'javascript' | 'typescript' | 'javascript (react)' | 'typescript (react)' | 'python' | 'c++' | 'c' | 'java' | 'rust' | 'go' | 'c#' | 'html' | 'css' | 'json' | 'markdown' | 'plantuml' | 'whiteboard' | 'pdf' | 'text';
  content: string;
  loaded?: boolean;
  isDirectory?: boolean;
  isModified?: boolean;
  sha?: string;
  treeSha?: string;
  childrenFetched?: boolean;
}

export interface CodeProject {
  id: string;
  name: string;
  files: CodeFile[];
  lastModified: number;
  activeClientId?: string;
  activeFilePath?: string;
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
  fileName: string;
  line: number;
  column: number;
  color: string;
  updatedAt: number;
}

export interface CloudItem {
  name: string;
  fullPath: string;
  isFolder: boolean;
  size?: number;
  url?: string;
}

export type ToolType = 'pen' | 'eraser' | 'rect' | 'circle' | 'line' | 'arrow' | 'triangle' | 'star' | 'type' | 'move';
export type LineStyle = 'solid' | 'dashed' | 'dotted' | 'dash-dot' | 'long-dash';
export type BrushType = 'standard' | 'pencil' | 'marker' | 'airbrush' | 'calligraphy-pen' | 'writing-brush';

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
  startArrow?: boolean;
  endArrow?: boolean;
  text?: string;
  fontSize?: number;
}

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
  kernel: 'python' | 'javascript';
  tags: string[];
  createdAt: number;
  updatedAt: number;
  cells: NotebookCell[];
}

export interface AgentMemory {
  id?: string;
  ownerId?: string;
  recipientName: string;
  senderName: string;
  occasion: string;
  cardMessage: string;
  context?: string; 
  theme: string;
  customThemePrompt: string;
  userImages: string[];
  googlePhotosUrl: string;
  generatedAt: string;
  fontFamily?: string;
  fontSizeScale?: number;
  coverImageUrl?: string;
  backImageUrl?: string;
  voiceMessageUrl?: string;
  songLyrics?: string;
  songUrl?: string;
}

export interface GlobalStats {
  totalLogins: number;
  uniqueUsers: number;
}

export interface GeneratedIcon {
  id: string;
  prompt: string;
  style: string;
  url: string;
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
  recipientAddress?: string;
  signature?: string;
  signatureUrl?: string;
  watermarkUrl?: string;
  isCoinCheck?: boolean;
  coinAmount?: number;
  isClaimed?: boolean;
  ownerId?: string;
  drivePdfUrl?: string;
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
  service: 'standard' | 'express' | 'overnight';
  carrier: 'USPS' | 'FedEx' | 'UPS' | 'DHL';
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

export interface CoinTransaction {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
  type: 'transfer' | 'grant' | 'contribution' | 'check' | 'offline';
  memo?: string;
  timestamp: number;
  isVerified: boolean;
  offlineToken?: string;
}

export interface TodoItem {
  id: string;
  text: string;
  isCompleted: boolean;
  date: string;
  ownerId?: string;
}

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

export interface PendingClaim {
  tokenStr: string;
  timestamp: number;
  status: 'pending' | 'success' | 'failed';
  error?: string;
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
  type?: 'group' | 'session' | 'coin' | 'project';
  amount?: number;
  link?: string;
}

export interface Booking {
  id: string;
  userId: string;
  hostName: string;
  mentorId: string;
  mentorName: string;
  mentorImage?: string;
  date: string; // ISO Date String YYYY-MM-DD
  time: string; // Start Time HH:mm
  duration: 25 | 55;
  endTime: string; // HH:mm
  topic: string;
  invitedEmail?: string;
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled' | 'rejected';
  type: 'ai' | 'p2p';
  createdAt: number;
  coinPrice?: number;
  recordingUrl?: string | null;
  transcriptUrl?: string | null;
}

export type ViewState = 'directory' | 'podcast_detail' | 'live_session' | 'docs' | 'code_studio' | 'whiteboard' | 'blog' | 'chat' | 'careers' | 'calendar' | 'groups' | 'mentorship' | 'recordings' | 'check_designer' | 'check_viewer' | 'shipping_labels' | 'shipping_viewer' | 'icon_generator' | 'icon_viewer' | 'notebook_viewer' | 'card_workshop' | 'card_viewer' | 'mission' | 'firestore_debug' | 'coin_wallet' | 'mock_interview' | 'graph_studio';

export interface MockInterviewRecording {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  mode: 'coding' | 'system_design' | 'behavioral' | 'quick_screen' | 'assessment_30' | 'assessment_60';
  language?: string;
  jobDescription: string;
  timestamp: number;
  videoUrl: string; // Drive Link
  transcript?: TranscriptItem[];
  coachingTranscript?: TranscriptItem[]; // Persistent coaching history
  feedback?: string;
  visibility?: 'public' | 'private';
}