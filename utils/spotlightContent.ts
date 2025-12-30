
import { Chapter, GeneratedLecture } from '../types';
import { STARTUP_CONTENT } from './content/startup';
import { LINUX_CONTENT } from './content/linux';
import { HARDWARE_CONTENT } from './content/hardware';
import { SOFTWARE_CONTENT } from './content/software';
import { CULTURE_CONTENT } from './content/culture';
import { BST_CONTENT } from './content/bst';
import { LIFESTYLE_CONTENT } from './content/lifestyle';

export interface SpotlightChannelData {
  curriculum: Chapter[];
  lectures: Record<string, GeneratedLecture>;
}

// Merge all content dictionaries
export const SPOTLIGHT_DATA: Record<string, SpotlightChannelData> = {
  ...STARTUP_CONTENT,
  ...LINUX_CONTENT,
  ...HARDWARE_CONTENT,
  ...SOFTWARE_CONTENT,
  ...CULTURE_CONTENT,
  ...BST_CONTENT,
  ...LIFESTYLE_CONTENT
};