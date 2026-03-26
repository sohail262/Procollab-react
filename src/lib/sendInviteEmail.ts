/**
 * openInviteMailto
 *
 * Returns structured data so the UI can show a mail-client picker dialog.
 * The actual dialog is rendered in ManageTeam.tsx using shadcn Dialog.
 */

export interface InviteMailtoOptions {
    toEmail:      string
    inviterName:  string
    projectTitle: string
    projectId:    string
    role:         'member' | 'viewer'
    token:        string
}

export interface MailClientOption {
    id:      'gmail' | 'outlook' | 'yahoo' | 'default'
    label:   string
    url:     string
}

/**
 * Builds the mailto/webmail URLs for all supported clients.
 * Returns the array — the UI decides which one to open.
 */
export function buildInviteMailOptions(
    opts: InviteMailtoOptions
): MailClientOption[] {
    const { toEmail, inviterName, projectTitle, role, token } = opts

    const inviteUrl  = `${window.location.origin}/invite?token=${token}`
    const roleLabel  = role === 'viewer' ? 'Viewer (read-only)' : 'Team Member'

    const roleDescription =
        role === 'viewer'
            ? `As a Viewer, you will be able to see the project dashboard and project details.`
            : `As a Team Member, you will be able to collaborate on tasks, files, chat, and more once the project lead configures your permissions.`

    const subject = `${inviterName} invited you to join "${projectTitle}" on ProCollab`

    const bodyPlain =
`Hi there,

${inviterName} has invited you to join the project "${projectTitle}" on ProCollab as a ${roleLabel}.

${roleDescription}

Click the link below to accept your invitation:
${inviteUrl}

This invitation link expires in 72 hours.

---
If you don't have a ProCollab account yet, you'll be prompted to create one when you open the link.

If you weren't expecting this invitation you can safely ignore this email.

– The ProCollab Team
${window.location.origin}`

    const encodedSubject = encodeURIComponent(subject)
    const encodedBody    = encodeURIComponent(bodyPlain)
    const encodedTo      = encodeURIComponent(toEmail)

    return [
        {
            id:    'gmail',
            label: 'Gmail',
            // Gmail compose URL — works in any browser, opens gmail.com
            url: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodedTo}&su=${encodedSubject}&body=${encodedBody}`,
        },
        {
            id:    'outlook',
            label: 'Outlook Web',
            // Outlook Web App compose URL
            url: `https://outlook.live.com/mail/0/deeplink/compose?to=${encodedTo}&subject=${encodedSubject}&body=${encodedBody}`,
        },
        {
            id:    'yahoo',
            label: 'Yahoo Mail',
            url: `https://compose.mail.yahoo.com/?to=${encodedTo}&subj=${encodedSubject}&body=${encodedBody}`,
        },
        {
            id:    'default',
            label: 'Default Mail App',
            // Traditional mailto — opens Outlook desktop, Apple Mail, Thunderbird etc.
            url: `mailto:${toEmail}?subject=${encodedSubject}&body=${encodedBody}`,
        },
    ]
}

/**
 * Opens a specific mail client URL.
 * Gmail / Outlook / Yahoo open in a new tab.
 * Default mail app uses window.location.href.
 */
export function openMailClient(option: MailClientOption): void {
    if (option.id === 'default') {
        window.location.href = option.url
    } else {
        window.open(option.url, '_blank', 'noopener,noreferrer')
    }
}