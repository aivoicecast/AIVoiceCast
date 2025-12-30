
export interface Invitation {
  id: string;
  fromUserId: string;
  fromName: string;
  toEmail: string;
  groupId: string;
  groupName: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
  type?: 'group' | 'session';
  link?: string;
}

export interface Booking {
  id: string;
  userId: string;
  hostName?: string;
  mentorId: string;
  mentorName: string;
  mentorImage: string;
  date: string;
  time: string;
  topic: string;
  invitedEmail?: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'pending' | 'rejected';
  type?: 'ai' | 'p2p';
  createdAt: number;
  recordingUrl?: string;
  transcriptUrl?: string;
}

export type AttachmentType = 'image' | 'audio' | 'video' | 'file';

export interface Attachment {
  id: string;
  type: AttachmentType;
  url: string;
  name?: string;
  uploadedAt?: number;
}

export interface Comment {
  id: string;
  userId?: string;
  user: string;
  text: string;
  timestamp: number;
  attachments?: Attachment[];
}

export interface TranscriptItem {
  /* Changed role to string to support robust mapping of AI voices and technical IDs in LiveSession.tsx */
  role: string;
  text: string;
  timestamp: number;
}

export interface SubTopic {
  id: string;
  title: string;
  isCompleted?: boolean;
}

export interface Chapter {
  id: string;
  title: string;
  subTopics: SubTopic[];
}

export type ChannelVisibility = 'private' | 'public' | 'group';

export interface ChannelStats {
  likes: number;
  dislikes: number;
  shares: number;
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
  shares?: number;
  comments: Comment[];
  tags: string[];
  imageUrl: string;
  welcomeMessage?: string;
  starterPrompts?: string[];
  chapters?: Chapter[];
  appendix?: Attachment[];
  createdAt?: number;
  bookUrl?: string;
  bookGeneratedAt?: number;
}

export interface LectureSection {
  speaker: string;
  text: string;
  discussionId?: string;
}

export interface GeneratedLecture {
  topic: string;
  professorName: string;
  studentName: string;
  sections: LectureSection[];
}

export interface CommunityDiscussion {
  id: string;
  lectureId: string;
  channelId: string;
  userId: string;
  userName: string;
  transcript: TranscriptItem[];
  summary?: string;
  designDoc?: string;
  createdAt: number;
  segmentIndex?: number;
  updatedAt?: number;
  title?: string;
  isManual?: boolean;
  visibility?: ChannelVisibility;
  groupIds?: string[];
}

export type ViewState = 
  | 'directory' 
  | 'podcast_detail' 
  | 'live_session' 
  | 'create_channel' 
  | 'debug' 
  | 'cloud_debug' 
  | 'public_debug' 
  | 'mission' 
  | 'code_studio' 
  | 'whiteboard' 
  | 'blog' 
  | 'chat' 
  | 'careers' 
  | 'user_guide' 
  | 'notebook_viewer' 
  | 'card_workshop' 
  | 'card_explorer' 
  | 'card_viewer'
  | 'icon_generator';

export interface AudioState {
  isConnected: boolean;
  isTalking: boolean;
  volume: number;
}

export interface Group {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  createdAt: number;
}

export type SubscriptionTier = 'free' | 'pro';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  groups: string[];
  interests?: string[];
  apiUsageCount?: number;
  createdAt?: number;
  lastLogin?: any;
  subscriptionTier?: SubscriptionTier;
  subscriptionStatus?: 'active' | 'past_due' | 'canceled';
  defaultRepoUrl?: string;
  followers?: string[];
  following?: string[];
  likedChannelIds?: string[];
  preferredAiProvider?: 'gemini' | 'openai';
  preferredMobileQuickApp?: string;
}

export interface RecordingSession {
  id: string;
  userId: string;
  channelId: string;
  channelTitle: string;
  channelImage: string;
  timestamp: number;
  mediaUrl: string;
  mediaType: string;
  transcriptUrl: string;
}

export interface TodoItem {
  id: string;
  text: string;
  isCompleted: boolean;
  date: string;
}

export interface CodeFile {
  name: string;
  language: 'python' | 'javascript' | 'typescript' | 'html' | 'css' | 'java' | 'c++' | 'c' | 'rust' | 'go' | 'c#' | 'json' | 'markdown' | 'text' | 'typescript (react)' | 'javascript (react)' | 'plantuml' | 'whiteboard';
  content: string;
  sha?: string;
  path?: string;
  loaded?: boolean;
  isDirectory?: boolean;
  treeSha?: string;
  childrenFetched?: boolean;
  isModified?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'ai' | 'system';
  text: string;
}

export interface GithubMetadata {
  owner: string;
  repo: string;
  branch: string;
  sha: string;
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

export interface CodeProject {
  id: string;
  name: string;
  files: CodeFile[];
  lastModified: number;
  ownerId?: string;
  github?: GithubMetadata;
  review?: string;
  humanComments?: string;
  interviewFeedback?: string;
  chatHistory?: ChatMessage[];
  cursors?: Record<string, CursorPosition>;
  activeClientId?: string;
  activeWriterName?: string;
  activeFilePath?: string;
  editRequest?: {
    clientId: string;
    userName: string;
    timestamp: number;
  };
  accessLevel?: 'public' | 'restricted';
  allowedUserIds?: string[];
}

export interface Blog {
  id: string;
  ownerId: string;
  authorName: string;
  title: string;
  description: string;
  createdAt: number;
  likes?: number;
}

export interface BlogPost {
  id: string;
  blogId: string;
  authorId: string;
  authorName: string;
  authorImage?: string;
  title: string;
  content: string;
  excerpt: string;
  tags: string[];
  status: 'draft' | 'published';
  publishedAt?: number;
  createdAt: number;
  likes: number;
  imageUrl?: string;
  comments?: Comment[];
  commentCount?: number;
}

export interface ChatChannel {
  id: string;
  name: string;
  type: 'public' | 'group' | 'dm';
  groupId?: string;
  memberIds?: string[];
  lastMessage?: {
    text: string;
    senderName: string;
    timestamp: number;
  };
  createdAt: number;
}

export interface RealTimeMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderImage?: string;
  timestamp: any;
  replyTo?: {
    id: string;
    text: string;
    senderName: string;
  };
}

export interface CareerApplication {
  id?: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhotoURL?: string;
  role: 'mentor' | 'expert' | 'contributor';
  expertise: string[];
  bio: string;
  resumeUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
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

export type ToolType = 'select' | 'pen' | 'eraser' | 'rect' | 'circle' | 'line' | 'arrow' | 'text' | 'pan' | 'triangle' | 'star' | 'curve';
export type LineStyle = 'solid' | 'dashed' | 'dotted' | 'dash-dot' | 'long-dash';
export type BrushType = 'standard' | 'pencil' | 'marker' | 'calligraphy-pen' | 'writing-brush' | 'airbrush' | 'oil' | 'watercolor' | 'crayon';

export interface WhiteboardElement {
  id: string;
  type: ToolType;
  points?: { x: number; y: number }[];
  x: number;
  y: number;
  width?: number;
  height?: number;
  endX?: number;
  endY?: number;
  text?: string;
  color: string;
  strokeWidth: number;
  lineStyle?: LineStyle;
  brushType?: BrushType;
  fontSize?: number;
  fontFamily?: string;
  borderRadius?: number;
  rotation?: number;
  startArrow?: boolean;
  endArrow?: boolean;
}

export interface CloudItem {
  name: string;
  fullPath: string;
  url?: string;
  isFolder: boolean;
  size?: number;
  timeCreated?: string;
  contentType?: string;
}

export interface GlobalStats {
  totalLogins: number;
  uniqueUsers: number;
}

export interface GlobalStats {
  totalLogins: number;
  uniqueUsers: number;
}

export interface NotebookCell {
  id: string;
  type: 'markdown' | 'code';
  content: string;
  language?: 'python' | 'javascript' | 'sql' | 'json';
  output?: string;
  isExecuting?: boolean;
}

export interface Notebook {
  id: string;
  title: string;
  author: string;
  description: string;
  kernel: 'python' | 'javascript';
  cells: NotebookCell[];
  createdAt: number;
  updatedAt: number;
  tags: string[];
}

export interface AgentMemory {
  id?: string;        
  ownerId?: string;   
  recipientName: string;
  senderName: string;
  occasion: string;
  cardMessage: string;
  theme: 'festive' | 'cozy' | 'minimal' | 'thanks' | 'chinese-poem';
  customThemePrompt?: string;
  userImages: string[];
  coverImageUrl?: string;
  backImageUrl?: string;
  googlePhotosUrl?: string;
  generatedAt: string;
  voiceMessageUrl?: string; 
  songUrl?: string;         
  songLyrics?: string;
  fontFamily?: string;
  fontSizeScale?: number;
}
