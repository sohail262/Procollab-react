import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getStudentProfile, 
  getProfileWithFallback,
  validateProfile,
  createMockProfile
} from '../profileService';

// Mock Firebase
vi.mock('@/lib/firebase', () => ({
  db: {}
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ id: 'test-doc' })),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
  serverTimestamp: vi.fn(() => ({ seconds: Date.now() / 1000 })),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn()
}));

vi.mock('@/lib/queryUtils', () => ({
  cachedGetDoc: vi.fn()
}));

// Feature: shareable-student-profile-card, Integration Tests
describe('Profile Service Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Data Integration and Validation', () => {
    it('should handle valid profile data correctly', async () => {
      const { cachedGetDoc } = await import('@/lib/queryUtils');
      
      const mockFirebaseData = {
        personalInfo: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          bio: 'Test bio',
          program: 'Computer Science'
        },
        skills: {
          technical: ['JavaScript', 'React'],
          soft: ['Communication'],
          tools: ['Git']
        },
        preferences: {
          contactMethods: [{ type: 'email', value: 'john@example.com', isPrimary: true }],
          profileVisibility: 'public',
          shareableCard: true
        },
        metadata: {
          avatarSeed: 'test-seed'
        }
      };

      vi.mocked(cachedGetDoc).mockResolvedValue({
        exists: () => true,
        data: () => mockFirebaseData
      } as any);

      const result = await getStudentProfile('test-user');
      
      expect(result).not.toBeNull();
      expect(result?.name).toBe('John Doe');
      expect(result?.email).toBe('john@example.com');
      expect(result?.skills).toHaveLength(4); // 2 technical + 1 soft + 1 tools
      expect(result?.skills.some(s => s.category === 'technical')).toBe(true);
      expect(result?.skills.some(s => s.category === 'soft')).toBe(true);
      expect(result?.skills.some(s => s.category === 'tools')).toBe(true);
    });

    it('should handle missing profile gracefully', async () => {
      const { cachedGetDoc } = await import('@/lib/queryUtils');
      
      vi.mocked(cachedGetDoc).mockResolvedValue({
        exists: () => false
      } as any);

      const result = await getStudentProfile('non-existent-user');
      expect(result).toBeNull();
    });

    it('should provide fallback profile when main fetch fails', async () => {
      const { cachedGetDoc } = await import('@/lib/queryUtils');
      
      vi.mocked(cachedGetDoc).mockRejectedValue(new Error('Network error'));

      const result = await getProfileWithFallback('test-user');
      
      expect(result).not.toBeNull();
      expect(result.id).toBe('test-user');
      expect(result.name).toBe('Demo Student');
      expect(result.skills.length).toBeGreaterThan(0);
    });

    it('should validate profile completeness correctly', async () => {
      const { getDoc } = await import('firebase/firestore');
      
      const completeProfile = {
        personalInfo: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        },
        skills: {
          technical: ['JavaScript'],
          soft: [],
          tools: []
        }
      };

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => completeProfile
      } as any);

      const validation = await validateProfile('test-user');
      
      expect(validation.exists).toBe(true);
      expect(validation.isComplete).toBe(true);
      expect(validation.missingFields).toHaveLength(0);
    });

    it('should identify missing required fields', async () => {
      const { getDoc } = await import('firebase/firestore');
      
      const incompleteProfile = {
        personalInfo: {
          firstName: 'John',
          // Missing lastName and email
        },
        skills: {
          // No skills
        }
      };

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => incompleteProfile
      } as any);

      const validation = await validateProfile('test-user');
      
      expect(validation.exists).toBe(true);
      expect(validation.isComplete).toBe(false);
      expect(validation.missingFields).toContain('lastName');
      expect(validation.missingFields).toContain('email');
      expect(validation.missingFields).toContain('skills');
    });
  });

  describe('Mock Profile Generation', () => {
    it('should create valid mock profile', () => {
      const mockProfile = createMockProfile('test-id');
      
      expect(mockProfile.id).toBe('test-id');
      expect(mockProfile.name).toBeDefined();
      expect(mockProfile.email).toBeDefined();
      expect(mockProfile.skills.length).toBeGreaterThan(0);
      expect(mockProfile.contactPreferences.length).toBeGreaterThan(0);
      expect(mockProfile.avatarSeed).toBe('test-id');
      
      // Verify skill categories
      const categories = mockProfile.skills.map(s => s.category);
      expect(categories).toContain('technical');
      expect(categories).toContain('soft');
      expect(categories).toContain('tools');
    });
  });

  describe('Error Handling', () => {
    it('should handle Firebase connection errors', async () => {
      const { cachedGetDoc } = await import('@/lib/queryUtils');
      
      vi.mocked(cachedGetDoc).mockRejectedValue(new Error('Firebase connection failed'));

      await expect(getStudentProfile('test-user')).rejects.toThrow('Failed to fetch profile');
    });

    it('should handle invalid student ID', async () => {
      await expect(getStudentProfile('')).rejects.toThrow('Student ID is required');
    });
  });

  describe('Reactive Updates', () => {
    it('should set up profile subscription correctly', async () => {
      const { onSnapshot } = await import('firebase/firestore');
      const { subscribeToProfileUpdates } = await import('../profileService');
      
      const mockUnsubscribe = vi.fn();
      vi.mocked(onSnapshot).mockReturnValue(mockUnsubscribe);
      
      const mockCallback = vi.fn();
      const unsubscribe = subscribeToProfileUpdates('test-user', mockCallback);
      
      expect(typeof unsubscribe).toBe('function');
      expect(onSnapshot).toHaveBeenCalled();
      
      // Test unsubscribe
      unsubscribe();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});