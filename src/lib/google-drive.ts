/**
 * Google Drive & Docs API helpers — Procollab
 *
 * All calls go directly to the Google REST APIs using the
 * access_token obtained via @react-oauth/google OAuth flow.
 *
 * Scopes used: https://www.googleapis.com/auth/drive.file
 *   → Only files created BY this app are visible/editable.
 *   → User's existing Drive files are never exposed.
 */

const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'

export type DocType = 'document' | 'spreadsheet' | 'presentation'

export interface DriveFile {
    id:           string
    name:         string
    mimeType:     string
    webViewLink:  string
    createdTime:  string
    modifiedTime: string
    iconLink?:    string
}

// ── MIME types ─────────────────────────────────────────────────────────────────
export const MIME: Record<DocType, string> = {
    document:     'application/vnd.google-apps.document',
    spreadsheet:  'application/vnd.google-apps.spreadsheet',
    presentation: 'application/vnd.google-apps.presentation',
}

function authHeaders(token: string) {
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    }
}

async function driveRequest(url: string, token: string, options?: RequestInit) {
    const res = await fetch(url, {
        ...options,
        headers: {
            ...authHeaders(token),
            ...(options?.headers ?? {}),
        },
    })
    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? `Drive API error ${res.status}`)
    }
    return res.json()
}

// ─── Create project folder ─────────────────────────────────────────────────────
export async function createProjectFolder(
    token: string,
    projectName: string
): Promise<{ id: string; webViewLink: string }> {
    const body = {
        name:     `Procollab – ${projectName}`,
        mimeType: 'application/vnd.google-apps.folder',
    }
    const data = await driveRequest(
        `${DRIVE_API}/files?fields=id,webViewLink`,
        token,
        { method: 'POST', body: JSON.stringify(body) }
    )
    return { id: data.id, webViewLink: data.webViewLink ?? '' }
}

// ─── List files in a folder ────────────────────────────────────────────────────
export async function listFilesInFolder(
    token: string,
    folderId: string
): Promise<DriveFile[]> {
    const q = encodeURIComponent(
        `'${folderId}' in parents and trashed = false`
    )
    const fields = 'files(id,name,mimeType,webViewLink,createdTime,modifiedTime,iconLink)'
    const data = await driveRequest(
        `${DRIVE_API}/files?q=${q}&fields=${fields}&orderBy=modifiedTime desc`,
        token
    )
    return data.files ?? []
}

// ─── Create a Google Doc/Sheet/Slide in folder ─────────────────────────────────
export async function createFileInFolder(
    token:    string,
    folderId: string,
    title:    string,
    type:     DocType
): Promise<DriveFile> {
    const body = {
        name:     title,
        mimeType: MIME[type],
        parents:  [folderId],
    }
    const data = await driveRequest(
        `${DRIVE_API}/files?fields=id,name,mimeType,webViewLink,createdTime,modifiedTime`,
        token,
        { method: 'POST', body: JSON.stringify(body) }
    )
    return data as DriveFile
}

// ─── Rename a file ─────────────────────────────────────────────────────────────
export async function renameFile(
    token:   string,
    fileId:  string,
    newName: string
): Promise<void> {
    await driveRequest(
        `${DRIVE_API}/files/${fileId}?fields=id`,
        token,
        { method: 'PATCH', body: JSON.stringify({ name: newName }) }
    )
}

// ─── Delete a file ─────────────────────────────────────────────────────────────
export async function deleteFile(token: string, fileId: string): Promise<void> {
    const res = await fetch(`${DRIVE_API}/files/${fileId}`, {
        method:  'DELETE',
        headers: authHeaders(token),
    })
    if (!res.ok && res.status !== 204) {
        throw new Error(`Failed to delete file: ${res.status}`)
    }
}

// ─── Get Google Docs embed URL ─────────────────────────────────────────────────
export function getEmbedUrl(fileId: string, mimeType: string): string {
    if (mimeType === MIME.document) {
        return `https://docs.google.com/document/d/${fileId}/edit?embedded=true`
    }
    if (mimeType === MIME.spreadsheet) {
        return `https://docs.google.com/spreadsheets/d/${fileId}/edit?embedded=true`
    }
    if (mimeType === MIME.presentation) {
        return `https://docs.google.com/presentation/d/${fileId}/edit?embedded=true`
    }
    return `https://drive.google.com/file/d/${fileId}/view`
}

// ─── Human-readable MIME labels ───────────────────────────────────────────────
export function mimeLabel(mimeType: string): string {
    if (mimeType === MIME.document)     return 'Google Doc'
    if (mimeType === MIME.spreadsheet)  return 'Google Sheet'
    if (mimeType === MIME.presentation) return 'Google Slides'
    return 'File'
}
