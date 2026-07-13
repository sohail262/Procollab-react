// Content Moderation Service for Procollab React
// Provides functions to detect fake projects, inappropriate content, and vague projects

// Suspicious keywords for inappropriate content
const SUSPICIOUS_KEYWORDS = [
    // Anti-national terms
    'terrorism', 'terrorist', 'extremist', 'insurgent', 'separatist',
    'anti-national', 'sedition', 'treason', 'overthrow government',

    // Inappropriate content
    'violence', 'hate speech', 'discrimination', 'harassment',
    'illegal', 'scam', 'fraud', 'phishing', 'malware',

    // Adult content
    'pornography', 'adult content', 'sexual', 'nudity',

    // Weapons/explosives
    'bomb', 'weapon', 'explosive', 'gun', 'firearm',

    // Drugs
    'drug', 'narcotic', 'cocaine', 'heroin', 'marijuana'
]

// Fake project detection rules
const FAKE_PROJECT_INDICATORS = {
    // Placeholder/generic content
    placeholders: ['lorem ipsum', 'placeholder', 'tbd', 'to be determined', 'coming soon', 'n/a', 'na', 'xxx', '???', 'test', 'testing'],

    // Unrealistic requirements
    unrealistic: ['free work', 'no budget', 'exposure', 'for portfolio', 'unpaid', 'volunteer only', 'equity only'],

    // Suspicious patterns
    suspicious: ['urgent', 'asap', 'immediate', 'quick money', 'easy money', 'guaranteed', 'no experience needed'],

    // Spam indicators
    spam: ['click here', 'buy now', 'limited time', 'act now', 'don\'t miss', 'call now', 'email now'],

    // Incomplete/minimal info
    minimal: ['...', '----', '====', '****', '....']
}

// Vague project indicators
const VAGUE_INDICATORS = [
    'just for fun', 'something cool', 'random project', 'idk',
    'just messing around', 'nothing serious', 'just testing',
    'dummy project', 'fake project', 'test project', 'asdf', 'qwerty',
    'aaa', 'bbb', 'ccc', 'abc', '123', 'sample', 'example'
]

export interface ModerationFlag {
    type: string
    matches?: string[]
    message?: string
    severity: 'high' | 'medium' | 'low'
}

export interface ModerationAnalysis {
    flags: ModerationFlag[]
    riskScore: number
    isSuspicious: boolean
    requiresReview: boolean
    isAutoApproved: boolean
}

export interface ProjectData {
    title?: string
    summary?: string
    description?: string
    goals?: string[]
    tags?: string[]
    additionalNotes?: string
    disciplines?: string[]
    primaryDiscipline?: string
    teamSize?: number
    duration?: number | string
    durationUnit?: string
    requiredSkills?: string[]
    openRoles?: string[]
}

/**
 * Analyze project content for inappropriate, suspicious, or vague content
 * @param projectData - The project data to analyze
 * @returns Analysis results with flags and scores
 */
export function analyzeProjectContent(projectData: ProjectData): ModerationAnalysis {
    const analysis: ModerationAnalysis = {
        flags: [],
        riskScore: 0,
        isSuspicious: false,
        requiresReview: false,
        isAutoApproved: true
    }

    // Combine all text fields for analysis
    const allText = [
        projectData.title,
        projectData.description,
        ...(projectData.goals || []),
        ...(projectData.tags || []),
        ...(projectData.requiredSkills || []),
        ...(projectData.openRoles || []),
        projectData.additionalNotes
    ].filter(text => text).join(' ').toLowerCase()

    // 1. Check for suspicious/inappropriate keywords (HIGH SEVERITY)
    const suspiciousMatches = SUSPICIOUS_KEYWORDS.filter(keyword =>
        allText.includes(keyword.toLowerCase())
    )

    if (suspiciousMatches.length > 0) {
        analysis.flags.push({
            type: 'suspicious_content',
            matches: suspiciousMatches,
            message: 'Project contains potentially inappropriate content',
            severity: 'high'
        })
        analysis.riskScore += suspiciousMatches.length * 15
    }

    // 2. Check for vague project indicators (MEDIUM SEVERITY)
    const vagueMatches = VAGUE_INDICATORS.filter(indicator =>
        allText.includes(indicator.toLowerCase())
    )

    if (vagueMatches.length > 0) {
        analysis.flags.push({
            type: 'vague_content',
            matches: vagueMatches,
            message: 'Project appears to be vague or not serious',
            severity: 'medium'
        })
        analysis.riskScore += vagueMatches.length * 8
    }

    // 3. Check for placeholder content (HIGH SEVERITY)
    const placeholderMatches = FAKE_PROJECT_INDICATORS.placeholders.filter(placeholder =>
        allText.includes(placeholder.toLowerCase())
    )

    if (placeholderMatches.length > 0) {
        analysis.flags.push({
            type: 'placeholder_content',
            matches: placeholderMatches,
            message: 'Project contains placeholder or incomplete content',
            severity: 'high'
        })
        analysis.riskScore += placeholderMatches.length * 12
    }

    // 4. Check for unrealistic requirements (HIGH SEVERITY)
    const unrealisticMatches = FAKE_PROJECT_INDICATORS.unrealistic.filter(indicator =>
        allText.includes(indicator.toLowerCase())
    )

    if (unrealisticMatches.length > 0) {
        analysis.flags.push({
            type: 'unrealistic_requirements',
            matches: unrealisticMatches,
            message: 'Project has unrealistic or exploitative requirements',
            severity: 'high'
        })
        analysis.riskScore += unrealisticMatches.length * 10
    }

    // 5. Check for spam indicators (MEDIUM SEVERITY)
    const spamMatches = FAKE_PROJECT_INDICATORS.spam.filter(indicator =>
        allText.includes(indicator.toLowerCase())
    )

    if (spamMatches.length > 0) {
        analysis.flags.push({
            type: 'spam_indicators',
            matches: spamMatches,
            message: 'Project contains spam-like language',
            severity: 'medium'
        })
        analysis.riskScore += spamMatches.length * 8
    }

    // 6. Check for minimal content (REMOVED: character limits are now removed)
    // No minimum length warnings are applied anymore.

    // 7. Check for missing required fields (MEDIUM SEVERITY)
    const missingFields: string[] = []
    if (!projectData.title || !projectData.title.trim()) missingFields.push('title')
    if (!projectData.description || !projectData.description.trim()) missingFields.push('description')
    if (!projectData.primaryDiscipline && (!projectData.disciplines || projectData.disciplines.length === 0)) {
        missingFields.push('discipline')
    }

    if (missingFields.length > 0) {
        analysis.flags.push({
            type: 'incomplete_project',
            matches: missingFields,
            message: `Missing or insufficient fields: ${missingFields.join(', ')}`,
            severity: 'medium'
        })
        analysis.riskScore += missingFields.length * 6
    }

    // 8. Check for excessive use of caps (LOW SEVERITY)
    const capsCount = (allText.match(/[A-Z]/g) || []).length
    const capsRatio = capsCount / Math.max(allText.length, 1)
    if (capsRatio > 0.5 && allText.length > 20) {
        analysis.flags.push({
            type: 'excessive_caps',
            message: 'Excessive use of capital letters',
            severity: 'low'
        })
        analysis.riskScore += 5
    }

    // 9. Check for suspicious team size (LOW SEVERITY)
    if (projectData.teamSize !== undefined) {
        if (projectData.teamSize < 1 || projectData.teamSize > 100) {
            analysis.flags.push({
                type: 'suspicious_team_size',
                message: `Suspicious team size: ${projectData.teamSize}`,
                severity: 'low'
            })
            analysis.riskScore += 5
        }
    }

    // 10. Check for repetitive characters (MEDIUM SEVERITY)
    const repetitivePattern = /(.)\1{4,}/g
    if (repetitivePattern.test(allText)) {
        analysis.flags.push({
            type: 'repetitive_content',
            message: 'Content contains repetitive characters',
            severity: 'medium'
        })
        analysis.riskScore += 10
    }

    // 11. Check for gibberish/random text (MEDIUM SEVERITY)
    const words = allText.split(/\s+/).filter(w => w.length > 2)
    const shortRandomWords = words.filter(w => w.length <= 3 && /^[a-z]+$/.test(w))
    if (shortRandomWords.length > words.length * 0.5 && words.length > 5) {
        analysis.flags.push({
            type: 'gibberish_content',
            message: 'Content appears to be random or nonsensical',
            severity: 'medium'
        })
        analysis.riskScore += 15
    }

    // Determine moderation status based on risk score
    // 0-25: Auto-approved
    // 26-50: Warning shown but allowed
    // 51+: Requires manual review
    analysis.isSuspicious = analysis.riskScore > 25
    analysis.requiresReview = analysis.riskScore > 50
    analysis.isAutoApproved = analysis.riskScore <= 50

    return analysis
}

/**
 * Get a user-friendly message for a moderation flag
 */
export function getFlagMessage(flag: ModerationFlag): string {
    switch (flag.type) {
        case 'suspicious_content':
            return '⚠️ Your project contains content that may violate our community guidelines.'
        case 'vague_content':
            return '📝 Your project description seems vague. Please provide more details.'
        case 'placeholder_content':
            return '📄 Please replace placeholder text with actual project information.'
        case 'unrealistic_requirements':
            return '💼 Please ensure your project requirements are fair and realistic.'
        case 'spam_indicators':
            return '🚫 Your project contains language that looks like spam.'
        case 'minimal_content':
            return '📋 Please provide more details about your project.'
        case 'incomplete_project':
            return `✏️ Please complete these fields: ${flag.matches?.join(', ')}`
        case 'excessive_caps':
            return '🔤 Please avoid using excessive capital letters.'
        case 'repetitive_content':
            return '🔄 Please remove repetitive characters from your content.'
        case 'gibberish_content':
            return '❓ Your content appears to contain random or nonsensical text.'
        default:
            return flag.message || 'Please review your project content.'
    }
}

/**
 * Check if content passes moderation (can be published immediately)
 */
export function canPublishImmediately(analysis: ModerationAnalysis): boolean {
    return analysis.isAutoApproved && !analysis.requiresReview
}

/**
 * Get overall moderation status
 */
export function getModerationStatus(analysis: ModerationAnalysis): 'approved' | 'warning' | 'review' | 'rejected' {
    if (analysis.riskScore <= 25) return 'approved'
    if (analysis.riskScore <= 50) return 'warning'
    if (analysis.riskScore <= 75) return 'review'
    return 'rejected'
}

/**
 * Get the highest severity flag
 */
export function getHighestSeverity(analysis: ModerationAnalysis): 'high' | 'medium' | 'low' | null {
    if (analysis.flags.some(f => f.severity === 'high')) return 'high'
    if (analysis.flags.some(f => f.severity === 'medium')) return 'medium'
    if (analysis.flags.some(f => f.severity === 'low')) return 'low'
    return null
}
