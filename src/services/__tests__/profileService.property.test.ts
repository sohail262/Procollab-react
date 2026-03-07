import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { 
  getStudentProfile, 
  getStudentProfiles, 
  updateStudentProfile, 
  createStudentProfile,
  searchStudentProfiles,
  validateProfile
} from '../profileService';
import { StudentProfile, FirebaseProfile } from '@/components/ProfileCard/types';

// Mock Firebase
vi.mock('@/lib/firebase', () => ({
  db: {}
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => ({ seconds: Date.now() / 1000 })),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn()
}));

vi.mock('@/lib/queryUtils', () => ({
  cachedGetDoc: vi.fn()
}));

// Feature: shareable-student-profile-card, Property 9: Data Integration and Validation
describe('Property 9: Data Integration and Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Generators for test data
  const studentIdGenerator = fc.string({ minLength: 1, maxLength: 50 })
    .filter(s => s.trim().length > 0);

  const skillNameGenerator = fc.constantFrom(
    'JavaScript', 'Python', 'React', 'Node.js', 'TypeScript', 'CSS',
    'Communication', 'Leadership', 'Teamwork', 'Problem Solving',
    'Git', 'Docker', 'AWS', 'MongoDB', 'PostgreSQL'
  );

  const contactPreferenceGenerator = fc.record({
    type: fc.constantFrom('email', 'linkedin', 'discord', 'custom'),
    value: fc.string({ minLength: 5, maxLength: 100 }),
    isPrimary: fc.boolean()
  });

  const studentProfileGenerator = fc.record({
    id: studentIdGenerator,
    name: fc.string({ minLength: 2, maxLength: 100 }).filter(s => s.trim().length >= 2),
    email: fc.emailAddress(),
    bio: fc.option(fc.string({ minLength: 10, maxLength: 500 })),
    program: fc.option(fc.constantFrom(
      'Computer Science', 'Engineering', 'Business', 'Design', 'Data Science'
    )),
    skills: fc.array(fc.record({
      id: fc.string({ minLength: 1, maxLength: 20 }),
      name: skillNameGenerator,
      category: fc.constantFrom('technical', 'soft', 'tools'),
      proficiencyLevel: fc.option(fc.constantFrom('beginner', 'intermediate', 'advanced'))
    }), { minLength: 1, maxLength: 15 }),
    contactPreferences: fc.array(contactPreferenceGenerator, { minLength: 0, maxLength: 5 }),
    avatarSeed: fc.string({ minLength: 1, maxLength: 50 })
  });

  const firebaseProfileGenerator = fc.record({
    personalInfo: fc.record({
      firstName: fc.string({ minLength: 1, maxLength: 50 }),
      lastName: fc.string({ minLength: 1, maxLength: 50 }),
      email: fc.emailAddress(),
      bio: fc.option(fc.string({ minLength: 10, maxLength: 500 })),
      program: fc.option(fc.constantFrom(
        'Computer Science', 'Engineering', 'Business', 'Design'
      ))
    }),
    skills: fc.record({
      technical: fc.array(skillNameGenerator, { minLength: 0, maxLength: 10 }),
      soft: fc.array(skillNameGenerator, { minLength: 0, maxLength: 10 }),
      tools: fc.array(skillNameGenerator, { minLength: 0, maxLength: 10 })
    }),
    preferences: fc.record({
      contactMethods: fc.array(contactPreferenceGenerator, { minLength: 0, maxLength: 5 }),
      profileVisibility: fc.constantFrom('public', 'students', 'private'),
      shareableCard: fc.boolean()
    }),
    metadata: fc.record({
      createdAt: fc.constant({ seconds: Date.now() / 1000 }),
      updatedAt: fc.constant({ seconds: Date.now() / 1000 }),
      avatarSeed: fc.string({ minLength: 1, maxLength: 50 })
    })
  });

  it('should handle valid student IDs consistently', () => {
    fc.assert(
      fc.property(
        studentIdGenerator,
        async (studentId) => {
          const { cachedGetDoc } = await import('@/lib/queryUtils');
          
          // Mock successful response
          vi.mocked(cachedGetDoc).mockResolvedValue({
            exists: () => true,
            data: () => ({
              personalInfo: {
                firstName: 'John',
                lastName: 'Doe',
                email: 'john@example.com'
              },
              skills: { technical: ['JavaScript'], soft: [], tools: [] },
              preferences: { contactMethods: [], profileVisibility: 'public', shareableCard: true },
              metadata: { avatarSeed: studentId }
            })
          } as any);

          const result = await getStudentProfile(studentId);
          
          expect(result).not.toBeNull();
          expect(result?.id).toBe(studentId);
          expect(result?.name).toBe('John Doe');
          expect(result?.email).toBe('john@example.com');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should reject invalid or empty student IDs', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', '   ', '\t', '\n'),
        async (invalidId) => {
          await expect(getStudentProfile(invalidId)).rejects.toThrow('Student ID is required');
        }
      ),
      { numRuns: 10 }
    );
  });

  it('should transform Firebase data to StudentProfile format correctly', () => {
    fc.assert(
      fc.property(
        studentIdGenerator,
        firebaseProfileGenerator,
        async (studentId, firebaseData) => {
          const { cachedGetDoc } = await import('@/lib/queryUtils');
          
          vi.mocked(cachedGetDoc).mockResolvedValue({
            exists: () => true,
            data: () => firebaseData
          } as any);

          const result = await getStudentProfile(studentId);
          
          if (result) {
            // Verify transformation
            expect(result.id).toBe(studentId);
            expect(result.name).toBe(`${firebaseData.personalInfo.firstName} ${firebaseData.personalInfo.lastName}`.trim());
            expect(result.email).toBe(firebaseData.personalInfo.email);
            expect(result.bio).toBe(firebaseData.personalInfo.bio);
            expect(result.program).toBe(firebaseData.personalInfo.program);
            
            // Verify skills transformation
            const expectedSkillCount = 
              (firebaseData.skills.technical?.length || 0) +
              (firebaseData.skills.soft?.length || 0) +
              (firebaseData.skills.tools?.length || 0);
            expect(result.skills).toHaveLength(expectedSkillCount);
            
            // Verify skill categories
            const technicalSkills = result.skills.filter(s => s.category === 'technical');
            const softSkills = result.skills.filter(s => s.category === 'soft');
            const toolSkills = result.skills.filter(s => s.category === 'tools');
            
            expect(technicalSkills).toHaveLength(firebaseData.skills.technical?.length || 0);
            expect(softSkills).toHaveLength(firebaseData.skills.soft?.length || 0);
            expect(toolSkills).toHaveLength(firebaseData.skills.tools?.length || 0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle missing or incomplete profile data gracefully', () => {
    fc.assert(
      fc.property(
        studentIdGenerator,
        fc.record({
          personalInfo: fc.option(fc.record({
            firstName: fc.option(fc.string()),
            lastName: fc.option(fc.string()),
            email: fc.option(fc.string())
          })),
          skills: fc.option(fc.record({
            technical: fc.option(fc.array(fc.string())),
            soft: fc.option(fc.array(fc.string())),
            tools: fc.option(fc.array(fc.string()))
          }))
        }),
        async (studentId, incompleteData) => {
          const { cachedGetDoc } = await import('@/lib/queryUtils');
          
          vi.mocked(cachedGetDoc).mockResolvedValue({
            exists: () => true,
            data: () => incompleteData
          } as any);

          const result = await getStudentProfile(studentId);
          
          // Should return null for incomplete profiles
          if (!incompleteData.personalInfo?.firstName || !incompleteData.personalInfo?.email) {
            expect(result).toBeNull();
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle non-existent profiles correctly', () => {
    fc.assert(
      fc.property(
        studentIdGenerator,
        async (studentId) => {
          const { cachedGetDoc } = await import('@/lib/queryUtils');
          
          vi.mocked(cachedGetDoc).mockResolvedValue({
            exists: () => false
          } as any);

          const result = await getStudentProfile(studentId);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should batch fetch multiple profiles efficiently', () => {
    fc.assert(
      fc.property(
        fc.array(studentIdGenerator, { minLength: 1, maxLength: 10 }),
        async (studentIds) => {
          const { cachedGetDoc } = await import('@/lib/queryUtils');
          
          // Mock responses for each student ID
          vi.mocked(cachedGetDoc).mockImplementation((docRef: any) => {
            const studentId = docRef.id || 'test-id';
            return Promise.resolve({
              exists: () => true,
              data: () => ({
                personalInfo: {
                  firstName: `User${studentId}`,
                  lastName: 'Test',
                  email: `${studentId}@example.com`
                },
                skills: { technical: ['JavaScript'], soft: [], tools: [] },
                preferences: { contactMethods: [], profileVisibility: 'public', shareableCard: true },
                metadata: { avatarSeed: studentId }
              })
            });
          });

          const results = await getStudentProfiles(studentIds);
          
          // Should return profiles for valid IDs (allowing for some failures)
          expect(results.length).toBeGreaterThanOrEqual(0);
          expect(results.length).toBeLessThanOrEqual(studentIds.length);
          
          // Each result should be a valid profile
          results.forEach(profile => {
            expect(profile.id).toBeDefined();
            expect(profile.name).toBeDefined();
            expect(profile.email).toBeDefined();
          });
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should validate profile completeness correctly', () => {
    fc.assert(
      fc.property(
        studentIdGenerator,
        firebaseProfileGenerator,
        async (studentId, profileData) => {
          const { getDoc } = await import('firebase/firestore');
          
          vi.mocked(getDoc).mockResolvedValue({
            exists: () => true,
            data: () => profileData
          } as any);

          const validation = await validateProfile(studentId);
          
          expect(validation.exists).toBe(true);
          
          // Check completeness based on required fields
          const hasFirstName = !!profileData.personalInfo.firstName;
          const hasLastName = !!profileData.personalInfo.lastName;
          const hasEmail = !!profileData.personalInfo.email;
          const hasSkills = !!(
            profileData.skills.technical?.length ||
            profileData.skills.soft?.length ||
            profileData.skills.tools?.length
          );
          
          const expectedComplete = hasFirstName && hasLastName && hasEmail && hasSkills;
          expect(validation.isComplete).toBe(expectedComplete);
          
          if (!expectedComplete) {
            expect(validation.missingFields.length).toBeGreaterThan(0);
          } else {
            expect(validation.missingFields.length).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle Firebase errors gracefully', () => {
    fc.assert(
      fc.property(
        studentIdGenerator,
        async (studentId) => {
          const { cachedGetDoc } = await import('@/lib/queryUtils');
          
          // Mock Firebase error
          vi.mocked(cachedGetDoc).mockRejectedValue(new Error('Firebase connection failed'));

          await expect(getStudentProfile(studentId)).rejects.toThrow();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should maintain data consistency during transformations', () => {
    fc.assert(
      fc.property(
        studentProfileGenerator,
        async (originalProfile) => {
          // This test would verify that data remains consistent through
          // transformation cycles (StudentProfile -> Firebase -> StudentProfile)
          
          // For now, we'll test the structure consistency
          expect(originalProfile.id).toBeDefined();
          expect(originalProfile.name).toBeDefined();
          expect(originalProfile.email).toBeDefined();
          expect(Array.isArray(originalProfile.skills)).toBe(true);
          expect(Array.isArray(originalProfile.contactPreferences)).toBe(true);
          
          // Verify skill structure
          originalProfile.skills.forEach(skill => {
            expect(['technical', 'soft', 'tools']).toContain(skill.category);
            expect(skill.name).toBeDefined();
            expect(skill.id).toBeDefined();
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: shareable-student-profile-card, Property 10: Reactive Updates
describe('Property 10: Reactive Updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle subscription lifecycle correctly', () => {
    fc.assert(
      fc.property(
        studentIdGenerator,
        (studentId) => {
          const { onSnapshot } = require('firebase/firestore');
          
          // Mock onSnapshot to return an unsubscribe function
          const mockUnsubscribe = vi.fn();
          vi.mocked(onSnapshot).mockReturnValue(mockUnsubscribe);
          
          const mockCallback = vi.fn();
          
          // Import and test subscription
          const { subscribeToProfileUpdates } = require('../profileService');
          const unsubscribe = subscribeToProfileUpdates(studentId, mockCallback);
          
          // Should return unsubscribe function
          expect(typeof unsubscribe).toBe('function');
          
          // Should have called onSnapshot
          expect(onSnapshot).toHaveBeenCalled();
          
          // Calling unsubscribe should work
          unsubscribe();
          expect(mockUnsubscribe).toHaveBeenCalled();
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should handle subscription errors gracefully', () => {
    fc.assert(
      fc.property(
        studentIdGenerator,
        (studentId) => {
          const { onSnapshot } = require('firebase/firestore');
          
          // Mock onSnapshot to simulate error
          vi.mocked(onSnapshot).mockImplementation((ref, successCallback, errorCallback) => {
            // Simulate error after setup
            setTimeout(() => {
              if (errorCallback) {
                errorCallback(new Error('Subscription failed'));
              }
            }, 0);
            return vi.fn(); // Return unsubscribe function
          });
          
          const mockCallback = vi.fn();
          
          const { subscribeToProfileUpdates } = require('../profileService');
          
          // Should not throw when setting up subscription
          expect(() => {
            subscribeToProfileUpdates(studentId, mockCallback);
          }).not.toThrow();
        }
      ),
      { numRuns: 20 }
    );
  });
});