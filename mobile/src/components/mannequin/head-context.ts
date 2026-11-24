import { createContext } from 'react';
import type { HeadKind } from '@choudo/core/ui-logic/components/Mannequin/heads';

/** The head every Mannequin draws unless told otherwise; the root layout provides the stored choice. */
export const MascotHeadContext = createContext<HeadKind>('cloud');
