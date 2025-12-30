
import { BlogPost } from '../types';

export const INSTANT_AUTHOR_BLOG_POST: BlogPost = {
  id: 'instant-author-v1',
  blogId: 'system-blog',
  authorId: 'system',
  authorName: 'AIVoiceCast Product Team',
  authorImage: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=200&q=80',
  title: '📚 The Instant Author: Writing Books in Minutes with AI',
  excerpt: 'Learn how AIVoiceCast members are using Gemini to synthesize complex topics into full-length technical books.',
  status: 'published',
  publishedAt: 1766020000000,
  createdAt: 1766020000000,
  likes: 2150,
  commentCount: 0,
  tags: ['Publishing', 'AI', 'Gemini', 'Productivity'],
  content: `
# 📚 The Instant Author: Writing Books in Minutes with AI

Writing a technical book used to take months. At AIVoiceCast, we've reduced that to a single click.

### The Curriculum-First Approach
Most technical books are just well-structured curriculums. By using our **Magic Creator**, a member can define a topic and get a 10-chapter syllabus instantly. 

### Neural Synthesis
Our "Download Full Book" feature doesn't just export what you've already read. It triggers an **Active Synthesis** loop:
1. **Context Mapping**: Gemini analyzes the entire channel description.
2. **Drafting**: Every sub-topic is expanded into a 500-word Socratic dialogue.
3. **Typesetting**: The platform renders these dialogues with professional typography.
4. **Binding**: A PDF is generated with a generated cover and table of contents.

### Why this matters
Knowledge moves too fast for traditional publishing. AIVoiceCast allows you to capture the current state of a library, a kernel version, or a framework and turn it into a portable, readable guide—instantly.

*Start your first book today.*
`
};

export const ARCHITECTURE_BLOG_POST: BlogPost = {
  id: 'arch-deep-dive-v1',
  blogId: 'system-blog',
  authorId: 'system',
  authorName: 'AIVoiceCast Engineering',
  authorImage: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=200&q=80',
  title: '🛠️ Under the Hood: The Architecture of AIVoiceCast',
  excerpt: 'A technical deep dive into our React 19 and Gemini AI integration.',
  status: 'published',
  publishedAt: 1766016000000, 
  createdAt: 1766016000000,
  likes: 1024,
  commentCount: 0,
  tags: ['Engineering', 'Architecture', 'Firebase', 'Optimization'],
  content: `
# 🛠️ Under the Hood: The Architecture of AIVoiceCast

This post details our v3.85 stack.

## Internal Implementation
### Frontend: React 19
We use **React 19** for concurrent rendering.

### AI Engine: Gemini API
* **Logic**: \`gemini-3-pro-preview\` for reasoning.
* **Audio**: \`gemini-2.5-flash-preview-tts\` for neural voices.
`
};

export const SYSTEM_BLOG_POSTS = [INSTANT_AUTHOR_BLOG_POST, ARCHITECTURE_BLOG_POST];
