
import { Chapter, GeneratedLecture } from '../types';
import { STARTUP_CONTENT } from './content/startup';
import { LINUX_CONTENT } from './content/linux';
import { HARDWARE_CONTENT } from './content/hardware';
import { SOFTWARE_CONTENT } from './content/software';
import { CULTURE_CONTENT } from './content/culture';
import { BST_CONTENT } from './content/bst';
import { LIFESTYLE_CONTENT } from './content/lifestyle';
import { SYSTEM_CONTENT } from './content/system';
import { JUDGE_DEEP_DIVE_CONTENT } from './content/judge_deep_dive';
import { HACKATHON_PITCH_CONTENT } from './content/hackathon_pitch';
import { MOCK_INTERVIEW_DEEP_DIVE_CONTENT } from './content/mock_interview_deep_dive';
import { TECHNICAL_AUDIT_CONTENT } from './bookContent/technical_audit';

export interface SpotlightChannelData {
  curriculum: Chapter[];
  lectures: Record<string, GeneratedLecture>;
}

// Merge all static content dictionaries into the sovereign lookup map
export const SPOTLIGHT_DATA: Record<string, SpotlightChannelData> = {
  ...STARTUP_CONTENT,
  ...LINUX_CONTENT,
  ...HARDWARE_CONTENT,
  ...SOFTWARE_CONTENT,
  ...CULTURE_CONTENT,
  ...BST_CONTENT,
  ...LIFESTYLE_CONTENT,
  ...SYSTEM_CONTENT,
  ...JUDGE_DEEP_DIVE_CONTENT,
  ...HACKATHON_PITCH_CONTENT,
  ...MOCK_INTERVIEW_DEEP_DIVE_CONTENT,
  ...TECHNICAL_AUDIT_CONTENT
};
