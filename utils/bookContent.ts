
import { NEURAL_PRISM_BOOK } from './bookContent/neural_prism';
import { MOCK_INTERVIEW_BOOK } from './bookContent/socratic_interrogator';
import { HEURISTIC_SIMULATION_BOOK } from './bookContent/heuristic_simulation';
import { SOVEREIGN_VAULT_MANUAL } from './bookContent/sovereign_vault';
import { LINUX_KERNEL_BOOK } from './bookContent/linux_kernel';
import { C_PROGRAMMING_BOOK } from './bookContent/c_programming';

// Added BookData, BookPage, BookCategory re-exports from types to resolve firestoreService errors
export type { BookPage, BookCategory, BookData } from '../types';

export const SYSTEM_BOOKS = [
    NEURAL_PRISM_BOOK, 
    MOCK_INTERVIEW_BOOK, 
    HEURISTIC_SIMULATION_BOOK, 
    SOVEREIGN_VAULT_MANUAL,
    LINUX_KERNEL_BOOK,
    C_PROGRAMMING_BOOK
];

export const ALL_BOOKS = SYSTEM_BOOKS;
