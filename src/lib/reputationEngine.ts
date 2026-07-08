import { db } from '@/lib/firebase'
import {
    doc,
    getDoc,
    getDocs,
    collection,
    setDoc,
    updateDoc,
    serverTimestamp,
    query,
    where
} from 'firebase/firestore'

export interface ReputationSummary {
    trustScore: number
    collaborationScore: number
    reliabilityScore: number
    communicationScore: number
    completionScore: number
    overallRating: number
    totalReviews: number
}

export interface UserReputationStats {
    totalTasksAssigned: number
    totalTasksCompleted: number
    totalTasksCompletedOnTime: number
    projectsCompleted: number
}

const C_PRIOR_WEIGHT = 3
const M_PRIOR_RATING = 4.0

/**
 * Calculates Bayesian-adjusted ratings for the user.
 * Shrinks categories and overall score toward the 4.0 network mean when review count is low.
 */
export function calculateBayesianRating(reviews: any[]): ReputationSummary {
    const N = reviews.length
    if (N === 0) {
        return {
            trustScore: 80, // Baseline trust score for new users
            collaborationScore: 80,
            reliabilityScore: 80,
            communicationScore: 80,
            completionScore: 80,
            overallRating: 4.0,
            totalReviews: 0
        }
    }

    let coopSum = 0
    let relSum = 0
    let commSum = 0
    let skillSum = 0
    let ratingSum = 0

    reviews.forEach(r => {
        const coop = typeof r.cooperation === 'number' ? r.cooperation : 5
        const rel = typeof r.reliability === 'number' ? r.reliability : 5
        const comm = typeof r.communication === 'number' ? r.communication : 5
        const skill = typeof r.skill === 'number' ? r.skill : 5
        const avg = (coop + rel + comm + skill) / 4

        coopSum += coop
        relSum += rel
        commSum += comm
        skillSum += skill
        ratingSum += avg
    })

    // Apply Bayesian shrinkage math
    const coopBayes = (C_PRIOR_WEIGHT * M_PRIOR_RATING + coopSum) / (C_PRIOR_WEIGHT + N)
    const relBayes = (C_PRIOR_WEIGHT * M_PRIOR_RATING + relSum) / (C_PRIOR_WEIGHT + N)
    const commBayes = (C_PRIOR_WEIGHT * M_PRIOR_RATING + commSum) / (C_PRIOR_WEIGHT + N)
    const skillBayes = (C_PRIOR_WEIGHT * M_PRIOR_RATING + skillSum) / (C_PRIOR_WEIGHT + N)
    const overallRating = (C_PRIOR_WEIGHT * M_PRIOR_RATING + ratingSum) / (C_PRIOR_WEIGHT + N)

    // Convert 1-5 ratings to 0-100 scores
    const collaborationScore = Math.round(coopBayes * 20)
    const reliabilityScore = Math.round(relBayes * 20)
    const communicationScore = Math.round(commBayes * 20)
    const completionScore = Math.round(skillBayes * 20)

    // Trust Score calculation (starts at 80, increases with reviews, decreases with flags)
    const trustScore = Math.min(100, Math.max(0, Math.round(80 + (overallRating - 4.0) * 10 + Math.min(10, N * 2))))

    return {
        trustScore,
        collaborationScore,
        reliabilityScore,
        communicationScore,
        completionScore,
        overallRating,
        totalReviews: N
    }
}

/**
 * Checks and auto-grants V1 Badges to a user based on their reputation and stats.
 */
export async function evaluateUserBadges(userId: string, stats: UserReputationStats, rep: ReputationSummary, userProfile: any) {
    const badgesCollectionRef = collection(db, 'users', userId, 'badges')
    
    // 1. Verified Collaborator Badge (Trust, Tier 1: Foundation)
    // Criteria: Name, Bio, photoURL, and at least 3 skills set.
    const hasPhoto = !!userProfile?.photoURL
    const hasBio = !!userProfile?.bio && userProfile.bio.trim().length > 0
    const hasSkills = Array.isArray(userProfile?.skills) && userProfile.skills.length >= 3
    if (hasPhoto && hasBio && hasSkills) {
        await setDoc(doc(badgesCollectionRef, 'verified_collaborator'), {
            badgeType: 'verified_collaborator',
            title: 'Verified Collaborator',
            description: 'Established complete profile setup to build community trust.',
            icon: 'ShieldCheck',
            issuedAt: serverTimestamp(),
            evidence: {
                hasPhoto: true,
                hasBio: true,
                skillsCount: userProfile.skills.length
            }
        })
    }

    // Fetch revealed reviews once for use in multiple checks
    const reviewsSnap = await getDocs(query(collection(db, 'users', userId, 'reviews'), where('status', '==', 'revealed')))
    const revealedReviews = reviewsSnap.docs.map(d => d.data())

    // 2. Trusted Teammate Badge (Trust, Tier 2: Professional)
    // Criteria: Received at least 3 revealed reviews with Cooperation score >= 85
    if (rep.totalReviews >= 3 && rep.collaborationScore >= 85) {
        await setDoc(doc(badgesCollectionRef, 'trusted_teammate'), {
            badgeType: 'trusted_teammate',
            title: 'Trusted Teammate',
            description: 'Maintained outstanding cooperation ratings across multiple team deliverables.',
            icon: 'Users',
            issuedAt: serverTimestamp(),
            evidence: {
                totalReviews: rep.totalReviews,
                cooperationScore: rep.collaborationScore
            }
        })
    }

    // 3. Reliable Contributor Badge (Trust, Tier 2: Professional)
    // Criteria: Completed at least 10 tasks on or before the project deadline + Reliability Score >= 85
    if (stats.totalTasksCompletedOnTime >= 10 && rep.reliabilityScore >= 85) {
        await setDoc(doc(badgesCollectionRef, 'reliable_contributor'), {
            badgeType: 'reliable_contributor',
            title: 'Reliable Contributor',
            description: 'Successfully shipped 10+ tasks on or before schedule with high reliability.',
            icon: 'Clock',
            issuedAt: serverTimestamp(),
            evidence: {
                totalTasksCompleted: stats.totalTasksCompleted,
                onTimeCount: stats.totalTasksCompletedOnTime,
                reliabilityScore: rep.reliabilityScore
            }
        })
    }

    // 4. Proven Professional Badge (Trust, Tier 3: Advanced)
    // Criteria: Completed 5 projects with overall rating >= 4.7 stars
    if (rep.totalReviews >= 5 && rep.overallRating >= 4.7) {
        await setDoc(doc(badgesCollectionRef, 'proven_professional'), {
            badgeType: 'proven_professional',
            title: 'Proven Professional',
            description: 'Maintained exceptional quality and reviews across a substantial project history.',
            icon: 'Shield',
            issuedAt: serverTimestamp(),
            evidence: {
                totalReviews: rep.totalReviews,
                overallRating: rep.overallRating
            }
        })
    }

    // 5. Project Finisher (Delivery, Tier 2: Professional, Repeatable)
    // Awarded for each revealed review (represents a completed project)
    for (const rData of revealedReviews) {
        const pId = rData.projectId || 'unknown'
        await setDoc(doc(badgesCollectionRef, `project_finisher_${pId}`), {
            badgeType: 'project_finisher',
            title: 'Project Finisher',
            description: 'Successfully completed project milestones and delivered assigned tasks.',
            icon: 'CheckCircle',
            issuedAt: serverTimestamp(),
            evidence: {
                projectId: pId,
                projectName: rData.projectName || 'Completed Project'
            }
        })
    }

    // 6. Project Veteran (Delivery, Tier 3: Advanced)
    // Criteria: Successfully completed 5 verified projects
    if (rep.totalReviews >= 5) {
        await setDoc(doc(badgesCollectionRef, 'project_veteran'), {
            badgeType: 'project_veteran',
            title: 'Project Veteran',
            description: 'Successfully completed 5 verified projects on the platform.',
            icon: 'Award',
            issuedAt: serverTimestamp(),
            evidence: {
                totalProjects: rep.totalReviews
            }
        })
    }

    // 7. Project Master (Delivery, Tier 4: Elite)
    // Criteria: Successfully completed 10 verified projects + PCS >= 90
    if (rep.totalReviews >= 10 && rep.completionScore >= 90) {
        await setDoc(doc(badgesCollectionRef, 'project_master'), {
            badgeType: 'project_master',
            title: 'Project Master',
            description: 'Successfully completed 10 verified projects with outstanding completion rates.',
            icon: 'Crown',
            issuedAt: serverTimestamp(),
            evidence: {
                totalProjects: rep.totalReviews,
                completionScore: rep.completionScore
            }
        })
    }

    // 8. Verified Deliverer (Delivery, Tier 2: Professional, Repeatable)
    // Criteria: Completed projects with activity-verified team activity (isVerified = true in review)
    const verifiedReviews = revealedReviews.filter(r => r.isVerified === true)
    for (const rData of verifiedReviews) {
        const pId = rData.projectId || 'unknown'
        await setDoc(doc(badgesCollectionRef, `verified_deliverer_${pId}`), {
            badgeType: 'verified_deliverer',
            title: 'Verified Deliverer',
            description: 'Completed projects with verified team activity levels.',
            icon: 'GitBranch',
            issuedAt: serverTimestamp(),
            evidence: {
                projectId: pId,
                projectName: rData.projectName || 'Verified Project'
            }
        })
    }

    // 9. Team Builder (Collaboration, Tier 3: Advanced, Repeatable)
    // Criteria: Completed a project with cooperation rating >= 4.5
    for (const rData of revealedReviews) {
        const pId = rData.projectId || 'unknown'
        const coop = typeof rData.cooperation === 'number' ? rData.cooperation : 5
        if (coop >= 4.5) {
            await setDoc(doc(badgesCollectionRef, `team_builder_${pId}`), {
                badgeType: 'team_builder',
                title: 'Team Builder',
                description: 'Exhibited exceptional team coordination and alignment on project deliverables.',
                icon: 'Users',
                issuedAt: serverTimestamp(),
                evidence: {
                    projectId: pId,
                    projectName: rData.projectName || 'Completed Project',
                    cooperationRating: coop
                }
            })
        }
    }

    // 10. Outstanding Collaborator (Collaboration, Tier 3: Advanced)
    // Criteria: 5+ reviews with Cooperation score >= 90
    if (rep.totalReviews >= 5 && rep.collaborationScore >= 90) {
        await setDoc(doc(badgesCollectionRef, 'outstanding_collaborator'), {
            badgeType: 'outstanding_collaborator',
            title: 'Outstanding Collaborator',
            description: 'Consistently praised by teammates for cooperation and communication.',
            icon: 'Heart',
            issuedAt: serverTimestamp(),
            evidence: {
                totalReviews: rep.totalReviews,
                collaborationScore: rep.collaborationScore
            }
        })
    }

    // 11. Cross-Functional Contributor (Collaboration, Tier 4: Elite)
    // Criteria: completed 3+ projects + has 6+ skills listed
    if (rep.totalReviews >= 3 && Array.isArray(userProfile?.skills) && userProfile.skills.length >= 6) {
        await setDoc(doc(badgesCollectionRef, 'cross_functional_dev'), {
            badgeType: 'cross_functional_dev',
            title: 'Cross-Functional Contributor',
            description: 'Demonstrated versatile capabilities across multiple project disciplines.',
            icon: 'Layers',
            issuedAt: serverTimestamp(),
            evidence: {
                skillsCount: userProfile.skills.length,
                totalProjects: rep.totalReviews
            }
        })
    }

    // 12. Top Rated (Reputation, Tier 4: Elite)
    // Criteria: overall peer rating >= 4.8 stars across minimum 10 reviews.
    if (rep.totalReviews >= 10 && rep.overallRating >= 4.8) {
        await setDoc(doc(badgesCollectionRef, 'top_rated'), {
            badgeType: 'top_rated',
            title: 'Top Rated',
            description: 'Maintained an overall peer rating of 4.8+ stars across a large project history.',
            icon: 'Star',
            issuedAt: serverTimestamp(),
            evidence: {
                totalReviews: rep.totalReviews,
                overallRating: rep.overallRating
            }
        })
    }

    // 16. Community Trusted (Reputation, Tier 5: Legendary)
    // Criteria: overall rating >= 4.9 stars, 20+ reviews.
    if (rep.totalReviews >= 20 && rep.overallRating >= 4.9) {
        await setDoc(doc(badgesCollectionRef, 'community_trusted'), {
            badgeType: 'community_trusted',
            title: 'Community Trusted',
            description: 'Achieved legendary reputation with exceptional ratings across 20+ peer evaluations.',
            icon: 'ShieldAlert',
            issuedAt: serverTimestamp(),
            evidence: {
                totalReviews: rep.totalReviews,
                overallRating: rep.overallRating
            }
        })
    }
}

/**
 * Queries all user reviews, aggregates reputation metrics, and evaluates badges.
 * Write-heavy operation, to be called when reviews are revealed or projects complete.
 */
export async function aggregateUserReputation(userId: string) {
    try {
        const userDocRef = doc(db, 'users', userId)
        const userSnap = await getDoc(userDocRef)
        if (!userSnap.exists()) return

        const userProfile = userSnap.data()
        
        // Fetch revealed reviews
        const reviewsSnap = await getDocs(query(collection(db, 'users', userId, 'reviews'), where('status', '==', 'revealed')))
        const reviews = reviewsSnap.docs.map(d => d.data())

        const repSummary = calculateBayesianRating(reviews)

        // Read or build stats
        const stats: UserReputationStats = {
            totalTasksAssigned: userProfile.reputationStats?.totalTasksAssigned || 0,
            totalTasksCompleted: userProfile.reputationStats?.totalTasksCompleted || 0,
            totalTasksCompletedOnTime: userProfile.reputationStats?.totalTasksCompletedOnTime || 0,
            projectsCompleted: userProfile.reputationStats?.projectsCompleted || 0
        }

        // Update User Doc
        await updateDoc(userDocRef, {
            reputation: repSummary,
            reputationStats: stats
        })

        // Evaluate Badges
        await evaluateUserBadges(userId, stats, repSummary, userProfile)
    } catch (error) {
        console.error('Error aggregating user reputation:', error)
    }
}

/**
 * Transitions all reviews submitted for a specific project from "pending" to "revealed".
 * Called when the final review is submitted, or when a manual/time-based gate triggers.
 */
export async function revealProjectReviews(projectId: string, memberIds: string[]) {
    try {
        // Get all members who have submitted reviews
        const reviewStatesSnap = await getDocs(collection(db, 'projects', projectId, 'reviewStates'))
        const activeReviewers = reviewStatesSnap.docs
            .filter(d => d.data().hasReviewed === true)
            .map(d => d.id)

        await Promise.all(
            memberIds.map(async (targetUserId) => {
                // For this target user, update all pending reviews from reviewers who have submitted
                await Promise.all(
                    activeReviewers.map(async (reviewerId) => {
                        if (reviewerId === targetUserId) return
                        const reviewId = `${reviewerId}_${projectId}`
                        const docRef = doc(db, 'users', targetUserId, 'reviews', reviewId)
                        try {
                            await updateDoc(docRef, {
                                status: 'revealed'
                            })
                        } catch (e) {
                            // If review does not exist, ignore
                        }
                    })
                )

                // Trigger a full recalculation of this member's reputation
                await aggregateUserReputation(targetUserId)
            })
        )
    } catch (error) {
        console.error('Error revealing project reviews:', error)
    }
}
