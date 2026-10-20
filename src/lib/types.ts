/**
 * The shapes the Site API answers with. Browser-safe (no server code): pages,
 * the portal and `src/server/` all import them from here.
 */

export type {Site, Viewer, ViewerState} from '../platform/types';

export interface Member {
  id: number;
  slug: string;
  name: string;
  avatar: string | null;
  role: string | null;
}

export interface UploadRow {
  id: number;
  url: string;
  originalName: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
}

/** What the visitor may do on THIS site. */
export interface Abilities {
  [key: string]: boolean | undefined;
}
