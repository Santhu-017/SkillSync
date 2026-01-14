
const { computeEligibility, getWeights, reloadWeights } = require('../lib/eligibility');

function sampleAnalysis() {
  return {
    name: 'Alice Example',
    email: 'alice@example.com',
    extractedSkills: ['react', 'node.js', 'aws', 'graphql'],
    extractedSoftSkills: ['communication', 'teamwork'],
    extractedEducation: [{ degree: 'Bachelor of Science', institution: 'Example University', year: '2018' }],
    extractedExperience: [{ title: 'Software Engineer', company: 'Acme', duration: '2019-2024 (5 years)' }],
    foundKeywords: ['react', 'graphql'],
    missingKeywords: ['kubernetes']
  };
}

const jobDesc = `Senior Software Engineer - React, GraphQL, AWS

We are looking for a senior engineer with experience in React, GraphQL, Kubernetes and AWS. 5+ years of experience preferred.`;
const resumeText = `Alice Example\nExperience: 5 years at Acme\nSkills: React, Node.js, AWS, GraphQL\nEducation: BSc Computer Science`;

const filters = {
  minScore: 60,
  experience: 'mid',
  location: '',
  requiredSkills: ['React','GraphQL'],
  minEducation: 'bachelor',
  requiredCerts: [],
  preferredKeywords: ['Kubernetes'],
  blacklist: []
};

const analysis = sampleAnalysis();
// Ensure we pick up env-based weights
reloadWeights();
const result = computeEligibility(analysis, resumeText, filters, jobDesc);
console.log('Weights (from env):', getWeights());
console.log('Eligibility result:', JSON.stringify(result, null, 2));
