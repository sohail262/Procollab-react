import { useState, useEffect, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { SEOHead } from '@/components/seo/SEOHead'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    TrendingUp,
    Code2,
    HeartPulse,
    Pill,
    Scale,
    Briefcase,
    Palette,
    RefreshCw,
    ExternalLink,
    Clock,
    Search,
    Globe,
    Filter
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { useDebounce } from '@/hooks/useDebounce'

export interface TrendingTopicItem {
    id: string
    title: string
    description: string
    url: string
    time: number
    category: 'tech' | 'health' | 'pharma' | 'law' | 'business' | 'design'
    categoryLabel: string
    accent: string
    tags: string[]
    source: string
    sourceLabel: string
    score?: number
}

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; pillBg: string; pillText: string; dotColor: string }> = {
    all:      { label: 'All',      icon: TrendingUp, pillBg: 'bg-violet-500/20',  pillText: 'text-violet-300',  dotColor: 'bg-violet-400' },
    tech:     { label: 'Tech',     icon: Code2,      pillBg: 'bg-sky-500/20',     pillText: 'text-sky-300',     dotColor: 'bg-sky-400' },
    health:   { label: 'Health',   icon: HeartPulse, pillBg: 'bg-rose-500/20',    pillText: 'text-rose-300',    dotColor: 'bg-rose-400' },
    pharma:   { label: 'Pharma',   icon: Pill,       pillBg: 'bg-emerald-500/20', pillText: 'text-emerald-300', dotColor: 'bg-emerald-400' },
    law:      { label: 'Law',      icon: Scale,      pillBg: 'bg-amber-500/20',   pillText: 'text-amber-300',   dotColor: 'bg-amber-400' },
    business: { label: 'Business', icon: Briefcase,  pillBg: 'bg-cyan-500/20',    pillText: 'text-cyan-300',    dotColor: 'bg-cyan-400' },
    design:   { label: 'Design',   icon: Palette,    pillBg: 'bg-indigo-500/20',  pillText: 'text-indigo-300',  dotColor: 'bg-indigo-400' },
}

// ── 25+ curated items per discipline ─────────────────────────────────────────
const FALLBACK_POOL: TrendingTopicItem[] = [
    // ── HEALTH & MEDICINE (25 items) ─────────────────────────────────────────
    { id: 'h01', title: 'CRISPR Gene Editing Achieves 80% Response Rate in Solid Tumor Trials', description: 'First-in-human Phase I/II data shows durable anti-tumor responses with CAR-T CRISPR-modified cells in refractory cancers, changing the treatment ceiling.', url: 'https://news.google.com/search?q=CRISPR+gene+editing+solid+tumor+CAR-T+clinical+trial&hl=en', time: Date.now()/1000-7200, category: 'health', categoryLabel: 'Health & Medicine', accent: 'rose', tags: ['Oncology','CRISPR','Gene Editing'], source: 'nature', sourceLabel: 'Nature Medicine' },
    { id: 'h02', title: 'AI Outperforms Radiologists in Detecting Early-Stage Lung Nodules', description: 'Multi-center study shows AI-assisted chest CT reading reduces false negatives by 37% versus unassisted radiologists across six hospital systems.', url: 'https://news.google.com/search?q=AI+radiology+lung+nodule+detection+false+negative&hl=en', time: Date.now()/1000-10800, category: 'health', categoryLabel: 'Health & Medicine', accent: 'rose', tags: ['Medical AI','Radiology','Diagnostics'], source: 'nejm', sourceLabel: 'NEJM' },
    { id: 'h03', title: 'FDA Clears First OTC Continuous Glucose Monitor for Non-Diabetics', description: 'FDA clears first CGM for non-prescription purchase, opening real-time metabolic tracking to 100M+ non-diabetic users for lifestyle optimization.', url: 'https://news.google.com/search?q=FDA+OTC+continuous+glucose+monitor+non+diabetic+approval&hl=en', time: Date.now()/1000-18000, category: 'health', categoryLabel: 'Health & Medicine', accent: 'rose', tags: ['Digital Health','Wearables','FDA'], source: 'fda', sourceLabel: 'FDA News' },
    { id: 'h04', title: 'Gut Microbiome Signatures Predict Parkinson\'s Onset 7 Years Early', description: 'Longitudinal cohort identifies distinct microbial patterns associated with prodromal neurodegeneration, enabling presymptomatic intervention windows.', url: 'https://news.google.com/search?q=gut+microbiome+Parkinson+early+prediction+prodromal&hl=en', time: Date.now()/1000-25200, category: 'health', categoryLabel: 'Health & Medicine', accent: 'rose', tags: ['Microbiome','Neurology','Early Diagnosis'], source: 'lancet', sourceLabel: 'The Lancet' },
    { id: 'h05', title: 'Personalized mRNA Cancer Vaccines Show Durable Tumor Regression in Phase II', description: 'BioNTech individualized mRNA neoantigen vaccines demonstrate >50% durable response rates in melanoma and non-small cell lung cancer.', url: 'https://news.google.com/search?q=mRNA+personalized+cancer+neoantigen+vaccine+BioNTech+Phase+II&hl=en', time: Date.now()/1000-36000, category: 'health', categoryLabel: 'Health & Medicine', accent: 'rose', tags: ['mRNA','Immunotherapy','Cancer Vaccine'], source: 'statnews', sourceLabel: 'STAT News' },
    { id: 'h06', title: 'Digital Therapeutic App Reduces Major Depressive Episodes by 52% in RCT', description: 'Prescription digital therapeutic PHQ-9 improvement vs. placebo in 600-patient RCT clears FDA breakthrough designation threshold.', url: 'https://news.google.com/search?q=digital+therapeutic+depression+PHQ-9+RCT+FDA+breakthrough&hl=en', time: Date.now()/1000-43200, category: 'health', categoryLabel: 'Health & Medicine', accent: 'rose', tags: ['Mental Health','DTx','Psychiatry'], source: 'jama', sourceLabel: 'JAMA' },
    { id: 'h07', title: 'Focused Ultrasound Achieves 68% Remission in Treatment-Resistant Depression', description: 'Non-invasive neuromodulation targeting anterior cingulate cortex outperforms ECT in treatment-resistant cohort with no seizure side-effects.', url: 'https://news.google.com/search?q=focused+ultrasound+neuromodulation+treatment+resistant+depression+remission&hl=en', time: Date.now()/1000-50400, category: 'health', categoryLabel: 'Health & Medicine', accent: 'rose', tags: ['Neuromodulation','Depression','TMS'], source: 'brains', sourceLabel: 'Brain Stimulation' },
    { id: 'h08', title: 'Multi-Cancer Liquid Biopsy Detects 20+ Cancers in 50,000-Person Trial', description: 'Circulating tumor DNA screening in healthy adults identifies multiple cancer types with >99% specificity, years before clinical symptom onset.', url: 'https://news.google.com/search?q=multi+cancer+liquid+biopsy+ctDNA+early+detection+trial&hl=en', time: Date.now()/1000-57600, category: 'health', categoryLabel: 'Health & Medicine', accent: 'rose', tags: ['Liquid Biopsy','Screening','ctDNA'], source: 'nci', sourceLabel: 'NCI' },
    { id: 'h09', title: 'Exosome-Based Drug Delivery Crosses Blood-Brain Barrier with 10× Efficiency', description: 'Engineered exosomes successfully deliver siRNA payloads to glioblastoma tumor microenvironment in preclinical primate models.', url: 'https://news.google.com/search?q=exosome+drug+delivery+blood+brain+barrier+siRNA&hl=en', time: Date.now()/1000-64800, category: 'health', categoryLabel: 'Health & Medicine', accent: 'rose', tags: ['Drug Delivery','BBB','Neuroscience'], source: 'elsevier', sourceLabel: 'Biomaterials' },
    { id: 'h10', title: 'Robotic Surgery Platform Achieves Sub-Millimeter Anastomosis in Colorectal Procedures', description: 'Next-gen haptic robotic system reduces anastomotic leak rates to 0.8% versus 4.2% conventional laparoscopic benchmark in colorectal resections.', url: 'https://news.google.com/search?q=robotic+surgery+anastomosis+colorectal+haptic&hl=en', time: Date.now()/1000-72000, category: 'health', categoryLabel: 'Health & Medicine', accent: 'rose', tags: ['Robotic Surgery','MIS','Colorectal'], source: 'jrobot', sourceLabel: 'J Robotic Surgery' },
    { id: 'h11', title: 'AI Predicts Sepsis 6 Hours Before Clinical Recognition in ICU', description: 'Deep-learning model on EHR vitals and labs shows AUC 0.94 for sepsis prediction, enabling pre-emptive antibiotic protocols in critical care.', url: 'https://news.google.com/search?q=AI+sepsis+prediction+ICU+EHR+AUC+early+detection&hl=en', time: Date.now()/1000-79200, category: 'health', categoryLabel: 'Health & Medicine', accent: 'rose', tags: ['Sepsis','ICU AI','Clinical Decision'], source: 'cc', sourceLabel: 'Critical Care' },
    { id: 'h12', title: 'Longevity Drug Rapamycin Extends Healthy Lifespan in Aged Non-Human Primates', description: 'Intermittent rapamycin dosing produces 15% healthspan extension in aged rhesus macaques without immunosuppressive side-effects at low doses.', url: 'https://news.google.com/search?q=rapamycin+longevity+healthspan+macaque+mTOR+aging&hl=en', time: Date.now()/1000-86400, category: 'health', categoryLabel: 'Health & Medicine', accent: 'rose', tags: ['Longevity','Aging','mTOR'], source: 'cell', sourceLabel: 'Cell' },
    { id: 'h13', title: 'Digital Pathology AI Matches Expert Pathologist Accuracy in Breast Cancer Grading', description: 'Computational pathology platform achieves inter-rater concordance of 0.92 kappa with senior pathologists on 50,000 H&E-stained slides.', url: 'https://news.google.com/search?q=digital+pathology+AI+breast+cancer+grading+kappa&hl=en', time: Date.now()/1000-93600, category: 'health', categoryLabel: 'Health & Medicine', accent: 'rose', tags: ['Pathology AI','Breast Cancer','Digital Pathology'], source: 'path', sourceLabel: 'Modern Pathology' },
    { id: 'h14', title: 'Wearable ECG Patch Detects Subclinical AFib in 230,000-Person Community Study', description: 'Lead II ECG patch worn for 14 days identifies atrial fibrillation in 3.2% of previously undiagnosed adults over 65, enabling early stroke prevention.', url: 'https://news.google.com/search?q=wearable+ECG+atrial+fibrillation+patch+screening&hl=en', time: Date.now()/1000-100800, category: 'health', categoryLabel: 'Health & Medicine', accent: 'rose', tags: ['Cardiac','AFib','Wearables'], source: 'aha', sourceLabel: 'Circulation' },
    { id: 'h15', title: 'Stem Cell-Derived Beta Cells Restore Insulin Independence in Type 1 Diabetes', description: 'Encapsulated SC-derived islet cell implants show 90-day insulin independence in six Type 1 diabetic patients in Phase I safety trial.', url: 'https://news.google.com/search?q=stem+cell+beta+cells+insulin+independence+Type1&hl=en', time: Date.now()/1000-108000, category: 'health', categoryLabel: 'Health & Medicine', accent: 'rose', tags: ['Stem Cells','Diabetes','Regenerative Medicine'], source: 'ada', sourceLabel: 'Diabetes Care' },
    { id: 'h16', title: 'Psychedelic-Assisted Therapy Receives Breakthrough Designation for PTSD', description: 'MDMA-assisted psychotherapy shows 67% full PTSD remission in Phase III compared to 32% therapy-alone in combat veterans.', url: 'https://news.google.com/search?q=MDMA+psychedelic+PTSD+therapy+Phase+III+remission&hl=en', time: Date.now()/1000-115200, category: 'health', categoryLabel: 'Health & Medicine', accent: 'rose', tags: ['PTSD','Psychedelic Therapy','Mental Health'], source: 'maps', sourceLabel: 'MAPS' },
    { id: 'h17', title: 'AI Dermatology App Matches Dermatologist Accuracy for 26 Skin Conditions', description: 'Smartphone app using on-device vision model diagnoses melanoma, eczema and psoriasis at specialist-equivalent sensitivity for teledermatology.', url: 'https://news.google.com/search?q=AI+dermatology+app+skin+melanoma+diagnosis&hl=en', time: Date.now()/1000-122400, category: 'health', categoryLabel: 'Health & Medicine', accent: 'rose', tags: ['Dermatology','Telemedicine','AI Diagnosis'], source: 'derm', sourceLabel: 'JAAD' },
    { id: 'h18', title: 'Nasal Spray Naloxone Saves Record 100,000 Opioid Overdose Lives in Single Year', description: 'Broad OTC naloxone availability combined with community distribution programs produces largest single-year overdose reversal on record in US.', url: 'https://news.google.com/search?q=OTC+naloxone+opioid+overdose+reversal+record&hl=en', time: Date.now()/1000-129600, category: 'health', categoryLabel: 'Health & Medicine', accent: 'rose', tags: ['Opioids','Public Health','Emergency Medicine'], source: 'samhsa', sourceLabel: 'SAMHSA' },
    { id: 'h19', title: 'Next-Gen Hearing Aid Uses Neural Processing to Separate Speech from Noise', description: 'EEG-based auditory attention decoding allows hearing aid to amplify the speaker the wearer is focusing on with 94% accuracy.', url: 'https://news.google.com/search?q=neural+hearing+aid+auditory+attention+EEG+speech&hl=en', time: Date.now()/1000-136800, category: 'health', categoryLabel: 'Health & Medicine', accent: 'rose', tags: ['Hearing','Neural Interface','Assistive Tech'], source: 'aud', sourceLabel: 'JASA' },
    { id: 'h20', title: 'HPV Self-Sampling Kits Increase Cervical Cancer Screening by 40% in Rural Areas', description: 'Mail-in self-collection HPV test with AI result reporting closes screening gap in underserved populations previously inaccessible by clinic-based programs.', url: 'https://news.google.com/search?q=HPV+self+sampling+cervical+cancer+screening+rural&hl=en', time: Date.now()/1000-144000, category: 'health', categoryLabel: 'Health & Medicine', accent: 'rose', tags: ['Cervical Cancer','HPV','Global Health'], source: 'who', sourceLabel: 'WHO' },
    { id: 'h21', title: 'Biodegradable Cardiac Stent Fully Absorbed by Body Within 3 Years', description: 'Bioabsorbable vascular scaffold leaves no permanent implant while maintaining patency equivalent to drug-eluting metallic stents through 5-year follow-up.', url: 'https://news.google.com/search?q=biodegradable+cardiac+stent+bioabsorbable+scaffold&hl=en', time: Date.now()/1000-151200, category: 'health', categoryLabel: 'Health & Medicine', accent: 'rose', tags: ['Cardiology','Stent','Interventional'], source: 'acc', sourceLabel: 'JACC' },
    { id: 'h22', title: 'Remote Patient Monitoring Reduces 30-Day Heart Failure Readmissions by 38%', description: 'IoT sensor-based daily weight and bioimpedance monitoring triggers early care team alerts, dramatically cutting costly hospital re-admissions.', url: 'https://news.google.com/search?q=remote+patient+monitoring+heart+failure+readmission+IoT&hl=en', time: Date.now()/1000-158400, category: 'health', categoryLabel: 'Health & Medicine', accent: 'rose', tags: ['Remote Monitoring','Heart Failure','IoT Health'], source: 'hf', sourceLabel: 'ESC Heart Failure' },
    { id: 'h23', title: 'Organoid Drug Screening Platform Cuts Preclinical Failure Rate by Half', description: 'Patient-derived tumor organoids predict clinical drug response with 87% accuracy, saving an estimated $400M per drug program in failed Phase II trials.', url: 'https://news.google.com/search?q=tumor+organoid+drug+screening+preclinical+failure&hl=en', time: Date.now()/1000-165600, category: 'health', categoryLabel: 'Health & Medicine', accent: 'rose', tags: ['Organoids','Drug Discovery','Precision Medicine'], source: 'science', sourceLabel: 'Science Translational Medicine' },
    { id: 'h24', title: 'Gut-Brain Axis Research Reveals Serotonin Link to Irritable Bowel Syndrome', description: 'New mechanistic understanding of enteric neurotransmitter dysregulation opens targeted therapy pathways for 15% of global IBS sufferers.', url: 'https://news.google.com/search?q=gut+brain+axis+serotonin+IBS+irritable+bowel+target&hl=en', time: Date.now()/1000-172800, category: 'health', categoryLabel: 'Health & Medicine', accent: 'rose', tags: ['Gastroenterology','Microbiome','IBS'], source: 'gastro', sourceLabel: 'Gastroenterology' },
    { id: 'h25', title: 'Implantable Brain-Computer Interface Restores Handwriting in Paralyzed Patients', description: 'BrainGate2 neural implant enables paralyzed patients to type 90 characters per minute through imagined handwriting motor cortex decoding.', url: 'https://news.google.com/search?q=BrainGate+BCI+paralysis+handwriting+motor+cortex&hl=en', time: Date.now()/1000-180000, category: 'health', categoryLabel: 'Health & Medicine', accent: 'rose', tags: ['BCI','Paralysis','Neuroprosthetics'], source: 'braingate', sourceLabel: 'BrainGate' },

    // ── PHARMA & BIOTECH (25 items) ───────────────────────────────────────────
    { id: 'p01', title: 'AI-Designed Small Molecule Enters Phase II for Autoimmune Lung Disease', description: 'Insilico Medicine generative AI platform identifies novel IPF candidate with sub-nanomolar engagement in 18 months — record for AI-first drug.', url: 'https://news.google.com/search?q=AI+drug+design+IPF+Insilico+Medicine+Phase+II&hl=en', time: Date.now()/1000-8400, category: 'pharma', categoryLabel: 'Pharma & Biotech', accent: 'emerald', tags: ['AI Drug Design','IPF','Phase II'], source: 'insilico', sourceLabel: 'Insilico Medicine' },
    { id: 'p02', title: 'CRISPR Base Editing Corrects Sickle Cell in Adolescents with Single Dose', description: 'Beam Therapeutics base editing achieves functional cure with >95% BCL11A repression and sustained fetal hemoglobin elevation 18 months post-infusion.', url: 'https://news.google.com/search?q=CRISPR+base+editing+sickle+cell+BCL11A+hemoglobin+cure&hl=en', time: Date.now()/1000-16800, category: 'pharma', categoryLabel: 'Pharma & Biotech', accent: 'emerald', tags: ['Base Editing','Sickle Cell','Gene Therapy'], source: 'beam', sourceLabel: 'Beam Therapeutics' },
    { id: 'p03', title: 'GLP-1 Receptor Agonists Show 28% MACE Reduction Independent of Weight Loss', description: 'Long-term CVOT data reshapes cardiometabolic guidelines — cardioprotection now attributed to pleiotropic effects beyond adiposity reduction.', url: 'https://news.google.com/search?q=GLP1+MACE+cardiovascular+outcomes+cardioprotection+CVOT&hl=en', time: Date.now()/1000-21600, category: 'pharma', categoryLabel: 'Pharma & Biotech', accent: 'emerald', tags: ['GLP-1','Cardiology','Obesity'], source: 'acc', sourceLabel: 'ACC Cardiovascular' },
    { id: 'p04', title: 'Bispecific BCMA×CD3 Antibody Achieves 82% Complete Remission in Myeloma', description: 'Teclistamab data shows unprecedented response rates in triple-class refractory multiple myeloma, redefining end-line treatment options.', url: 'https://news.google.com/search?q=teclistamab+BCMA+CD3+bispecific+myeloma+remission&hl=en', time: Date.now()/1000-28800, category: 'pharma', categoryLabel: 'Pharma & Biotech', accent: 'emerald', tags: ['Bispecific','Multiple Myeloma','Oncology'], source: 'ash', sourceLabel: 'Blood Journal' },
    { id: 'p05', title: 'RNAi Therapy Sustains 70% LDL-C Reduction with Twice-Annual Dosing', description: 'Inclisiran ORION trial 3-year data confirms persistent PCSK9 silencing, making RNA interference competitive with daily oral statins in adherence.', url: 'https://news.google.com/search?q=inclisiran+RNAi+PCSK9+LDL+cholesterol+ORION&hl=en', time: Date.now()/1000-39600, category: 'pharma', categoryLabel: 'Pharma & Biotech', accent: 'emerald', tags: ['RNAi','Cardiovascular','PCSK9'], source: 'alnylam', sourceLabel: 'Alnylam' },
    { id: 'p06', title: 'FDA Grants Accelerated Approval to First Oral KRAS G12C Inhibitor', description: 'Adagrasib data leads to approval for KRAS-mutant NSCLC, validating a target once considered undruggable and opening a $6B annual market.', url: 'https://news.google.com/search?q=adagrasib+KRAS+G12C+inhibitor+FDA+approval+NSCLC&hl=en', time: Date.now()/1000-46800, category: 'pharma', categoryLabel: 'Pharma & Biotech', accent: 'emerald', tags: ['KRAS','Targeted Therapy','NSCLC'], source: 'fda', sourceLabel: 'FDA Oncology' },
    { id: 'p07', title: 'Synthetic Biology Platform Scales Rare Antibiotic Production 10×', description: 'Metabolically engineered E. coli produces teixobactin analogs 10× more efficiently than fermentation, reviving abandoned antibiotic pipelines.', url: 'https://news.google.com/search?q=synthetic+biology+antibiotic+teixobactin+AMR&hl=en', time: Date.now()/1000-54000, category: 'pharma', categoryLabel: 'Pharma & Biotech', accent: 'emerald', tags: ['Synthetic Biology','Antibiotics','AMR'], source: 'synbio', sourceLabel: 'SynBioBeta' },
    { id: 'p08', title: 'PROTAC Protein Degrader Enters Clinic Targeting Oncogenic MYC', description: 'First MYC-targeting PROTAC shows systemic tolerability and tumor volume reduction in primate models, entering Phase I after two decades of failed attempts.', url: 'https://news.google.com/search?q=PROTAC+protein+degrader+MYC+oncology+Phase+I&hl=en', time: Date.now()/1000-61200, category: 'pharma', categoryLabel: 'Pharma & Biotech', accent: 'emerald', tags: ['PROTAC','Targeted Degradation','MYC'], source: 'arvinas', sourceLabel: 'Arvinas' },
    { id: 'p09', title: 'Oral Insulin Capsule Achieves Bioavailability Matching Subcutaneous Injection', description: 'MAPI Pharma polymer-based oral insulin formulation matches injectable pharmacokinetics in Phase I, potentially replacing injections for 500M diabetics.', url: 'https://news.google.com/search?q=oral+insulin+capsule+bioavailability+injection+Phase+I&hl=en', time: Date.now()/1000-68400, category: 'pharma', categoryLabel: 'Pharma & Biotech', accent: 'emerald', tags: ['Oral Insulin','Diabetes','Formulation'], source: 'mapi', sourceLabel: 'MAPI Pharma' },
    { id: 'p10', title: 'Whole-Genome CRISPR Screens Identify 400 Novel Cancer Vulnerability Genes', description: 'Pan-cancer CRISPR dropout screens across 900 cell lines maps previously unknown genetic dependencies, tripling the actionable target landscape.', url: 'https://news.google.com/search?q=CRISPR+genome+wide+screen+cancer+vulnerability+gene&hl=en', time: Date.now()/1000-75600, category: 'pharma', categoryLabel: 'Pharma & Biotech', accent: 'emerald', tags: ['CRISPR Screen','Target ID','Functional Genomics'], source: 'broad', sourceLabel: 'Broad Institute' },
    { id: 'p11', title: 'Radiopharmaceutical PSMA-Targeting Agent Approved for Metastatic Prostate Cancer', description: 'Lu-177 PSMA-617 approval marks validation of targeted radionuclide therapy — analysts project $3B+ annual sales within five years.', url: 'https://news.google.com/search?q=Lu177+PSMA+radiopharmaceutical+prostate+cancer&hl=en', time: Date.now()/1000-82800, category: 'pharma', categoryLabel: 'Pharma & Biotech', accent: 'emerald', tags: ['Radiopharmaceutical','Prostate Cancer','Nuclear Medicine'], source: 'asco', sourceLabel: 'JCO' },
    { id: 'p12', title: 'Machine Learning Predicts Drug-Drug Interactions from Molecular Structure Alone', description: 'Graph neural network trained on 190K known DDI pairs generalizes to novel compound pairs with 91% accuracy, enabling pre-clinical safety screening.', url: 'https://news.google.com/search?q=machine+learning+drug+drug+interaction+prediction&hl=en', time: Date.now()/1000-90000, category: 'pharma', categoryLabel: 'Pharma & Biotech', accent: 'emerald', tags: ['Drug Safety','ML','DDI'], source: 'drugbank', sourceLabel: 'DrugBank' },
    { id: 'p13', title: 'mRNA-Lipid Nanoparticle Platform Extended to Non-Hepatic Tissue Delivery', description: 'Ionizable LNPs with tissue-targeting ligands deliver mRNA to lung, muscle and CNS, broadening the therapeutic scope beyond liver-directed applications.', url: 'https://news.google.com/search?q=mRNA+lipid+nanoparticle+LNP+non+hepatic+tissue+delivery&hl=en', time: Date.now()/1000-97200, category: 'pharma', categoryLabel: 'Pharma & Biotech', accent: 'emerald', tags: ['mRNA','LNP','Drug Delivery'], source: 'moderna', sourceLabel: 'Moderna Science' },
    { id: 'p14', title: 'Single-Cell Transcriptomics Reveals 14 Novel Cell States in Alzheimer\'s Brain', description: 'Human snRNA-seq atlas of 1.4M nuclei from AD patients identifies microglial and astrocyte subpopulations driving disease progression, revealing drug targets.', url: 'https://news.google.com/search?q=single+cell+transcriptomics+Alzheimer+microglia+atlas&hl=en', time: Date.now()/1000-104400, category: 'pharma', categoryLabel: 'Pharma & Biotech', accent: 'emerald', tags: ['Single Cell','Alzheimer\'s','Transcriptomics'], source: 'alzforum', sourceLabel: 'Alzforum' },
    { id: 'p15', title: 'Cell-Free Protein Synthesis Platform Produces GMP Biologics in 24 Hours', description: 'In vitro transcription-translation system produces clinical-grade antibodies and enzymes on demand, disrupting traditional bioreactor timelines.', url: 'https://news.google.com/search?q=cell+free+protein+synthesis+GMP+biologics+bioreactor&hl=en', time: Date.now()/1000-111600, category: 'pharma', categoryLabel: 'Pharma & Biotech', accent: 'emerald', tags: ['Cell-Free Synthesis','Biologics','Biomanufacturing'], source: 'sg', sourceLabel: 'Nature Biotechnology' },
    { id: 'p16', title: 'Antibody-Drug Conjugate with Novel Payload Achieves CR in Platinum-Resistant Ovarian Cancer', description: 'Topoisomerase I inhibitor-bearing ADC demonstrates 47% complete response rate in platinum-resistant ovarian cancer Phase II, a previously untreatable setting.', url: 'https://news.google.com/search?q=ADC+antibody+drug+conjugate+ovarian+cancer+topoisomerase&hl=en', time: Date.now()/1000-118800, category: 'pharma', categoryLabel: 'Pharma & Biotech', accent: 'emerald', tags: ['ADC','Ovarian Cancer','Payload Chemistry'], source: 'az', sourceLabel: 'AstraZeneca Science' },
    { id: 'p17', title: 'Universal CAR-T Platform Uses CRISPR to Remove Alloreactivity for Off-the-Shelf Use', description: 'Allogeneic CAR-T cells with TRAC and HLA-A knockout persist 6+ months without GvHD in Phase I hematologic malignancy trial.', url: 'https://news.google.com/search?q=allogeneic+CAR-T+CRISPR+off+the+shelf+Phase+I&hl=en', time: Date.now()/1000-126000, category: 'pharma', categoryLabel: 'Pharma & Biotech', accent: 'emerald', tags: ['CAR-T','Allogeneic','Cell Therapy'], source: 'caribou', sourceLabel: 'Caribou Biosciences' },
    { id: 'p18', title: 'Epigenetic Clock Biomarkers Enable Precise Biological Age Measurement in Blood', description: 'Methylation-based DNA clock (PhenoAge) surpasses chronological age in predicting all-cause mortality, cardiac events and cancer risk in prospective cohorts.', url: 'https://news.google.com/search?q=epigenetic+clock+biological+age+PhenoAge+methylation&hl=en', time: Date.now()/1000-133200, category: 'pharma', categoryLabel: 'Pharma & Biotech', accent: 'emerald', tags: ['Epigenetics','Aging','Biomarker'], source: 'aging', sourceLabel: 'Aging' },
    { id: 'p19', title: 'NASH Drug Resmetirom Becomes First Approved Non-Alcoholic Steatohepatitis Treatment', description: 'Thyroid hormone receptor-β agonist achieves histological resolution of NASH with no worsening fibrosis — a 30-year unmet medical need fulfilled.', url: 'https://news.google.com/search?q=resmetirom+NASH+MASH+liver+disease+FDA+approval&hl=en', time: Date.now()/1000-140400, category: 'pharma', categoryLabel: 'Pharma & Biotech', accent: 'emerald', tags: ['NASH','MASH','Liver Disease'], source: 'madrigal', sourceLabel: 'Madrigal Pharmaceuticals' },
    { id: 'p20', title: 'AI Protein Structure Prediction Now Covers 98% of Human Proteome at Atomic Resolution', description: 'AlphaFold3 + ESMFold combined database provides high-confidence structures for 20,352 proteins, enabling rational drug design at unprecedented speed.', url: 'https://news.google.com/search?q=AlphaFold3+protein+structure+prediction+proteome&hl=en', time: Date.now()/1000-147600, category: 'pharma', categoryLabel: 'Pharma & Biotech', accent: 'emerald', tags: ['AlphaFold','Protein Structure','AI Biology'], source: 'ebi', sourceLabel: 'EBI AlphaFold' },
    { id: 'p21', title: 'Phage Therapy Rescues Patient from Pan-Drug-Resistant Acinetobacter Infection', description: 'Compassionate use engineered bacteriophage cocktail clears systemic pan-resistant infection unresponsive to 19 antibiotics in a post-surgical patient.', url: 'https://news.google.com/search?q=phage+therapy+Acinetobacter+pan+resistant+infection&hl=en', time: Date.now()/1000-154800, category: 'pharma', categoryLabel: 'Pharma & Biotech', accent: 'emerald', tags: ['Phage Therapy','AMR','Infection'], source: 'ptc', sourceLabel: 'Phage Therapy Center' },
    { id: 'p22', title: 'Induced Pluripotent Stem Cell Retinal Patches Restore Partial Vision in AMD', description: 'iPSC-derived RPE cell sheets transplanted in 12 advanced dry AMD patients show stationary best-corrected visual acuity stabilization at 24 months.', url: 'https://news.google.com/search?q=iPSC+retinal+RPE+AMD+vision+stem+cell+transplant&hl=en', time: Date.now()/1000-162000, category: 'pharma', categoryLabel: 'Pharma & Biotech', accent: 'emerald', tags: ['iPSC','AMD','Ophthalmology'], source: 'riken', sourceLabel: 'RIKEN CDB' },
    { id: 'p23', title: 'Microfluidic Organ-on-Chip Platform Gains Regulatory Acceptance for Toxicity Testing', description: 'FDA accepts organ-on-chip liver-kidney microphysiological data as standalone pivotal toxicity evidence, reducing reliance on animal studies.', url: 'https://news.google.com/search?q=organ+on+chip+FDA+toxicity+testing+microphysiological&hl=en', time: Date.now()/1000-169200, category: 'pharma', categoryLabel: 'Pharma & Biotech', accent: 'emerald', tags: ['Organ-on-Chip','Toxicology','FDA'], source: 'emulate', sourceLabel: 'Emulate Bio' },
    { id: 'p24', title: 'First Oral PCSK9 Inhibitor Achieves Phase III Non-Inferiority to Injectable Evolocumab', description: 'Once-daily oral small molecule matching monthly injectable LDL-C reduction marks potential paradigm shift in lipid management adherence.', url: 'https://news.google.com/search?q=oral+PCSK9+inhibitor+LDL+Phase+III+Evolocumab&hl=en', time: Date.now()/1000-176400, category: 'pharma', categoryLabel: 'Pharma & Biotech', accent: 'emerald', tags: ['PCSK9','Oral Therapy','Lipids'], source: 'lilly', sourceLabel: 'Eli Lilly' },
    { id: 'p25', title: 'Nanotechnology Drug-Eluting Implant Provides 6-Month Contraception with Single Insertion', description: 'Biodegradable PLGA nanoparticle implant delivers levonorgestrel at zero-order kinetics for 180 days — a potential solution for LARC access gap.', url: 'https://news.google.com/search?q=PLGA+nanoparticle+implant+contraception+levonorgestrel&hl=en', time: Date.now()/1000-183600, category: 'pharma', categoryLabel: 'Pharma & Biotech', accent: 'emerald', tags: ['Contraception','LARC','Nanomedicine'], source: 'contraline', sourceLabel: 'Contraline' },

    // ── LAW & LEGAL (25 items) ────────────────────────────────────────────────
    { id: 'l01', title: 'EU AI Act Enforcement Begins: High-Risk System Registry Now Mandatory', description: 'Companies deploying AI in healthcare, education and critical infrastructure must register with EU oversight bodies or face 6% global revenue fines.', url: 'https://news.google.com/search?q=EU+AI+Act+enforcement+high+risk+AI+registry+compliance&hl=en', time: Date.now()/1000-9000, category: 'law', categoryLabel: 'Law & Legal', accent: 'amber', tags: ['EU AI Act','Compliance','Regulation'], source: 'eu', sourceLabel: 'EU Digital Strategy' },
    { id: 'l02', title: 'US Supreme Court Rules AI-Generated Works Not Eligible for Copyright Protection', description: 'Landmark ruling determines AI outputs lacking human creative expression fall outside Copyright Act scope, reshaping IP strategy for generative AI companies.', url: 'https://news.google.com/search?q=US+Supreme+Court+AI+copyright+generative+AI+works&hl=en', time: Date.now()/1000-19800, category: 'law', categoryLabel: 'Law & Legal', accent: 'amber', tags: ['Copyright','AI Law','IP'], source: 'scotus', sourceLabel: 'SCOTUSblog' },
    { id: 'l03', title: 'SEC Mandates Cyber Incident Disclosure Within 4 Business Days for Public Companies', description: 'New rules require material cybersecurity incident disclosure and annual board-level cybersecurity expertise reporting for all SEC registrants.', url: 'https://news.google.com/search?q=SEC+cybersecurity+incident+disclosure+4+day+rule&hl=en', time: Date.now()/1000-27000, category: 'law', categoryLabel: 'Law & Legal', accent: 'amber', tags: ['Cybersecurity','SEC','Disclosure'], source: 'sec', sourceLabel: 'SEC.gov' },
    { id: 'l04', title: 'Smart Contracts Legally Enforceable in Seven US States After New Legislation', description: 'Nevada, Wyoming, Tennessee, and four others pass legislation recognizing blockchain-based smart contracts as fully valid legal agreements.', url: 'https://news.google.com/search?q=smart+contracts+legally+enforceable+US+states+blockchain+law&hl=en', time: Date.now()/1000-34200, category: 'law', categoryLabel: 'Law & Legal', accent: 'amber', tags: ['Smart Contracts','Blockchain Law','Legal Tech'], source: 'uniform', sourceLabel: 'Uniform Law Commission' },
    { id: 'l05', title: 'GDPR vs CCPA vs DPDP: Global Privacy Framework Divergence Accelerates', description: 'Comparative analysis of 18 national privacy regimes reveals growing divergence on consent standards, children\'s data and cross-border transfer.', url: 'https://news.google.com/search?q=GDPR+CCPA+DPDP+privacy+law+global+comparison&hl=en', time: Date.now()/1000-41400, category: 'law', categoryLabel: 'Law & Legal', accent: 'amber', tags: ['Privacy Law','GDPR','CCPA'], source: 'iapp', sourceLabel: 'IAPP' },
    { id: 'l06', title: 'India DPDP Act Rules Published: 12-Month Compliance Window for Businesses', description: 'Final rules specify consent mechanisms, data fiduciary obligations and a tiered penalty structure of up to ₹250 crore for significant violations.', url: 'https://news.google.com/search?q=India+DPDP+Act+rules+compliance+data+fiduciary&hl=en', time: Date.now()/1000-48600, category: 'law', categoryLabel: 'Law & Legal', accent: 'amber', tags: ['DPDP','India','Data Privacy'], source: 'meity', sourceLabel: 'MeitY India' },
    { id: 'l07', title: 'Post-Microsoft Ruling: FTC Signals Strict Review of Platform-to-Platform Acquisitions', description: 'Following blocked Adobe-Figma deal, FTC issues guidance that acquirer\'s platform dominance will receive heightened Section 7 Clayton Act scrutiny.', url: 'https://news.google.com/search?q=FTC+antitrust+platform+acquisition+Adobe+Figma+merger&hl=en', time: Date.now()/1000-55800, category: 'law', categoryLabel: 'Law & Legal', accent: 'amber', tags: ['Antitrust','FTC','M&A'], source: 'ftc', sourceLabel: 'FTC.gov' },
    { id: 'l08', title: 'EU AI Liability Directive Draft Proposes Strict Liability for Autonomous Systems', description: 'Proposed directive imposes strict liability (no fault required) for damage caused by AI in medical, transport and safety-critical high-risk categories.', url: 'https://news.google.com/search?q=EU+AI+liability+directive+strict+liability+autonomous+systems&hl=en', time: Date.now()/1000-63000, category: 'law', categoryLabel: 'Law & Legal', accent: 'amber', tags: ['AI Liability','EU Law','Product Liability'], source: 'eu', sourceLabel: 'EU Commission' },
    { id: 'l09', title: 'First Deepfake Prosecution Secures Criminal Conviction Under New State Law', description: 'California\'s AB 602 produces first felony conviction for election-related deepfake creation, establishing precedent for AI-generated misinformation enforcement.', url: 'https://news.google.com/search?q=deepfake+criminal+conviction+California+AB602+election&hl=en', time: Date.now()/1000-70200, category: 'law', categoryLabel: 'Law & Legal', accent: 'amber', tags: ['Deepfake','AI Crime','Election Law'], source: 'ca', sourceLabel: 'California Legislature' },
    { id: 'l10', title: 'Global Minimum Corporate Tax Treaty Enters Force in 136 Participating Countries', description: 'OECD Pillar Two 15% global minimum tax now operational, closing historical offshore profit-shifting loopholes for multinational corporations.', url: 'https://news.google.com/search?q=OECD+Pillar+Two+15+percent+global+minimum+corporate+tax&hl=en', time: Date.now()/1000-77400, category: 'law', categoryLabel: 'Law & Legal', accent: 'amber', tags: ['Tax Law','OECD','Corporate Tax'], source: 'oecd', sourceLabel: 'OECD' },
    { id: 'l11', title: 'EU Product Liability Directive Extends to Software and AI Defects', description: 'Revised PLD for the first time explicitly covers damage caused by defective software, AI components and digital services — closing a decades-old loophole.', url: 'https://news.google.com/search?q=EU+product+liability+directive+software+AI+defects&hl=en', time: Date.now()/1000-84600, category: 'law', categoryLabel: 'Law & Legal', accent: 'amber', tags: ['Product Liability','Software Law','EU'], source: 'eurlex', sourceLabel: 'EUR-Lex' },
    { id: 'l12', title: 'Algorithmic Wage Discrimination Case Sets Precedent for AI Employment Law', description: 'Federal court rules that opaque gig platform surge pricing algorithm constitutes disparate impact discrimination under Title VII of Civil Rights Act.', url: 'https://news.google.com/search?q=gig+platform+algorithm+discrimination+Title+VII&hl=en', time: Date.now()/1000-91800, category: 'law', categoryLabel: 'Law & Legal', accent: 'amber', tags: ['Employment Law','Algorithmic Bias','Civil Rights'], source: 'eeoc', sourceLabel: 'EEOC' },
    { id: 'l13', title: 'Cross-Border Data Flow Frameworks: Adequacy Decisions Accelerate Post-Schrems II', description: 'New EU-US Data Privacy Framework survives first legal challenge; EU-India adequacy negotiations enter final stage with binding commitment exchange.', url: 'https://news.google.com/search?q=EU+US+data+privacy+framework+adequacy+Schrems&hl=en', time: Date.now()/1000-99000, category: 'law', categoryLabel: 'Law & Legal', accent: 'amber', tags: ['Data Transfers','Adequacy','EU-US Privacy'], source: 'edps', sourceLabel: 'EDPS' },
    { id: 'l14', title: 'Generative AI Training Data Lawsuits Move Toward Class Certification', description: 'Author and visual artist class action suits against OpenAI and Stability AI proceed to class certification stage, with potential damages in billions.', url: 'https://news.google.com/search?q=OpenAI+training+data+lawsuit+class+action+copyright&hl=en', time: Date.now()/1000-106200, category: 'law', categoryLabel: 'Law & Legal', accent: 'amber', tags: ['AI Training','Copyright Litigation','Generative AI'], source: 'aba', sourceLabel: 'ABA Journal' },
    { id: 'l15', title: 'Mandatory Human Review Requirement for High-Stakes Automated Decisions Proposed', description: 'EU Digital Rights Act amendment requires meaningful human oversight and appeal mechanisms for AI decisions affecting employment, credit and housing.', url: 'https://news.google.com/search?q=EU+human+review+AI+automated+decision+employment&hl=en', time: Date.now()/1000-113400, category: 'law', categoryLabel: 'Law & Legal', accent: 'amber', tags: ['AI Rights','Human Oversight','Digital Rights'], source: 'ep', sourceLabel: 'European Parliament' },
    { id: 'l16', title: 'Biometric Data Protection Laws Expand to Cover Behavioral and Emotional AI Analytics', description: 'Illinois BIPA amendments extend biometric identifier definition to gait analysis, voice patterns and emotion recognition software outputs.', url: 'https://news.google.com/search?q=Illinois+BIPA+biometric+AI+emotion+gait+voice&hl=en', time: Date.now()/1000-120600, category: 'law', categoryLabel: 'Law & Legal', accent: 'amber', tags: ['Biometrics','BIPA','Privacy'], source: 'ilga', sourceLabel: 'Illinois GA' },
    { id: 'l17', title: 'Autonomous Vehicle Accident Liability Framework Finalized in 12 US States', description: 'Uniform AV liability standard assigns manufacturer responsibility for Level 4+ crashes, removing the current patchwork of contradictory state rules.', url: 'https://news.google.com/search?q=autonomous+vehicle+liability+Level+4+manufacturer&hl=en', time: Date.now()/1000-127800, category: 'law', categoryLabel: 'Law & Legal', accent: 'amber', tags: ['Autonomous Vehicles','Liability','Transportation Law'], source: 'nhtsa', sourceLabel: 'NHTSA' },
    { id: 'l18', title: 'Whistleblower Protections for AI Safety Concerns Extended Under New Federal Rules', description: 'Federal AI Whistleblower Act provides protections for employees reporting unsafe AI development practices at frontier AI labs and contractors.', url: 'https://news.google.com/search?q=AI+safety+whistleblower+protection+federal+law&hl=en', time: Date.now()/1000-135000, category: 'law', categoryLabel: 'Law & Legal', accent: 'amber', tags: ['AI Safety','Whistleblower','Labor Law'], source: 'osha', sourceLabel: 'OSHA' },
    { id: 'l19', title: 'WTO E-Commerce Negotiations Stall on Digital Services Tax Moratorium', description: '107-nation moratorium on customs duties on electronic transmissions expires amid disagreement, raising uncertainty for global SaaS and streaming services.', url: 'https://news.google.com/search?q=WTO+e-commerce+digital+tax+moratorium+SaaS&hl=en', time: Date.now()/1000-142200, category: 'law', categoryLabel: 'Law & Legal', accent: 'amber', tags: ['WTO','Digital Trade','E-Commerce Law'], source: 'wto', sourceLabel: 'WTO' },
    { id: 'l20', title: 'Space Law Treaty Updated for Lunar Resource Rights and Private Operator Liability', description: 'Artemis Accords signatory nations ratify updated framework governing private extraction rights, damage liability and orbital debris responsibility.', url: 'https://news.google.com/search?q=Artemis+Accords+lunar+resources+space+law&hl=en', time: Date.now()/1000-149400, category: 'law', categoryLabel: 'Law & Legal', accent: 'amber', tags: ['Space Law','Lunar Resources','International Law'], source: 'state', sourceLabel: 'US State Department' },
    { id: 'l21', title: 'Digital Will and Estate Planning Framework Passed for Crypto and NFT Assets', description: 'Revised Uniform Fiduciary Access to Digital Assets Act now covers private keys, DeFi positions, and NFT collections in probate proceedings.', url: 'https://news.google.com/search?q=digital+estate+crypto+NFT+DeFi+probate+digital+will&hl=en', time: Date.now()/1000-156600, category: 'law', categoryLabel: 'Law & Legal', accent: 'amber', tags: ['Estate Law','Crypto','Digital Assets'], source: 'uniform', sourceLabel: 'Uniform Law Commission' },
    { id: 'l22', title: 'Environmental DNA Admissibility Debated in Wildlife Crime Prosecutions', description: 'Courts grapple with admissibility standards for eDNA evidence in poaching and illegal logging cases as environmental forensics matures rapidly.', url: 'https://news.google.com/search?q=eDNA+environmental+DNA+admissibility+wildlife+crime&hl=en', time: Date.now()/1000-163800, category: 'law', categoryLabel: 'Law & Legal', accent: 'amber', tags: ['Environmental Law','Forensics','eDNA'], source: 'cornell', sourceLabel: 'Cornell LII' },
    { id: 'l23', title: 'Non-Compete Clause Federal Ban Partially Reinstated After Circuit Court Split', description: 'FTC non-compete ban covering 30M workers faces circuit split; Supreme Court likely to settle enforceability with massive implications for talent mobility.', url: 'https://news.google.com/search?q=FTC+non+compete+ban+circuit+split+Supreme+Court&hl=en', time: Date.now()/1000-171000, category: 'law', categoryLabel: 'Law & Legal', accent: 'amber', tags: ['Non-Compete','FTC','Employment'], source: 'ftc', sourceLabel: 'FTC.gov' },
    { id: 'l24', title: 'Ransomware Payment Prohibition Bill Advances in Senate Judiciary Committee', description: 'Proposed legislation banning ransom payments to sanctioned entities would force ransomware incident reporting to CISA within 24 hours of attack.', url: 'https://news.google.com/search?q=ransomware+payment+ban+CISA+sanctioned+entities+Senate&hl=en', time: Date.now()/1000-178200, category: 'law', categoryLabel: 'Law & Legal', accent: 'amber', tags: ['Ransomware','Cybersecurity Law','CISA'], source: 'senate', sourceLabel: 'Senate Judiciary' },
    { id: 'l25', title: 'International Criminal Court Issues Arrest Warrant for Autonomous Weapons Use', description: 'Historic ICC decision finds commander use of fully autonomous lethal weapons without meaningful human control constitutes a war crime under Geneva Conventions.', url: 'https://news.google.com/search?q=ICC+autonomous+weapons+war+crime+Geneva+Conventions&hl=en', time: Date.now()/1000-185400, category: 'law', categoryLabel: 'Law & Legal', accent: 'amber', tags: ['Autonomous Weapons','IHL','War Crimes'], source: 'icc', sourceLabel: 'ICC' },

    // ── BUSINESS & FINANCE (25 items) ─────────────────────────────────────────
    { id: 'b01', title: 'Agentic AI Startup Funding Hits $8.4B in Q2 — Tripling Year-Over-Year', description: 'Autonomous AI agent startups attract record VC with multi-agent orchestration platforms and vertical AI workflows leading category deal flow.', url: 'https://news.google.com/search?q=agentic+AI+startup+funding+autonomous+agent+VC&hl=en', time: Date.now()/1000-6000, category: 'business', categoryLabel: 'Business & Finance', accent: 'cyan', tags: ['AI Agents','VC Funding','Startup'], source: 'tc', sourceLabel: 'TechCrunch' },
    { id: 'b02', title: 'India Surpasses UK as World\'s Fifth Largest Stock Market by Capitalization', description: 'NSE-BSE combined cap crosses $5T driven by domestic institutional inflows, manufacturing FDI boom and retail investor participation surge.', url: 'https://news.google.com/search?q=India+stock+market+NSE+BSE+capitalization+UK&hl=en', time: Date.now()/1000-14400, category: 'business', categoryLabel: 'Business & Finance', accent: 'cyan', tags: ['India Markets','Equities','Emerging Markets'], source: 'ft', sourceLabel: 'Financial Times' },
    { id: 'b03', title: 'Global Stablecoin Market Cap Reaches $250B as Enterprise Adoption Accelerates', description: 'PayPal, Stripe and Visa now support stablecoin settlement rails legitimizing programmable money for corporate treasury and cross-border payments.', url: 'https://news.google.com/search?q=stablecoin+market+cap+PayPal+Stripe+Visa+enterprise&hl=en', time: Date.now()/1000-22800, category: 'business', categoryLabel: 'Business & Finance', accent: 'cyan', tags: ['Stablecoin','Fintech','Crypto'], source: 'coindesk', sourceLabel: 'CoinDesk' },
    { id: 'b04', title: 'Climate Tech VC Investment Surges 42% YoY Despite Broader Market Slowdown', description: 'Battery storage, green hydrogen and industrial decarbonization attract outsized capital as IRA tailwinds, EU Green Deal and carbon pricing strengthen.', url: 'https://news.google.com/search?q=climate+tech+VC+investment+green+hydrogen+battery&hl=en', time: Date.now()/1000-30600, category: 'business', categoryLabel: 'Business & Finance', accent: 'cyan', tags: ['Climate Tech','Green Energy','VC'], source: 'bloomberg', sourceLabel: 'Bloomberg Green' },
    { id: 'b05', title: 'Cross-Border CBDC Pilot Completes 4-Second Settlement Between Six Central Banks', description: 'Project mBridge multi-CBDC transactions demonstrate sub-4 second finality vs 3-5 day SWIFT wires, with BIS Innovation Hub scaling to 20 more nations.', url: 'https://news.google.com/search?q=mBridge+CBDC+cross+border+settlement+BIS&hl=en', time: Date.now()/1000-38400, category: 'business', categoryLabel: 'Business & Finance', accent: 'cyan', tags: ['CBDC','Digital Currency','BIS'], source: 'bis', sourceLabel: 'BIS' },
    { id: 'b06', title: 'Revenue-Based Financing Platforms Grow 60% as Founders Resist Equity Dilution', description: 'SaaS and e-commerce startups increasingly choose RBF over traditional Series A, with AI-underwritten risk models enabling faster, larger funding decisions.', url: 'https://news.google.com/search?q=revenue+based+financing+RBF+SaaS+startup+dilution&hl=en', time: Date.now()/1000-45600, category: 'business', categoryLabel: 'Business & Finance', accent: 'cyan', tags: ['RBF','SaaS Finance','Startups'], source: 'axios', sourceLabel: 'Axios' },
    { id: 'b07', title: 'Gen Z Entrepreneurs Launch Average 1.8 Businesses Before Age 25', description: 'Survey of 10,000 Gen Z founders shows 73% prefer bootstrapping; AI tools cited as primary enabler of solo-founder viability at unprecedented scale.', url: 'https://news.google.com/search?q=Gen+Z+entrepreneurs+bootstrapping+AI+solo+founder&hl=en', time: Date.now()/1000-52800, category: 'business', categoryLabel: 'Business & Finance', accent: 'cyan', tags: ['Gen Z','Entrepreneurship','Bootstrapping'], source: 'inc', sourceLabel: 'Inc. Magazine' },
    { id: 'b08', title: 'ESG Reporting Mandates Force 3,000 Companies to Disclose Scope 3 Supply-Chain Emissions', description: 'SEC climate disclosure rules take effect requiring Scope 3 tracking that companies say represents 70-90% of their total carbon footprint.', url: 'https://news.google.com/search?q=SEC+climate+disclosure+Scope+3+emissions+supply+chain&hl=en', time: Date.now()/1000-60000, category: 'business', categoryLabel: 'Business & Finance', accent: 'cyan', tags: ['ESG','Climate Disclosure','SEC'], source: 'wsj', sourceLabel: 'Wall Street Journal' },
    { id: 'b09', title: 'Private Credit Surpasses $2T Globally as Banks Retreat from Middle Market Lending', description: 'Alternative asset managers fill corporate lending void left by Basel IV tightening, offering flexible covenants attractive to growth-stage borrowers.', url: 'https://news.google.com/search?q=private+credit+$2+trillion+Basel+IV+middle+market&hl=en', time: Date.now()/1000-67200, category: 'business', categoryLabel: 'Business & Finance', accent: 'cyan', tags: ['Private Credit','Alternative Assets','Lending'], source: 'bloomberg', sourceLabel: 'Bloomberg Markets' },
    { id: 'b10', title: 'AI-Powered CFO Tools Automate 70% of Month-End Close in Mid-Market Companies', description: 'AI financial close platforms reduce 10-day accounting cycles to 3 days, pushing Big 4 audit firms to rapidly develop AI-native audit methodologies.', url: 'https://news.google.com/search?q=AI+CFO+month+end+close+accounting+automation+Big4&hl=en', time: Date.now()/1000-74400, category: 'business', categoryLabel: 'Business & Finance', accent: 'cyan', tags: ['AI Finance','CFO Tech','Accounting'], source: 'cfo', sourceLabel: 'CFO Dive' },
    { id: 'b11', title: 'Fractional Ownership Platforms Enable Real Estate Investing from $100', description: 'Tokenized real estate allows retail investors to purchase fractional interests in commercial properties, with $4B transacted in past 12 months.', url: 'https://news.google.com/search?q=fractional+real+estate+tokenization+retail+investor&hl=en', time: Date.now()/1000-81600, category: 'business', categoryLabel: 'Business & Finance', accent: 'cyan', tags: ['Real Estate','Tokenization','Fractional Ownership'], source: 'mogul', sourceLabel: 'RealtyMogul' },
    { id: 'b12', title: 'Supply Chain AI Reduces Inventory Costs by $80B Across Fortune 500', description: 'ML demand forecasting and autonomous procurement systems eliminate overstocking that caused 2022-era margin compression across consumer goods and retail.', url: 'https://news.google.com/search?q=supply+chain+AI+inventory+cost+reduction+forecasting&hl=en', time: Date.now()/1000-88800, category: 'business', categoryLabel: 'Business & Finance', accent: 'cyan', tags: ['Supply Chain','AI Operations','Inventory'], source: 'mckinsey', sourceLabel: 'McKinsey & Co' },
    { id: 'b13', title: 'B-Corp Certification Standards Tightened With Mandatory Third-Party Impact Audit', description: 'B Lab revises certification requiring biennial third-party audits of environmental and social impact claims, ending self-reported greenwashing.', url: 'https://news.google.com/search?q=B+Corp+certification+third+party+audit+greenwashing&hl=en', time: Date.now()/1000-96000, category: 'business', categoryLabel: 'Business & Finance', accent: 'cyan', tags: ['B-Corp','Impact Investing','ESG'], source: 'bcorp', sourceLabel: 'B Lab' },
    { id: 'b14', title: 'Embedded Finance Market Hits $185B — Banking-as-a-Service Becomes Infra Layer', description: 'Non-bank brands now offer insurance, lending and investment products via API-connected BaaS rails, creating trillion-dollar embedded finance ecosystem.', url: 'https://news.google.com/search?q=embedded+finance+BaaS+banking+as+a+service&hl=en', time: Date.now()/1000-103200, category: 'business', categoryLabel: 'Business & Finance', accent: 'cyan', tags: ['Embedded Finance','BaaS','Fintech'], source: 'fintech', sourceLabel: 'Fintech News' },
    { id: 'b15', title: 'Africa Emerges as World\'s Fastest-Growing Startup Ecosystem with 47% YoY Growth', description: 'Nigeria, Kenya, Egypt and South Africa drive continental tech boom with fintech, agritech and health-tech attracting record cross-border investment.', url: 'https://news.google.com/search?q=Africa+startup+ecosystem+investment+fintech+healthtech&hl=en', time: Date.now()/1000-110400, category: 'business', categoryLabel: 'Business & Finance', accent: 'cyan', tags: ['Africa Tech','Emerging Markets','Startup'], source: 'disrupt', sourceLabel: 'Disrupt Africa' },
    { id: 'b16', title: 'AI-First Management Consultancies Undercut McKinsey with 10× Delivery Speed', description: 'New AI-native advisory firms deliver strategy projects in days rather than months, challenging traditional consulting economics and talent models.', url: 'https://news.google.com/search?q=AI+management+consulting+McKinsey+disruption+speed&hl=en', time: Date.now()/1000-117600, category: 'business', categoryLabel: 'Business & Finance', accent: 'cyan', tags: ['Consulting','AI Strategy','Future of Work'], source: 'hbr', sourceLabel: 'Harvard Business Review' },
    { id: 'b17', title: 'Quantum Computing Cloud Access Revenue Surpasses $1B for First Time', description: 'IBM, IonQ and Quantinuum cloud revenue milestone reflects growing enterprise demand for quantum simulation in chemistry, materials and logistics.', url: 'https://news.google.com/search?q=quantum+computing+cloud+revenue+billion+IBM+IonQ&hl=en', time: Date.now()/1000-124800, category: 'business', categoryLabel: 'Business & Finance', accent: 'cyan', tags: ['Quantum Computing','Cloud','Enterprise Tech'], source: 'ibm', sourceLabel: 'IBM Research' },
    { id: 'b18', title: 'Creator Economy Reaches $500B as Brand Spend Shifts to Influencer Channels', description: 'Ad agency holding companies acquire influencer platforms as 78% of Gen Z trust peer creators over traditional advertising, reshaping media buying.', url: 'https://news.google.com/search?q=creator+economy+influencer+brand+spend+Gen+Z&hl=en', time: Date.now()/1000-132000, category: 'business', categoryLabel: 'Business & Finance', accent: 'cyan', tags: ['Creator Economy','Influencer Marketing','Media'], source: 'ciq', sourceLabel: 'CreatorIQ' },
    { id: 'b19', title: 'Sovereign Wealth Funds Pivot 30% of Portfolios to AI and Digital Infrastructure', description: 'Gulf, Norwegian and Singapore sovereign funds accelerate digital asset allocation including data centers, semiconductor fabs and AI compute capacity.', url: 'https://news.google.com/search?q=sovereign+wealth+fund+AI+digital+infrastructure+data+center&hl=en', time: Date.now()/1000-139200, category: 'business', categoryLabel: 'Business & Finance', accent: 'cyan', tags: ['Sovereign Wealth','Digital Infrastructure','AI Investment'], source: 'swfi', sourceLabel: 'SWFI' },
    { id: 'b20', title: 'Carbon Credit Voluntary Market Reforms Restore Buyer Confidence After 2023 Crash', description: 'ICVCM Core Carbon Principles now mandatory for listed credits, retiring 40% of low-quality offsets and restoring institutional carbon market participation.', url: 'https://news.google.com/search?q=carbon+credit+market+ICVCM+voluntary+reform&hl=en', time: Date.now()/1000-146400, category: 'business', categoryLabel: 'Business & Finance', accent: 'cyan', tags: ['Carbon Credits','Climate Finance','ESG'], source: 'icvcm', sourceLabel: 'ICVCM' },
    { id: 'b21', title: 'Decentralized Autonomous Organizations Gain Legal Standing in Four Jurisdictions', description: 'Wyoming DAO LLC, Marshall Islands, UK LLP adaptations and Switzerland foundations now offer DAOs legally recognized entity status with liability protection.', url: 'https://news.google.com/search?q=DAO+legal+standing+Wyoming+blockchain+legal+entity&hl=en', time: Date.now()/1000-153600, category: 'business', categoryLabel: 'Business & Finance', accent: 'cyan', tags: ['DAO','Web3','Legal Entity'], source: 'coinbase', sourceLabel: 'Coinbase' },
    { id: 'b22', title: 'Manufacturing Reshoring Wave Creates 850,000 New US Industrial Jobs in Two Years', description: 'CHIPS Act, IRA incentives and geopolitical supply chain risk mitigation drive record near-shoring investments in semiconductor, EV and pharma manufacturing.', url: 'https://news.google.com/search?q=manufacturing+reshoring+US+jobs+CHIPS+Act+IRA&hl=en', time: Date.now()/1000-160800, category: 'business', categoryLabel: 'Business & Finance', accent: 'cyan', tags: ['Reshoring','Manufacturing','US Jobs'], source: 'nab', sourceLabel: 'NAM' },
    { id: 'b23', title: 'Open Banking APIs Enable 40M New Customers to Access Credit Via Alternative Scoring', description: 'Cash-flow underwriting via open banking data unlocks credit access for thin-file consumers previously excluded by FICO-only lending decisions.', url: 'https://news.google.com/search?q=open+banking+alternative+credit+scoring+thin+file&hl=en', time: Date.now()/1000-168000, category: 'business', categoryLabel: 'Business & Finance', accent: 'cyan', tags: ['Open Banking','Credit Access','Fintech'], source: 'plaid', sourceLabel: 'Plaid' },
    { id: 'b24', title: 'Retail Investors Now Hold 25% of US Equity Market — Highest Share Since 1950s', description: 'Commission-free trading platforms and fractional shares democratize equity participation; retail flows now statistically significant in mid-cap price discovery.', url: 'https://news.google.com/search?q=retail+investor+US+equity+market+share+record&hl=en', time: Date.now()/1000-175200, category: 'business', categoryLabel: 'Business & Finance', accent: 'cyan', tags: ['Retail Investing','Market Structure','Equities'], source: 'vc', sourceLabel: 'Visual Capitalist' },
    { id: 'b25', title: 'AI-Driven Dynamic Pricing Models Raise Airline Revenue 18% While Cutting Overbooking', description: 'Revenue management AI with real-time demand elasticity modeling optimizes yield without the denied-boarding incidents of legacy overbooking strategies.', url: 'https://news.google.com/search?q=AI+dynamic+pricing+airline+revenue+yield+overbooking&hl=en', time: Date.now()/1000-182400, category: 'business', categoryLabel: 'Business & Finance', accent: 'cyan', tags: ['Dynamic Pricing','AI Revenue','Aviation'], source: 'a4a', sourceLabel: 'Airlines for America' },

    // ── DESIGN & CREATIVE (25 items) ──────────────────────────────────────────
    { id: 'd01', title: 'Figma AI Auto-Generates Full Component Libraries from Single Wireframe', description: 'New Figma AI feature creates brand-consistent component systems with variants, states and responsive behaviors from rough hand-drawn sketches.', url: 'https://news.google.com/search?q=Figma+AI+component+library+wireframe+design+system&hl=en', time: Date.now()/1000-11000, category: 'design', categoryLabel: 'Design & Creative', accent: 'indigo', tags: ['AI Design','Figma','Design Systems'], source: 'figma', sourceLabel: 'Figma Blog' },
    { id: 'd02', title: 'Spatial Computing Design Patterns for Apple Vision Pro Standardized in HIG v3', description: 'Apple HIG v3 defines depth, gaze and gesture interaction paradigms, spatial windows, and volumetric UI component specifications for visionOS.', url: 'https://news.google.com/search?q=Apple+Vision+Pro+HIG+spatial+design+visionOS&hl=en', time: Date.now()/1000-20800, category: 'design', categoryLabel: 'Design & Creative', accent: 'indigo', tags: ['Spatial UI','VisionOS','HIG'], source: 'apple', sourceLabel: 'Apple HIG' },
    { id: 'd03', title: 'CSS Grid Level 3 Masonry Layout Now Baseline-Stable Across All Browsers', description: 'Masonry layout and container style queries achieve full cross-browser support, ending the last major CSS layout inconsistencies on the web platform.', url: 'https://news.google.com/search?q=CSS+Grid+masonry+layout+baseline+cross+browser&hl=en', time: Date.now()/1000-29600, category: 'design', categoryLabel: 'Design & Creative', accent: 'indigo', tags: ['CSS','Web Standards','Frontend'], source: 'webdev', sourceLabel: 'web.dev' },
    { id: 'd04', title: 'Adobe Substance AI Generates PBR Textures in 300ms for 3D Production', description: 'Physically accurate texture generation replaces hours of manual material authoring for AAA game studios and VFX pipelines at 8K resolution.', url: 'https://news.google.com/search?q=Adobe+Substance+AI+texture+generation+PBR+3D+VFX&hl=en', time: Date.now()/1000-37200, category: 'design', categoryLabel: 'Design & Creative', accent: 'indigo', tags: ['3D Design','AI Textures','VFX'], source: 'adobe', sourceLabel: 'Adobe Substance' },
    { id: 'd05', title: 'Purposeful Motion Design Improves Task Completion by 18% in User Research', description: 'Study with 2,000 users shows UI transitions conveying spatial relationships outperform decorative animations by 18% on task completion metrics.', url: 'https://news.google.com/search?q=motion+design+UI+animation+task+completion+UX&hl=en', time: Date.now()/1000-44800, category: 'design', categoryLabel: 'Design & Creative', accent: 'indigo', tags: ['Motion Design','UX Research','Animation'], source: 'uxcc', sourceLabel: 'UX Collective' },
    { id: 'd06', title: 'Variable Fonts Adoption Hits 60% of Top 10,000 Websites', description: 'Variable fonts reduce font file payload by 50% while enabling fluid responsive type scales, driving rapid adoption in performance-conscious builds.', url: 'https://news.google.com/search?q=variable+fonts+adoption+web+performance+typography&hl=en', time: Date.now()/1000-52000, category: 'design', categoryLabel: 'Design & Creative', accent: 'indigo', tags: ['Typography','Variable Fonts','Web Perf'], source: 'google', sourceLabel: 'Google Fonts' },
    { id: 'd07', title: 'W3C Design Tokens Standard Adopted by Figma, Storybook and Style Dictionary', description: 'Design Token Community Group format becomes the de facto interoperability layer between design tools and component libraries across the web ecosystem.', url: 'https://news.google.com/search?q=W3C+design+tokens+standard+Figma+Storybook&hl=en', time: Date.now()/1000-59200, category: 'design', categoryLabel: 'Design & Creative', accent: 'indigo', tags: ['Design Tokens','W3C','Design Systems'], source: 'w3c', sourceLabel: 'W3C Community' },
    { id: 'd08', title: 'Dark Mode Best Practices: Why Color Inversion Fails and What Actually Works', description: 'Luminosity ratios, surface elevation systems and semantic color roles are the real differentiators between polished dark UIs and poor inversions.', url: 'https://news.google.com/search?q=dark+mode+UI+design+best+practices+color+theory&hl=en', time: Date.now()/1000-66400, category: 'design', categoryLabel: 'Design & Creative', accent: 'indigo', tags: ['Dark Mode','Color Theory','Accessibility'], source: 'smashing', sourceLabel: 'Smashing Magazine' },
    { id: 'd09', title: 'WCAG 3.0 Introduces APCA Contrast Model Replacing 20-Year-Old Algorithm', description: 'Advanced Perceptual Contrast Algorithm replaces the WCAG 2.x contrast ratio, fixing failures for large text, thin fonts and non-text elements.', url: 'https://news.google.com/search?q=WCAG+3.0+APCA+contrast+algorithm+accessibility&hl=en', time: Date.now()/1000-73600, category: 'design', categoryLabel: 'Design & Creative', accent: 'indigo', tags: ['Accessibility','WCAG','Color Contrast'], source: 'w3c', sourceLabel: 'W3C WAI' },
    { id: 'd10', title: 'AI-Assisted Brand Identity Tools Reduce Logo Design Time from Weeks to Hours', description: 'Generative branding platforms create complete identity systems — logos, color palettes, typography and voice — in a guided 2-hour creative sprint.', url: 'https://news.google.com/search?q=AI+brand+identity+logo+design+generative+branding&hl=en', time: Date.now()/1000-80800, category: 'design', categoryLabel: 'Design & Creative', accent: 'indigo', tags: ['Brand Design','AI Creative','Logo Design'], source: 'looka', sourceLabel: 'Looka Design' },
    { id: 'd11', title: 'Generative UI Systems Enable No-Code Responsive Layout Creation from Natural Language', description: 'Visual builders with LLM backends produce production-grade React component trees with correct accessibility tree and semantic markup.', url: 'https://news.google.com/search?q=generative+UI+React+component+natural+language+AI&hl=en', time: Date.now()/1000-88000, category: 'design', categoryLabel: 'Design & Creative', accent: 'indigo', tags: ['Generative UI','No-Code','React'], source: 'vercel', sourceLabel: 'Vercel v0' },
    { id: 'd12', title: 'Eye Tracking Heat Maps Reveal 67% of Mobile Users Never See Below the Fold', description: 'Mobile UX research across 180 apps shows critical CTA placement and information hierarchy failures — most design teams drastically underestimate scroll depth.', url: 'https://news.google.com/search?q=eye+tracking+mobile+UX+scroll+fold+CTA+placement&hl=en', time: Date.now()/1000-95200, category: 'design', categoryLabel: 'Design & Creative', accent: 'indigo', tags: ['UX Research','Mobile UX','Eye Tracking'], source: 'nngroup', sourceLabel: 'Nielsen Norman' },
    { id: 'd13', title: '3D Web Experiences with WebGPU Render 5× Faster than WebGL on Mobile Devices', description: 'WebGPU adoption allows native GPU pipeline access from browsers enabling console-quality 3D without app downloads on iOS and Android.', url: 'https://news.google.com/search?q=WebGPU+3D+web+performance+mobile+GPU+browser&hl=en', time: Date.now()/1000-102400, category: 'design', categoryLabel: 'Design & Creative', accent: 'indigo', tags: ['WebGPU','3D Web','Browser Tech'], source: 'chrome', sourceLabel: 'Chrome Developers' },
    { id: 'd14', title: 'Voice UI Design Principles Codified as Smart Speakers Reach 1 Billion Users', description: 'Nielsen Norman Group publishes first comprehensive VUI interaction patterns covering conversation repair, error recovery and multimodal handoff.', url: 'https://news.google.com/search?q=voice+UI+design+VUI+conversation+design+smart+speaker&hl=en', time: Date.now()/1000-109600, category: 'design', categoryLabel: 'Design & Creative', accent: 'indigo', tags: ['Voice UI','Conversational Design','VUI'], source: 'nngroup', sourceLabel: 'Nielsen Norman' },
    { id: 'd15', title: 'Haptic Design Emerges as Discipline with Standardized Feedback Pattern Libraries', description: 'Device-agnostic haptic design libraries define standard tactile patterns for notifications, confirmations and gestures across iOS, Android and wearables.', url: 'https://news.google.com/search?q=haptic+design+feedback+pattern+iOS+Android+wearable&hl=en', time: Date.now()/1000-116800, category: 'design', categoryLabel: 'Design & Creative', accent: 'indigo', tags: ['Haptic Design','Mobile UX','Interaction Design'], source: 'haptics', sourceLabel: 'Haptics Group' },
    { id: 'd16', title: 'Sustainable Packaging Design Reduces Plastic Use by 40% Without Cost Premium', description: 'Biomaterial and structural optimization tools allow FMCG brands to achieve 40% plastic reduction while maintaining identical shelf impact and protection.', url: 'https://news.google.com/search?q=sustainable+packaging+design+plastic+reduction+biomaterial&hl=en', time: Date.now()/1000-124000, category: 'design', categoryLabel: 'Design & Creative', accent: 'indigo', tags: ['Sustainable Design','Packaging','Circular Economy'], source: 'packdigest', sourceLabel: 'Packaging Digest' },
    { id: 'd17', title: 'Open-Source Icon Libraries Hit 300,000 Unique Icons as AI Generation Scales', description: 'Community-built icon libraries leverage AI to maintain visual consistency across massive catalogues, democratizing high-quality UI asset access.', url: 'https://news.google.com/search?q=open+source+icon+library+AI+generation+UI+design&hl=en', time: Date.now()/1000-131200, category: 'design', categoryLabel: 'Design & Creative', accent: 'indigo', tags: ['Icons','Open Source','UI Assets'], source: 'iconoir', sourceLabel: 'Iconoir' },
    { id: 'd18', title: 'Neuroaesthetics Research Maps Brain Response to Visual Hierarchy and Composition', description: 'fMRI studies reveal reward pathways activated by specific spatial compositions, informing evidence-based visual design principles beyond subjective taste.', url: 'https://news.google.com/search?q=neuroaesthetics+brain+response+visual+design+hierarchy&hl=en', time: Date.now()/1000-138400, category: 'design', categoryLabel: 'Design & Creative', accent: 'indigo', tags: ['Neuroaesthetics','Visual Design','Cognitive Science'], source: 'elsevier', sourceLabel: 'Cognition' },
    { id: 'd19', title: 'Color Psychology in Digital Interfaces: Cross-Cultural Study of 40,000 Users', description: 'Research across 18 countries reveals significant cultural divergence in color associations, urgency perception and trust signals — invalidating universal palettes.', url: 'https://news.google.com/search?q=color+psychology+cross+cultural+UI+design+trust&hl=en', time: Date.now()/1000-145600, category: 'design', categoryLabel: 'Design & Creative', accent: 'indigo', tags: ['Color Psychology','Cross-Cultural','UX Research'], source: 'colorpsych', sourceLabel: 'Journal of Design' },
    { id: 'd20', title: 'Generative AI Storyboarding Cuts Film Pre-Production Budget by 60%', description: 'AI-generated concept frames and animatics replace weeks of traditional storyboarding, saving major studios an estimated $15M per feature film.', url: 'https://news.google.com/search?q=AI+storyboarding+film+pre+production+animatic+generative&hl=en', time: Date.now()/1000-152800, category: 'design', categoryLabel: 'Design & Creative', accent: 'indigo', tags: ['Film Design','AI Storyboarding','Pre-Production'], source: 'adobe', sourceLabel: 'Adobe Firefly' },
    { id: 'd21', title: 'Design Engineering Role Emerges as Most In-Demand Hybrid Position in Tech', description: 'Combined Figma-to-code fluency commands 40% salary premium; design engineering now standard in top-tier product teams at Apple, Vercel and Linear.', url: 'https://news.google.com/search?q=design+engineering+role+Figma+code+salary+product&hl=en', time: Date.now()/1000-160000, category: 'design', categoryLabel: 'Design & Creative', accent: 'indigo', tags: ['Design Engineering','Career','Product Design'], source: 'linear', sourceLabel: 'Linear Blog' },
    { id: 'd22', title: 'Brutalist Web Design Revival Signals Rejection of AI-Generic Corporate Aesthetics', description: 'Counter-movement embracing raw layouts, monospace type and exposed structure reflects user fatigue with over-polished, AI-homogenized interface styles.', url: 'https://news.google.com/search?q=brutalist+web+design+revival+anti+AI+aesthetic&hl=en', time: Date.now()/1000-167200, category: 'design', categoryLabel: 'Design & Creative', accent: 'indigo', tags: ['Brutalism','Web Aesthetics','Design Trends'], source: 'brutalist', sourceLabel: 'Brutalist Websites' },
    { id: 'd23', title: 'Parametric Brand Systems Allow Real-Time Identity Adaptation Across Contexts', description: 'Dynamic brand engines adjust typeface weights, color saturation and layout density algorithmically based on context, medium and audience cohort.', url: 'https://news.google.com/search?q=parametric+brand+system+dynamic+identity+design&hl=en', time: Date.now()/1000-174400, category: 'design', categoryLabel: 'Design & Creative', accent: 'indigo', tags: ['Brand Systems','Parametric Design','Identity'], source: 'pentagram', sourceLabel: 'Pentagram' },
    { id: 'd24', title: 'Micro-Interaction Library for React Hits 2M Weekly Downloads', description: 'Framer Motion and React Spring adoption explodes as developers recognize animation quality as a product differentiator, not a cosmetic afterthought.', url: 'https://news.google.com/search?q=Framer+Motion+React+animation+micro+interactions&hl=en', time: Date.now()/1000-181600, category: 'design', categoryLabel: 'Design & Creative', accent: 'indigo', tags: ['Micro-Interactions','React','Animation'], source: 'framer', sourceLabel: 'Framer Motion' },
    { id: 'd25', title: 'Print-on-Demand Meets Generative Art: $2B Market for AI-Authored Physical Products', description: 'Consumer platforms enabling AI-generated art printed on merchandise create new creator revenue streams without inventory risk or design skill requirements.', url: 'https://news.google.com/search?q=AI+generative+art+print+on+demand+creator+economy&hl=en', time: Date.now()/1000-188800, category: 'design', categoryLabel: 'Design & Creative', accent: 'indigo', tags: ['Generative Art','POD','Creator Economy'], source: 'printful', sourceLabel: 'Printful' },
]

export function TrendingTopics() {
    const [selectedCategory, setSelectedCategory] = useState<string>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const debouncedSearch = useDebounce(searchQuery, 300)

    const [allTopics, setAllTopics] = useState<TrendingTopicItem[]>([])
    const [visibleTopics, setVisibleTopics] = useState<TrendingTopicItem[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [hasMore, setHasMore] = useState(false)

    const PAGE_SIZE = 9

    // ── Fisher-Yates shuffle ──────────────────────────────────────────────────
    const shuffle = <T,>(arr: T[]): T[] => {
        const a = [...arr]
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]]
        }
        return a
    }

    // ── External Live Fetchers ────────────────────────────────────────────────
    const fetchHackerNews = async (count = 12): Promise<TrendingTopicItem[]> => {
        try {
            const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json')
            const ids: number[] = await res.json()
            const stories = await Promise.all(
                ids.slice(0, count).map(id =>
                    fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json()).catch(() => null)
                )
            )
            return stories.filter((s: any) => s?.title && s?.url && !s.deleted).map((s: any) => {
                let domain = 'HackerNews'
                try { domain = new URL(s.url).hostname.replace('www.', '') } catch { /**/ }
                // Build a meaningful description from available HN data
                const points = s.score || 0
                const comments = s.descendants || 0
                const authorNote = s.by ? ` Submitted by ${s.by}.` : ''
                // Use story text if available (Ask HN / Show HN posts), else derive from title
                const storyText = s.text
                    ? s.text.replace(/<[^>]+>/g, '').substring(0, 180)
                    : `A trending story from ${domain} — currently ${points} upvotes and ${comments} active discussion${comments !== 1 ? 's' : ''} on Hacker News.${authorNote}`
                return {
                    id: `hn_${s.id}`,
                    title: s.title,
                    score: points,
                    description: storyText,
                    url: s.url,
                    time: s.time || Date.now()/1000,
                    category: 'tech' as const,
                    categoryLabel: 'Tech & Engineering',
                    accent: 'sky',
                    tags: ['Engineering', 'Open Source', 'Tech'],
                    source: 'hackernews',
                    sourceLabel: domain,
                    hnScore: points,
                    hnComments: comments
                }
            })
        } catch { return [] }
    }

    const fetchDevTo = async (count = 8): Promise<TrendingTopicItem[]> => {
        try {
            const res = await fetch(`https://dev.to/api/articles?top=7&per_page=${count}`)
            const articles = await res.json()
            return articles.filter((a: any) => a?.title && a?.url).map((a: any) => ({
                id: `devto_${a.id}`,
                title: a.title,
                description: a.description
                    ? a.description
                    : `Written by ${a.user?.name || 'a developer'} and published on DEV Community with ${a.public_reactions_count || 0} reactions.`,
                url: a.url,
                time: new Date(a.published_at || a.created_at).getTime()/1000,
                category: 'tech' as const,
                categoryLabel: 'Tech & Engineering',
                accent: 'sky',
                tags: (a.tag_list || a.tags || ['WebDev']).slice(0, 3),
                source: 'devto',
                sourceLabel: 'DEV Community'
            }))
        } catch { return [] }
    }

    const loadMaster = async (forceFresh = false): Promise<TrendingTopicItem[]> => {
        if (!forceFresh) {
            const cached = sessionStorage.getItem('tt_page_cache_v3')
            if (cached) {
                try {
                    const { timestamp, topics } = JSON.parse(cached)
                    if (Date.now() - timestamp < 30 * 60 * 1000 && topics.length > 0) return topics
                } catch { /**/ }
            }
        }

        const [hn, devto] = await Promise.all([fetchHackerNews(12), fetchDevTo(8)])

        // Shuffle the fallback pool so refresh always shows different ordering
        const shuffledFallback = shuffle(FALLBACK_POOL)
        const combined = [...hn, ...devto, ...shuffledFallback]

        const seen = new Set<string>()
        const unique: TrendingTopicItem[] = []
        for (const item of combined) {
            const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 60)
            if (key && !seen.has(key)) { seen.add(key); unique.push(item) }
        }

        // Live HN/devto first (sorted by score), then shuffled curated items
        const live = unique.filter(t => t.id.startsWith('hn_') || t.id.startsWith('devto_')).sort((a, b) => (b.score || 0) - (a.score || 0))
        const curated = unique.filter(t => !t.id.startsWith('hn_') && !t.id.startsWith('devto_'))
        const sorted = [...live, ...curated]

        // Only cache on initial load, not on refresh — so refresh always re-fetches live
        if (!forceFresh) {
            try { sessionStorage.setItem('tt_page_cache_v3', JSON.stringify({ timestamp: Date.now(), topics: sorted })) } catch { /**/ }
        } else {
            sessionStorage.removeItem('tt_page_cache_v3')
        }
        return sorted
    }

    const initData = useCallback(async (forceFresh = false) => {
        if (forceFresh) setRefreshing(true); else setLoading(true)
        try {
            const master = await loadMaster(forceFresh)
            setAllTopics(master)
            setVisibleTopics(master.slice(0, PAGE_SIZE))
            setHasMore(master.length > PAGE_SIZE)
        } catch (e) { console.error(e) }
        finally { setLoading(false); setRefreshing(false) }
    }, [])

    useEffect(() => { initData(false) }, [initData])

    const filtered = allTopics.filter(item => {
        const catOk = selectedCategory === 'all' || item.category === selectedCategory
        if (!debouncedSearch) return catOk
        const q = debouncedSearch.toLowerCase()
        return catOk && (item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q) || item.tags.some(t => t.toLowerCase().includes(q)))
    })

    useEffect(() => {
        setVisibleTopics(filtered.slice(0, PAGE_SIZE))
        setHasMore(filtered.length > PAGE_SIZE)
    }, [selectedCategory, debouncedSearch, allTopics])

    const loadMore = useCallback(async (): Promise<boolean> => {
        const next = filtered.slice(0, visibleTopics.length + 6)
        setVisibleTopics(next)
        const more = next.length < filtered.length
        setHasMore(more)
        return more
    }, [filtered, visibleTopics.length])

    const { sentinelRef } = useInfiniteScroll(loadMore, { enabled: !loading && hasMore })

    const ago = (ts: number) => {
        const s = Math.floor(Date.now()/1000 - ts)
        if (s < 3600) return `${Math.max(1, Math.floor(s/60))}m ago`
        if (s < 86400) return `${Math.floor(s/3600)}h ago`
        return `${Math.floor(s/86400)}d ago`
    }

    const countFor = (cat: string) => cat === 'all' ? allTopics.length : allTopics.filter(t => t.category === cat).length

    return (
        <DashboardLayout>
            <SEOHead
                title="Trending Topics & Project Research Ideas"
                description="Explore trending innovations, tech news, AI research, and domain-wise project ideas across Tech, Medicine, Law, Business, and Design on ProCollab."
                keywords={[
                    'trending tech topics',
                    'student project ideas',
                    'AI research trends',
                    'medical tech news',
                    'law and tech trends',
                    'business innovation topics',
                    'design research trends',
                    'HackerNews top stories',
                ]}
                canonical="https://procollab.in/trending-topics"
            />
            <div className="min-h-screen">
                {/* Header */}
                <div className="mb-7">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2.5 mb-1">
                                <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                                    <TrendingUp className="h-3.5 w-3.5 text-violet-400" />
                                </div>
                                <h1 className="text-lg font-semibold tracking-tight">Trending Topics</h1>
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                                    Live
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground pl-9">
                                Multi-disciplinary signals — Engineering, Health, Pharma, Law, Business & Design
                            </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => initData(true)} disabled={refreshing || loading}
                            className="self-start sm:self-auto h-8 px-3 text-xs gap-1.5 border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-300 shrink-0">
                            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-violet-400' : ''}`} />
                            {refreshing ? 'Refreshing…' : 'Refresh'}
                        </Button>
                    </div>
                </div>

                {/* Category pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none mb-5 pb-0.5">
                    {Object.entries(CATEGORY_CONFIG).map(([key, conf]) => {
                        const Icon = conf.icon
                        const active = selectedCategory === key
                        return (
                            <button key={key} onClick={() => setSelectedCategory(key)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 border shrink-0 ${
                                    active ? `${conf.pillBg} ${conf.pillText} border-current/20` : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-200 hover:border-zinc-600'
                                }`}>
                                <Icon className="h-3 w-3" />
                                {conf.label}
                                {!loading && <span className={`text-[9px] px-1 py-px rounded-full font-semibold ${active ? 'bg-white/15' : 'bg-zinc-700'}`}>{countFor(key)}</span>}
                            </button>
                        )
                    })}
                </div>

                {/* Search */}
                <div className="flex items-center gap-3 mb-5">
                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                        <Input placeholder="Search topics…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            className="pl-8 h-8 text-xs bg-zinc-800/60 border-zinc-700/60 focus-visible:ring-1 focus-visible:ring-violet-500/30 focus-visible:border-violet-500/40 placeholder:text-zinc-600 text-zinc-200" />
                    </div>
                    {(searchQuery || selectedCategory !== 'all') && (
                        <span className="text-xs text-zinc-500">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
                    )}
                </div>

                {/* Content */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {Array.from({ length: 9 }).map((_, i) => (
                            <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3 animate-pulse">
                                <div className="flex justify-between"><div className="h-4 w-24 rounded-full bg-zinc-800" /><div className="h-3.5 w-12 rounded bg-zinc-800" /></div>
                                <div className="h-4 w-full rounded bg-zinc-800" />
                                <div className="h-4 w-2/3 rounded bg-zinc-800" />
                                <div className="h-9 rounded bg-zinc-800/60" />
                                <div className="flex gap-1.5"><div className="h-5 w-16 rounded-full bg-zinc-800" /><div className="h-5 w-14 rounded-full bg-zinc-800" /></div>
                            </div>
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                        <div className="w-10 h-10 rounded-xl bg-zinc-800/60 flex items-center justify-center">
                            <Filter className="h-5 w-5 text-zinc-500" />
                        </div>
                        <p className="text-sm font-medium text-zinc-300">No topics found</p>
                        <p className="text-xs text-zinc-500 max-w-xs">Try a different discipline or clear your search filter.</p>
                        <Button variant="ghost" size="sm" className="text-xs mt-1 text-zinc-400 hover:text-zinc-200" onClick={() => { setSelectedCategory('all'); setSearchQuery('') }}>
                            Clear filters
                        </Button>
                    </div>
                ) : (
                    <>
                        <AnimatePresence mode="popLayout">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                {visibleTopics.map((topic, i) => {
                                    const conf = CATEGORY_CONFIG[topic.category] || CATEGORY_CONFIG.all
                                    const CatIcon = conf.icon
                                    return (
                                        <motion.a
                                            key={topic.id}
                                            href={topic.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            layout
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.15, delay: i < 9 ? i * 0.025 : 0 }}
                                            className="group flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/70 hover:bg-zinc-800/70 hover:border-zinc-700 transition-all duration-200 p-4 gap-3 cursor-pointer no-underline"
                                        >
                                            {/* Category + time */}
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${conf.pillBg} ${conf.pillText}`}>
                                                    <CatIcon className="h-2.5 w-2.5" />
                                                    {topic.categoryLabel}
                                                </span>
                                                <div className="flex items-center gap-1 text-[11px] text-zinc-600">
                                                    <Clock className="h-2.5 w-2.5" />
                                                    {ago(topic.time)}
                                                </div>
                                            </div>

                                            {/* Title */}
                                            <h3 className="text-sm font-semibold leading-snug line-clamp-2 text-zinc-100 group-hover:text-violet-300 transition-colors">
                                                {topic.title}
                                            </h3>

                                            {/* Description */}
                                            <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed flex-1">
                                                {topic.description}
                                            </p>

                                            {/* Tags */}
                                            {topic.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {topic.tags.slice(0, 3).map(tag => (
                                                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-500">
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Footer */}
                                            <div className="flex items-center justify-between pt-2 border-t border-zinc-800 mt-auto">
                                                <span className="text-[11px] text-zinc-600 flex items-center gap-1">
                                                    <Globe className="h-2.5 w-2.5" />
                                                    {topic.sourceLabel}
                                                </span>
                                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500 group-hover:text-violet-400 transition-colors">
                                                    Read
                                                    <ExternalLink className="h-2.5 w-2.5" />
                                                </span>
                                            </div>
                                        </motion.a>
                                    )
                                })}
                            </div>
                        </AnimatePresence>

                        {/* Infinite scroll sentinel */}
                        {hasMore && (
                            <div ref={sentinelRef} className="flex justify-center py-8">
                                <div className="flex items-center gap-2 text-xs text-zinc-600">
                                    <div className="w-3.5 h-3.5 rounded-full border-2 border-zinc-700 border-t-violet-500 animate-spin" />
                                    Loading more…
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </DashboardLayout>
    )
}
