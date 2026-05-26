import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../../../dist-electron/electron/llm/ResumeJDParser.js');
const mod = await import(pathToFileURL(distPath).href);
const { ResumeJDParser, extractJsonFromText } = mod;

const storePath = path.resolve(__dirname, '../../../dist-electron/electron/SessionContextStore.js');
const { SessionContextStore } = await import(pathToFileURL(storePath).href);

// ── Fixture resumes ───────────────────────────────────────────────────────────

const CAREER_SWITCHER_RESUME = `
Jane Doe
jane@email.com | linkedin.com/in/janedoe

EXPERIENCE
Health Policy Institute, Peking University — Research Assistant (2022–2024)
- Led quantitative analysis for 3 national health policy reports using R and Python
- Built predictive model adopted in 2 follow-on policy projects
- Coordinated cross-functional team of 8 researchers across 3 departments

PROJECTS
InterviewCopilot — Product Lead (2024)
Technologies: Electron, React, TypeScript, Claude API
- Shipped MVP in 3 weeks; 50 beta users in first month
- Designed dual-trigger mechanism reducing false positive rate to <5%

EDUCATION
Peking University — Master of Science, Health Policy (2022–2024)

SKILLS
R, Python, TypeScript, React, Product Management, A/B Testing, SQL
`;

const INTERNATIONAL_STUDENT_RESUME = `
Yuki Tanaka
yuki@email.com | Tokyo, Japan

WORK EXPERIENCE
SoftBank Corp — Software Engineer Intern (2023)
- Developed REST APIs in Go serving 2M daily requests
- Reduced P95 latency by 30% through query optimisation

Honda R&D — Junior Researcher (2022–2023)
- Conducted user research for in-car UX, authored 2 internal papers

PROJECTS
Campus Navigator App — Lead Developer (2023)
Stack: Flutter, Firebase, Google Maps API
- 1,200 downloads in first week; 4.7-star App Store rating

EDUCATION
Tokyo Institute of Technology — Bachelor of Engineering, Computer Science (2019–2023)

SKILLS
Go, Python, Flutter, Firebase, SQL, Japanese (native), English (TOEFL 110)
`;

const NEW_GRAD_RESUME = `
Alex Chen
alex@email.com | San Francisco, CA

EDUCATION
UC Berkeley — Bachelor of Science, Computer Science (2020–2024)
GPA: 3.85 / 4.0, Dean's List

PROJECTS
ML Music Recommender — Individual Project (2024)
Technologies: Python, PyTorch, Spotify API
- Achieved 82% recommendation accuracy on 10k-song dataset

Open Source Contribution — pytorch/pytorch
- Merged PR fixing memory leak in DataLoader; 47 GitHub stars

INTERNSHIP
Stripe — Software Engineering Intern (Summer 2023)
- Built fraud-detection microservice in TypeScript / Node.js
- Reduced false-positive rate by 18% vs. baseline rule engine

SKILLS
Python, TypeScript, Node.js, PyTorch, React, PostgreSQL, Docker
`;

const SAMPLE_JD = `
AI Product Manager — Startup
Requirements: cross-functional leadership, data-driven decision making,
user research, A/B testing, roadmap prioritisation, Python, SQL.
Bonus: experience with AI/ML products, LLM APIs.
`;

// ── Mock Anthropic client ─────────────────────────────────────────────────────

function makeAnthropicMock(responseText) {
    return {
        messages: {
            create: async () => ({
                content: [{ type: 'text', text: responseText }],
            }),
        },
    };
}

function makeCareerSwitcherResponse() {
    return JSON.stringify({
        workExperience: [{
            company: 'Health Policy Institute, Peking University',
            role: 'Research Assistant',
            period: '2022–2024',
            achievements: [
                'Led quantitative analysis for 3 national health policy reports using R and Python',
                'Built predictive model adopted in 2 follow-on policy projects',
            ],
        }],
        projects: [{
            name: 'InterviewCopilot',
            role: 'Product Lead',
            tech: ['Electron', 'React', 'TypeScript', 'Claude API'],
            outcomes: ['Shipped MVP in 3 weeks; 50 beta users in first month'],
        }],
        education: { institution: 'Peking University', degree: 'Master of Science', field: 'Health Policy' },
        skills: ['R', 'Python', 'TypeScript', 'React', 'Product Management', 'A/B Testing', 'SQL'],
        jdKeywords: ['cross-functional', 'data-driven', 'user research', 'A/B testing', 'AI/ML products'],
        careerPivotStory: 'Health Policy researcher → AI PM: quantitative analysis experience maps directly to PM A/B test thinking and data-driven roadmap decisions',
    });
}

function makeInternationalStudentResponse() {
    return JSON.stringify({
        workExperience: [
            {
                company: 'SoftBank Corp',
                role: 'Software Engineer Intern',
                period: '2023',
                achievements: ['Developed REST APIs in Go serving 2M daily requests', 'Reduced P95 latency by 30%'],
            },
            {
                company: 'Honda R&D',
                role: 'Junior Researcher',
                period: '2022–2023',
                achievements: ['Conducted user research for in-car UX', 'Authored 2 internal papers'],
            },
        ],
        projects: [{
            name: 'Campus Navigator App',
            role: 'Lead Developer',
            tech: ['Flutter', 'Firebase', 'Google Maps API'],
            outcomes: ['1,200 downloads in first week', '4.7-star App Store rating'],
        }],
        education: { institution: 'Tokyo Institute of Technology', degree: 'Bachelor of Engineering', field: 'Computer Science' },
        skills: ['Go', 'Python', 'Flutter', 'Firebase', 'SQL', 'Japanese', 'English'],
        jdKeywords: ['cross-functional', 'data-driven', 'user research', 'Python', 'SQL'],
        careerPivotStory: '',
    });
}

function makeNewGradResponse() {
    return JSON.stringify({
        workExperience: [{
            company: 'Stripe',
            role: 'Software Engineering Intern',
            period: 'Summer 2023',
            achievements: ['Built fraud-detection microservice', 'Reduced false-positive rate by 18%'],
        }],
        projects: [
            {
                name: 'ML Music Recommender',
                role: 'Individual Project',
                tech: ['Python', 'PyTorch', 'Spotify API'],
                outcomes: ['82% recommendation accuracy on 10k-song dataset'],
            },
            {
                name: 'pytorch/pytorch Open Source Contribution',
                role: 'Contributor',
                tech: ['Python', 'PyTorch'],
                outcomes: ['Merged PR fixing memory leak; 47 GitHub stars'],
            },
        ],
        education: { institution: 'UC Berkeley', degree: 'Bachelor of Science', field: 'Computer Science' },
        skills: ['Python', 'TypeScript', 'Node.js', 'PyTorch', 'React', 'PostgreSQL', 'Docker'],
        jdKeywords: ['cross-functional', 'data-driven', 'A/B testing', 'Python', 'LLM APIs'],
        careerPivotStory: '',
    });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('career-switcher: extracts P0 fields and careerPivotStory', async () => {
    const store = new SessionContextStore();
    const parser = new ResumeJDParser({
        client: makeAnthropicMock(makeCareerSwitcherResponse()),
        store,
    });

    const ctx = await parser.parse(CAREER_SWITCHER_RESUME, SAMPLE_JD);

    // P0: workExperience
    assert.equal(ctx.workExperience.length >= 1, true, 'must have work experience');
    assert.match(ctx.workExperience[0].company, /Health Policy|Peking/i);

    // P0: projects
    assert.equal(ctx.projects.length >= 1, true, 'must have projects');
    assert.equal(ctx.projects[0].name, 'InterviewCopilot');

    // P0: jdKeywords
    assert.equal(ctx.jdKeywords.length >= 3, true, 'must extract jd keywords');

    // P1: education
    assert.match(ctx.education.institution, /Peking/i);

    // P1: skills
    assert.equal(ctx.skills.length >= 3, true, 'must have skills');

    // Special: careerPivotStory populated for cross-industry candidate
    assert.notEqual(ctx.careerPivotStory, undefined, 'careerPivotStory must be set');
    assert.equal(ctx.careerPivotStory.length > 0, true);

    // Stored in SessionContextStore
    assert.deepEqual(store.get(), ctx);
});

test('international student: P0 fields extracted, no careerPivotStory', async () => {
    const store = new SessionContextStore();
    const parser = new ResumeJDParser({
        client: makeAnthropicMock(makeInternationalStudentResponse()),
        store,
    });

    const ctx = await parser.parse(INTERNATIONAL_STUDENT_RESUME, SAMPLE_JD);

    assert.equal(ctx.workExperience.length >= 1, true);
    assert.match(ctx.workExperience[0].company, /SoftBank|Honda/i);

    assert.equal(ctx.projects.length >= 1, true);

    assert.equal(ctx.jdKeywords.length >= 3, true);

    // No cross-industry switch → careerPivotStory should be absent
    assert.equal(ctx.careerPivotStory, undefined, 'no career pivot for same-field candidate');

    assert.deepEqual(store.get(), ctx);
});

test('new grad: P0 fields extracted, no careerPivotStory', async () => {
    const store = new SessionContextStore();
    const parser = new ResumeJDParser({
        client: makeAnthropicMock(makeNewGradResponse()),
        store,
    });

    const ctx = await parser.parse(NEW_GRAD_RESUME, SAMPLE_JD);

    assert.equal(ctx.workExperience.length >= 1, true);
    assert.match(ctx.workExperience[0].company, /Stripe/i);

    assert.equal(ctx.projects.length >= 2, true, 'must capture multiple projects');

    assert.equal(ctx.jdKeywords.length >= 3, true);
    assert.equal(ctx.education.institution, 'UC Berkeley');

    assert.equal(ctx.careerPivotStory, undefined);

    assert.deepEqual(store.get(), ctx);
});

test('parse() stores context in provided SessionContextStore', async () => {
    const store = new SessionContextStore();
    assert.equal(store.get(), null, 'store empty before parse');

    const parser = new ResumeJDParser({
        client: makeAnthropicMock(makeNewGradResponse()),
        store,
    });
    await parser.parse(NEW_GRAD_RESUME, SAMPLE_JD);

    assert.notEqual(store.get(), null, 'store populated after parse');
});

test('extractJsonFromText strips markdown fences', () => {
    const withFence = '```json\n{"skills":["Python"]}\n```';
    const result = extractJsonFromText(withFence);
    assert.deepEqual(result, { skills: ['Python'] });
});

test('extractJsonFromText parses bare JSON', () => {
    const bare = '{"skills":["Go","Rust"]}';
    const result = extractJsonFromText(bare);
    assert.deepEqual(result, { skills: ['Go', 'Rust'] });
});

test('validate: empty careerPivotStory string becomes undefined', async () => {
    const store = new SessionContextStore();
    const parser = new ResumeJDParser({
        client: makeAnthropicMock(makeNewGradResponse()),
        store,
    });
    const ctx = await parser.parse(NEW_GRAD_RESUME, SAMPLE_JD);
    assert.equal(Object.prototype.hasOwnProperty.call(ctx, 'careerPivotStory'), false,
        'empty pivot string must be omitted from the object');
});
