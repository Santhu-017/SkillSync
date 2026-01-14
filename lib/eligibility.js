// Load weights from environment variables (or use defaults)
function parseEnvWeight(key, fallback) {
  const val = process.env[key];
  if (!val) return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

let weights = {
  skills: parseEnvWeight('ATS_WEIGHT_SKILLS', 40),
  experience: parseEnvWeight('ATS_WEIGHT_EXPERIENCE', 20),
  education: parseEnvWeight('ATS_WEIGHT_EDUCATION', 15),
  certs: parseEnvWeight('ATS_WEIGHT_CERTS', 15),
  location: parseEnvWeight('ATS_WEIGHT_LOCATION', 10)
};

function getWeights() {
  return weights;
}

function reloadWeights() {
  // Re-read from environment variables (no JSON file anymore)
  weights = {
    skills: parseEnvWeight('ATS_WEIGHT_SKILLS', 40),
    experience: parseEnvWeight('ATS_WEIGHT_EXPERIENCE', 20),
    education: parseEnvWeight('ATS_WEIGHT_EDUCATION', 15),
    certs: parseEnvWeight('ATS_WEIGHT_CERTS', 15),
    location: parseEnvWeight('ATS_WEIGHT_LOCATION', 10)
  };
  console.log('Reloaded ATS weights from env:', weights);
  return weights;
}

  function computeEligibility(analysisResult, resumeText = '', filters = {}, jobDescription = '') {
  // Local safe accessors
  const extractedSkills = (analysisResult.extractedSkills || []).map(s => String(s).toLowerCase());
  const degrees = (analysisResult.extractedEducation || []).map(e => (e.degree || '').toLowerCase());

  // Extract years heuristic
  function extractYears() {
    if (analysisResult.extractedExperience && analysisResult.extractedExperience.length > 0) {
      for (const exp of analysisResult.extractedExperience) {
        if (exp.duration) {
          const m = String(exp.duration).match(/(\d+)\+?\s*year/);
          if (m && m[1]) return parseInt(m[1], 10);
          const y = String(exp.duration).match(/(\d+)\s*-\s*(\d+)\s*years/);
          if (y && y[2]) return parseInt(y[2], 10);
        }
      }
    }
    const m2 = resumeText.match(/(\d+)\+?\s*years?/i);
    if (m2 && m2[1]) return parseInt(m2[1], 10);
    return 0;
  }

  const years = extractYears();

  // compute experience score
  let expScore = 50;
  if (years > 0) expScore = Math.min(100, Math.round((Math.min(years, 10) / 10) * 100));
  const expFilter = (filters.experience || 'any');
  if (expFilter === 'junior') {
    if (years <= 2) expScore = Math.max(expScore, 95);
    else if (years <= 4) expScore = Math.round(expScore * 0.7);
    else expScore = Math.round(expScore * 0.4);
  } else if (expFilter === 'mid') {
    if (years >= 3 && years <= 6) expScore = Math.max(expScore, 95);
    else expScore = Math.round(expScore * 0.7);
  } else if (expFilter === 'senior') {
    if (years >= 7) expScore = Math.max(expScore, 95);
    else expScore = Math.round(expScore * 0.6);
  }

  // Education score
  const minEdu = (filters.minEducation || 'any');
  let eduScore = 50;
  const degreeFound = degrees.join(' ');
  if (/phd|doctor/i.test(degreeFound)) eduScore = 95;
  else if (/master|m.sc|ms|m\.|msc/i.test(degreeFound)) eduScore = 85;
  else if (/bachelor|b\.sc|bs|b\.|ba/i.test(degreeFound)) eduScore = 75;
  else eduScore = 50;
  if (minEdu === 'bachelor' && eduScore < 75) eduScore = Math.round(eduScore * 0.6);
  if (minEdu === 'master' && eduScore < 85) eduScore = Math.round(eduScore * 0.5);
  if (minEdu === 'phd' && eduScore < 95) eduScore = Math.round(eduScore * 0.4);

  // Certifications
  const requiredCerts = (filters.requiredCerts || []).map(s => String(s).toLowerCase()).filter(Boolean);
  let certScore = 100;
  if (requiredCerts.length > 0) {
    const matched = requiredCerts.filter(c => resumeText.toLowerCase().includes(c) || extractedSkills.includes(c));
    certScore = Math.round((matched.length / requiredCerts.length) * 100);
  }

  // Location
  let locationScore = 100;
  if (filters.location && String(filters.location).trim() !== '') {
    const loc = String(filters.location).toLowerCase();
    locationScore = resumeText.toLowerCase().includes(loc) ? 100 : 30;
  }

  // Preferred keywords bonus
  const preferred = (filters.preferredKeywords || []).map(s => String(s).toLowerCase()).filter(Boolean);
  let preferredBonus = 0;
  if (preferred.length > 0) {
    const matched = preferred.filter(p => resumeText.toLowerCase().includes(p) || extractedSkills.includes(p));
    preferredBonus = Math.min(10, Math.round((matched.length / preferred.length) * 10));
  }

  // Blacklist penalty
  const blacklist = (filters.blacklist || []).map(s => String(s).toLowerCase()).filter(Boolean);
  let blacklistPenalty = 0;
  if (blacklist.length > 0) {
    const found = blacklist.filter(b => resumeText.toLowerCase().includes(b));
    if (found.length > 0) blacklistPenalty = Math.min(50, found.length * 25);
  }

  // Job-description keyword matching (deterministic)
  const jd = String(jobDescription || '').toLowerCase();
  const stopwords = new Set(['and','or','the','a','an','to','for','with','of','in','on','is','are','by','that','this','as','be','from','at','we','you','will','can']);
  const tokens = jd.split(/[^a-z0-9\+\.#\-]+/i).map(t => t.trim()).filter(t => t.length >= 2 && !stopwords.has(t));
  const freq = {};
  tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
  const jobKeywords = Object.keys(freq).sort((a,b) => freq[b]-freq[a]).slice(0, 20);
  const matchedByKeyword = jobKeywords.filter(k => resumeText.toLowerCase().includes(k) || extractedSkills.includes(k));
  const keywordMatchRatio = jobKeywords.length > 0 ? (matchedByKeyword.length / jobKeywords.length) : 0;

  // Required skills handling
  const requiredSkills = (filters.requiredSkills || []).map(s => String(s).toLowerCase()).filter(Boolean);
  let extractedSkillMatchRatio = 0;
  if (requiredSkills.length > 0) {
    const matched = requiredSkills.filter(rs => extractedSkills.includes(rs) || resumeText.toLowerCase().includes(rs));
    extractedSkillMatchRatio = requiredSkills.length > 0 ? (matched.length / requiredSkills.length) : 0;
  } else {
    extractedSkillMatchRatio = extractedSkills.length > 0 ? Math.min(1, extractedSkills.length / 8) : 0;
  }

  // Skills score: 70% JD keyword overlap, 30% extracted skill match
  const skillsScore = Math.round(((keywordMatchRatio * 0.7) + (extractedSkillMatchRatio * 0.3)) * 100);

  const w = weights; // use loaded weights

  const rawScore = (
    (skillsScore * w.skills) +
    (expScore * w.experience) +
    (eduScore * w.education) +
    (certScore * w.certs) +
    (locationScore * w.location)
  ) / 100;

  let computedAtsScore = Math.round(rawScore + preferredBonus - blacklistPenalty);
  computedAtsScore = Math.max(0, Math.min(100, computedAtsScore));

  let eligibility = 'Not a Fit';
  if (computedAtsScore >= 75) eligibility = 'Eligible';
  else if (computedAtsScore >= 50) eligibility = 'Potential Fit';

  return {
    eligibility,
    eligibilityScore: computedAtsScore,
    atsScore: computedAtsScore,
    eligibilityBreakdown: {
      skillsScore,
      keywordMatchCount: matchedByKeyword.length,
      keywordTotal: jobKeywords.length,
      expScore,
      eduScore,
      certScore,
      locationScore,
      preferredBonus,
      blacklistPenalty,
      weights: w
    }
  };
}

module.exports = { computeEligibility, reloadWeights, getWeights };
