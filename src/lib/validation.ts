import DOMPurify from 'dompurify';

// Input validation schemas
export interface ValidationRule {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    custom?: (value: any) => string | null;
}

export interface ValidationSchema {
    [key: string]: ValidationRule;
}

export interface ValidationResult {
    isValid: boolean;
    errors: Record<string, string>;
    sanitizedData: Record<string, any>;
}

/**
 * Sanitize HTML content to prevent XSS
 */
export function sanitizeHtml(html: string): string {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
        ALLOW_DATA_ATTR: false,
        ALLOW_UNKNOWN_PROTOCOLS: false
    });
}

/**
 * Sanitize plain text input
 */
export function sanitizeText(text: string): string {
    if (typeof text !== 'string') return '';
    
    return text
        .trim()
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
        .replace(/\s+/g, ' ') // Normalize whitespace
        .substring(0, 10000); // Limit length to prevent DoS
}

/**
 * Sanitize email input
 */
export function sanitizeEmail(email: string): string {
    if (typeof email !== 'string') return '';
    return email.toLowerCase().trim().substring(0, 254);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }
    
    if (password.length > 128) {
        errors.push('Password must be less than 128 characters');
    }
    
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }
    
    // Check for common patterns
    const commonPatterns = [
        /(.)\1{2,}/, // Repeated characters
        /123456|654321|qwerty|password|admin/i, // Common sequences
    ];
    
    for (const pattern of commonPatterns) {
        if (pattern.test(password)) {
            errors.push('Password contains common patterns and is not secure');
            break;
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validate and sanitize form data
 */
export function validateFormData(data: Record<string, any>, schema: ValidationSchema): ValidationResult {
    const errors: Record<string, string> = {};
    const sanitizedData: Record<string, any> = {};
    
    // Validate each field according to schema
    for (const [field, rule] of Object.entries(schema)) {
        const value = data[field];
        
        // Check required fields
        if (rule.required && (value === undefined || value === null || value === '')) {
            errors[field] = `${field} is required`;
            continue;
        }
        
        // Skip validation for optional empty fields
        if (!rule.required && (value === undefined || value === null || value === '')) {
            sanitizedData[field] = value;
            continue;
        }
        
        // Convert to string for validation
        const stringValue = String(value);
        
        // Length validation
        if (rule.minLength && stringValue.length < rule.minLength) {
            errors[field] = `${field} must be at least ${rule.minLength} characters`;
            continue;
        }
        
        if (rule.maxLength && stringValue.length > rule.maxLength) {
            errors[field] = `${field} must be no more than ${rule.maxLength} characters`;
            continue;
        }
        
        // Pattern validation
        if (rule.pattern && !rule.pattern.test(stringValue)) {
            errors[field] = `${field} format is invalid`;
            continue;
        }
        
        // Custom validation
        if (rule.custom) {
            const customError = rule.custom(value);
            if (customError) {
                errors[field] = customError;
                continue;
            }
        }
        
        // Sanitize based on field type
        if (field.toLowerCase().includes('email')) {
            sanitizedData[field] = sanitizeEmail(stringValue);
        } else if (field.toLowerCase().includes('html') || field.toLowerCase().includes('description')) {
            sanitizedData[field] = sanitizeHtml(stringValue);
        } else {
            sanitizedData[field] = sanitizeText(stringValue);
        }
    }
    
    return {
        isValid: Object.keys(errors).length === 0,
        errors,
        sanitizedData
    };
}

/**
 * Project creation validation schema
 */
export const projectValidationSchema: ValidationSchema = {
    title: {
        required: true,
        pattern: /^[a-zA-Z0-9\s\-_.,!?()]+$/,
        custom: (value) => {
            const suspiciousPatterns = [
                /test|placeholder|lorem|ipsum|tbd|n\/a|xxx|asdf|qwerty/i,
                /(.)\1{4,}/, // Repeated characters
            ];
            
            for (const pattern of suspiciousPatterns) {
                if (pattern.test(value)) {
                    return 'Title appears to be placeholder text or invalid';
                }
            }
            return null;
        }
    },
    description: {
        required: true,
        custom: (value) => {
            const suspiciousPatterns = [
                /test|placeholder|lorem|ipsum|tbd|n\/a|xxx|asdf|qwerty/i,
                /(.)\1{4,}/, // Repeated characters
            ];
            
            for (const pattern of suspiciousPatterns) {
                if (pattern.test(value)) {
                    return 'Description appears to be placeholder text or invalid';
                }
            }
            return null;
        }
    },
    status: {
        required: true,
        pattern: /^(recruiting|active|planning)$/,
        custom: (value) => {
            const validStatuses = ['recruiting', 'active', 'planning'];
            if (!validStatuses.includes(value)) {
                return 'Status must be one of: recruiting, active, planning';
            }
            return null;
        }
    },
    primaryDiscipline: {
        required: true,
        pattern: /^[a-z-]+$/
    },
    teamSize: {
        required: true,
        custom: (value) => {
            const num = parseInt(value);
            if (isNaN(num) || num < 1 || num > 50) {
                return 'Team size must be between 1 and 50';
            }
            return null;
        }
    },
    duration: {
        required: true,
        custom: (value) => {
            const num = parseInt(value);
            if (isNaN(num) || num < 1 || num > 120) {
                return 'Duration must be between 1 and 120';
            }
            return null;
        }
    }
};

/**
 * User registration validation schema
 */
export const userValidationSchema: ValidationSchema = {
    firstName: {
        required: true,
        minLength: 2,
        maxLength: 50,
        pattern: /^[a-zA-Z\s\-']+$/
    },
    lastName: {
        required: true,
        minLength: 2,
        maxLength: 50,
        pattern: /^[a-zA-Z\s\-']+$/
    },
    email: {
        required: true,
        maxLength: 254,
        custom: (value) => {
            if (!isValidEmail(value)) {
                return 'Please enter a valid email address';
            }
            return null;
        }
    },
    discipline: {
        required: true,
        pattern: /^[a-z-]+$/
    },
    role: {
        required: true,
        pattern: /^[a-z-]+$/
    }
};

/**
 * Rate limiting for validation (prevent spam)
 */
const validationAttempts = new Map<string, { count: number; resetTime: number }>();

export function checkValidationRateLimit(identifier: string): boolean {
    const now = Date.now();
    const attempts = validationAttempts.get(identifier);
    
    if (!attempts || now > attempts.resetTime) {
        validationAttempts.set(identifier, { count: 1, resetTime: now + 60000 }); // 1 minute
        return true;
    }
    
    if (attempts.count >= 10) { // Max 10 validation attempts per minute
        return false;
    }
    
    attempts.count++;
    return true;
}

/**
 * Sanitize file upload names
 */
export function sanitizeFileName(fileName: string): string {
    return fileName
        .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace invalid characters
        .replace(/_{2,}/g, '_') // Replace multiple underscores
        .substring(0, 255); // Limit length
}

/**
 * Validate file upload
 */
export function validateFileUpload(file: File): { isValid: boolean; error?: string } {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (file.size > maxSize) {
        return { isValid: false, error: 'File size must be less than 10MB' };
    }
    
    if (!allowedTypes.includes(file.type)) {
        return { isValid: false, error: 'File type not allowed' };
    }
    
    return { isValid: true };
}