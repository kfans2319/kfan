import { createContext } from 'react';
import { PostData } from './types';

export const PostContext = createContext<PostData | null>(null);
