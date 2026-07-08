// Static import map for badge SVGs
// Vite requires static imports for assets in src/ to be bundled correctly.
// Each key maps a badgeType string to its SVG asset.

import verifiedCollaborator from '@/assets/Badges/Verified Collaborator.svg'
import trustedTeammate from '@/assets/Badges/Trusted Teammate.svg'
import reliableContributor from '@/assets/Badges/Reliable Contributor.svg'
import provenProfessional from '@/assets/Badges/Professional Partner.svg'
import projectFinisher from '@/assets/Badges/Project Finisher.svg'
import projectMaster from '@/assets/Badges/Project master.svg'
import teamBuilder from '@/assets/Badges/Team Builder.svg'
import outstandingCollaborator from '@/assets/Badges/Outstanding Collaborator.svg'
import crossFunctionalDev from '@/assets/Badges/Cross Functional Contributor.svg'
import topRated from '@/assets/Badges/Top Rated.svg'
import communityTrusted from '@/assets/Badges/Community Trusted.svg'
import projectLeader from '@/assets/Badges/Project Leader.svg'
import deliveryManager from '@/assets/Badges/Delivery Manager.svg'
import verifiedMentor from '@/assets/Badges/Verified mentor.svg'
import knowledgeContributor from '@/assets/Badges/Knowledge Contributor.svg'

export const BADGE_IMAGES: Record<string, string> = {
    verified_collaborator: verifiedCollaborator,
    trusted_teammate: trustedTeammate,
    reliable_contributor: reliableContributor,
    proven_professional: provenProfessional,
    project_finisher: projectFinisher,
    project_master: projectMaster,
    team_builder: teamBuilder,
    outstanding_collaborator: outstandingCollaborator,
    cross_functional_dev: crossFunctionalDev,
    top_rated: topRated,
    community_trusted: communityTrusted,
    project_leader: projectLeader,
    delivery_manager: deliveryManager,
    verified_mentor: verifiedMentor,
    knowledge_contributor: knowledgeContributor,
}
