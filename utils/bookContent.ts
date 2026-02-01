
import { NEURAL_PRISM_BOOK } from './bookContent/neural_prism';
import { MOCK_INTERVIEW_BOOK } from './bookContent/socratic_interrogator';
import { HEURISTIC_SIMULATION_BOOK } from './bookContent/heuristic_simulation';
import { SOVEREIGN_VAULT_MANUAL } from './bookContent/sovereign_vault';
import { LINUX_KERNEL_BOOK } from './bookContent/linux_kernel';

export interface BookPage {
  title: string;
  content: string;
}

export type BookCategory = 'Platform' | 'Methodology' | 'Evaluation' | 'Architecture' | 'Daily';

export interface BookData {
  id: string;
  title: string;
  subtitle: string;
  author: string;
  version: string;
  category: BookCategory;
  pages: BookPage[];
  coverImage?: string;
  ownerId?: string;
  isCustom?: boolean;
}

export const SYSTEM_BOOKS = [
    NEURAL_PRISM_BOOK, 
    MOCK_INTERVIEW_BOOK, 
    HEURISTIC_SIMULATION_BOOK, 
    SOVEREIGN_VAULT_MANUAL,
    LINUX_KERNEL_BOOK
];

export const ALL_BOOKS = SYSTEM_BOOKS;
