# Future Gemini AI Features Integration Plan

This document outlines the proposed architecture, data models, and integration specs for integrating Gemini AI features into the ProCollab ecosystem. The primary objective is to assist teams with project initialization, real-time risk assessment, and career-readiness showcase generation.

---

## 1. AI Project Setup Assistant

### Objective
Automate project backlog initialization, technology mapping, and role distribution based on high-level natural language project descriptions.

### Proposed Architecture
When a project is created, the owner can optionally supply a description. A Cloud Function triggers a Gemini model call using the Google Gen AI SDK to generate structured initial backlogs.

```
[User Project Pitch] ──> [Cloud Function / API] ──> [Gemini Pro (Structured Schema)]
                                                              │
                                                              ▼
[Firestore project/tasks] <─────────────────────── [JSON Task List & Tags]
```

### Data Requirements & Input Schema
- **Input:**
  - `title`: String
  - `description`: String
  - `primaryDiscipline`: String
  - `targetTimeline`: String (e.g., "4 weeks")
- **Prompt Specification:**
  ```text
  You are an expert project manager. Parse the following project title and description:
  Title: {title}
  Description: {description}
  Primary Discipline: {primaryDiscipline}
  Timeline: {targetTimeline}

  Generate:
  1. A list of 10-15 discrete tasks required to launch a Minimum Viable Product (MVP).
  2. Each task must include: title, detailed description, suggested priority (low, medium, high, urgent), and target functional role (e.g., Frontend Developer, Backend Developer, UI Designer).
  3. A list of 5-8 relevant technology tags.
  
  Return the output strictly in the requested JSON format matching the schema: ProjectInitializationResult.
  ```
- **Expected JSON Schema:**
  ```json
  {
    "tags": ["React", "Firebase", "TypeScript"],
    "suggestedRoles": ["Frontend Developer", "Backend Developer"],
    "tasks": [
      {
        "title": "Establish Firebase Project",
        "description": "Configure Firestore database rules, authentication providers, and generate config keys.",
        "priority": "high",
        "role": "Backend Developer"
      }
    ]
  }
  ```

---

## 2. Automated Sprint Risk Analysis & Health Scoring

### Objective
Continually analyze team collaboration signals, task completion rates, budget utilization, and calendar meetings to provide early indicators of sprint delays.

### Proposed Architecture
A scheduled CRON process (or Firebase trigger on task updates) pulls aggregated metadata and passes it to the Gemini API to obtain an objective health assessment.

```
[Firestore: Tasks, Logs, Budget] ──> [Aggregator] ──> [Gemini Flash]
                                                            │
                                                            ▼
[ProjectDashboard: AI Insights] <──────────────── [Sprint Health & Risk Assessment]
```

### Data Metrics Evaluated
- **Task Velocity:** Ratio of tasks completed vs. added per week.
- **Resource Load:** Variance in task assignments (e.g., one user holding 80% of urgent items).
- **Communication Sentiment:** Real-time chat activity level, average response delays, and reaction counts.
- **Budget Burn Rate:** Percentage of funds spent relative to overall project completion rate.

### Prompt Specification
```text
Analyze the following project metrics to compute a project health index (0 to 100) and identify top bottleneck risks.

Project Title: {title}
Total Tasks: {totalTasks}
Completed Tasks: {completedTasks}
Active Members: {memberCount}
Resource Load Distribution: {memberLoad}
Days Remaining in Sprint: {daysRemaining}
Budget Expended: {budgetSpent}%

Provide the evaluation in the following JSON format:
{
  "healthScore": 84,
  "status": "stable" | "warning" | "critical",
  "bottlenecks": [
    {
      "type": "Resource Bottleneck",
      "description": "User X is assigned 4 high priority tasks ending this week.",
      "remediation": "Reassign at least 2 tasks to User Y or User Z to balance the load."
    }
  ]
}
```

---

## 3. Gemini STAR Resume Bullet & Portfolio Description Helper

### Objective
Formulate highly impactful resume bullet points following the STAR methodology (Situation, Task, Action, Result) utilizing project deliverables and team contributions.

### Proposed Architecture
Upon project completion, team members request a portfolio review. The server queries Firestore for all tasks completed by that specific user, references the overall project metrics, and leverages Gemini to synthesize professional resumes.

```
[User ID + Project ID] ──> [Query User's Completed Tasks] ──> [Gemini API]
                                                                    │
                                                                    ▼
[Project Completion Screen] <─────────────────────────── [STAR Resume Bullets]
```

### Prompt Specification
```text
Write three professional resume bullet points for a candidate using the STAR (Situation, Task, Action, Result) method.
Context:
- Project Title: {title}
- Candidate Role: {role}
- Tasks Completed: {completedTasksList}
- Impact Metric: Completed {completedCount} deliverables out of {totalTasksCount} total project tasks.

Guidelines:
- Keep the language professional, action-oriented, and tailored for technical recruiters.
- Do not use emojis, informal punctuation, or buzzwords.
- Quantify results wherever possible based on the provided data.
```

### Implementation Notes
- **SDK choice:** `@google/genai` npm package.
- **Model choice:** `gemini-1.5-pro` for complex structured output during initialization and resume generation; `gemini-1.5-flash` for high-throughput, low-latency daily sprint health analyses.
