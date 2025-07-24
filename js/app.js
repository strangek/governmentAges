let allMembers = [];

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatYearsLabel(years) {
  if (years === 0) return 'Less than 1 year';
  return `${years} year${years !== 1 ? 's' : ''}`;
}

function computeUniqueServiceYears(terms) {
  if (!terms.length) return 0;

  const ranges = terms.map(t => ({
    start: new Date(t.start),
    end: new Date(Math.min(new Date(t.end), new Date()))
  }));

  ranges.sort((a, b) => a.start - b.start);
  const merged = [];
  let current = ranges[0];

  for (let i = 1; i < ranges.length; i++) {
    const next = ranges[i];
    if (current.end >= next.start) {
      current.end = new Date(Math.max(current.end, next.end));
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  const totalMs = merged.reduce((sum, r) => sum + (r.end - r.start), 0);
  return Math.floor(totalMs / (1000 * 60 * 60 * 24 * 365.25));
}

async function fetchCongressMembers() {
  const res = await fetch('https://unitedstates.github.io/congress-legislators/legislators-current.json');
  const data = await res.json();

  allMembers = data.map(member => {
    const terms = member.terms;
    const firstTermStart = new Date(terms[0].start);
    const houseTerms = terms.filter(t => t.type === 'rep');
    const senateTerms = terms.filter(t => t.type === 'sen');

    const houseYears = computeUniqueServiceYears(houseTerms);
    const senateYears = computeUniqueServiceYears(senateTerms);
    const totalYears = computeUniqueServiceYears(terms);

    const latestTerm = terms.at(-1);
    const latestTermEnd = formatDate(latestTerm.end);
    const currentChamber = latestTerm.type;
    const otherChamber = currentChamber === 'rep' ? 'sen' : 'rep';

    const currentTerms = currentChamber === 'rep' ? houseTerms : senateTerms;
    const otherTerms = otherChamber === 'rep' ? houseTerms : senateTerms;
    const currentChamberLabel = currentChamber === 'rep' ? 'House' : 'Senate';
    const otherChamberLabel = otherChamber === 'rep' ? 'House' : 'Senate';

    const termCount = currentTerms.length;
    let termSummary = `${termCount} Term${termCount !== 1 ? 's' : ''} in the ${currentChamberLabel}`;
    if (otherTerms.length) {
      const otherYears = computeUniqueServiceYears(otherTerms);
      termSummary += `<br><small>Previously served ${otherTerms.length} Term${otherTerms.length !== 1 ? 's' : ''} in the ${otherChamberLabel} (${formatYearsLabel(otherYears)})</small>`;
    }

    let serviceBreakdown = [];
    if (houseYears) serviceBreakdown.push(`${formatYearsLabel(houseYears)} in the House`);
    if (senateYears) serviceBreakdown.push(`${formatYearsLabel(senateYears)} in the Senate`);

    return {
      name: `${member.name.first} ${member.name.last}`,
      role: currentChamber === 'rep' ? 'Rep.' : 'Sen.',
      state: latestTerm.state,
      party: latestTerm.party,
      birthDate: `${formatDate(member.bio.birthday)}`,
      photoUrl: `https://unitedstates.github.io/images/congress/225x275/${member.id.bioguide}.jpg`,
      termSummary,
      serviceLength: serviceBreakdown.join(', '),
      servingSince: `${formatDate(firstTermStart)}`,
      termEnding: `${latestTermEnd}`,
      totalYears,
      termCount: termCount
    };
  });

  populateStateFilter();
  renderCards();
}

function populateStateFilter() {
  const stateSelect = document.getElementById('filter-state');
  stateSelect.innerHTML = '<option value="">All</option>';
  const states = Array.from(new Set(allMembers.map(m => m.state))).sort();
  states.forEach(state => {
    const option = document.createElement('option');
    option.value = state;
    option.textContent = state;
    stateSelect.appendChild(option);
  });
}

function calculateAge(birthDateStr) {
  const birthDate = new Date(birthDateStr);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function ageOn(dateStr, birthDateStr) {
  const date = new Date(dateStr);
  const birth = new Date(birthDateStr);
  let age = date.getFullYear() - birth.getFullYear();
  const m = date.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && date.getDate() < birth.getDate())) age--;
  return age;
}

function renderCards() {
  const partyFilter = document.getElementById('filter-party').value;
  const stateFilter = document.getElementById('filter-state').value;
  const ageFilter = document.getElementById('filter-age').value;

  const filtered = allMembers.filter(m => {
    const age = calculateAge(m.birthDate);

    const partyMatch = !partyFilter || m.party === partyFilter;
    const stateMatch = !stateFilter || m.state === stateFilter;
    const ageMatch =
      !ageFilter ||
      (ageFilter === 'under-50' && age < 50) ||
      (ageFilter === '50-65' && age >= 50 && age <= 65) ||
      (ageFilter === 'over-65' && age > 65);

    return partyMatch && stateMatch && ageMatch;
  });

  const senate = filtered.filter(m => m.role === 'Sen.');
  const house = filtered.filter(m => m.role === 'Rep.');

  buildCards(senate, 'senate-container');
  buildCards(house, 'house-container');
}

function renderStats() {
  const senate = allMembers.filter(m => m.role === 'Sen.');
  const house = allMembers.filter(m => m.role === 'Rep.');

  const getPartyStats = (group) => {
    const over65 = group.filter(m => calculateAge(m.birthDate) > 65);
    const rep = group.filter(m => m.party === 'Republican');
    const dem = group.filter(m => m.party === 'Democrat');

    const rep65 = rep.filter(m => calculateAge(m.birthDate) > 65).length;
    const dem65 = dem.filter(m => calculateAge(m.birthDate) > 65).length;

    return {
      totalOver65: over65.length,
      total: group.length,
      repPct: ((rep65 / rep.length) * 100 || 0).toFixed(1),
      demPct: ((dem65 / dem.length) * 100 || 0).toFixed(1),
      pct65: ((over65.length / group.length) * 100 || 0).toFixed(1)
    };
  };

  const getTermStats = (group) => {
    return ((group.filter(m => m.termCount > 2).length / group.length) * 100).toFixed(1);
  };

  const senStats = getPartyStats(senate);
  const repStats = getPartyStats(house);

  const senTerms = getTermStats(senate);
  const repTerms = getTermStats(house);

  const statsEl = document.getElementById('congress-stats');
  statsEl.innerHTML = `
    <h3>Congressional Age & Tenure Stats</h3>
    <ul>
      <li>👴🏼 ${senStats.pct65}% of Senators are over 65
        <ul>
          <li>🔴 ${senStats.repPct}% of Republican Senators</li>
          <li>🔵 ${senStats.demPct}% of Democrat Senators</li>
        </ul>
      </li>
      <li>👴🏼 ${repStats.pct65}% of Representatives are over 65
        <ul>
          <li>🔴 ${repStats.repPct}% of Republican Representatives</li>
          <li>🔵 ${repStats.demPct}% of Democrat Representatives</li>
        </ul>
      </li>
      <li>${senTerms}% of Senators have served more than 2 terms</li>
      <li>${repTerms}% of Representatives have served more than 2 terms</li>
    </ul>
  `;
}

function buildCards(members, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  members.sort((a, b) => calculateAge(b.birthDate) - calculateAge(a.birthDate));

  for (const m of members) {
    const age = calculateAge(m.birthDate);
    const tooOldNow = age > 65;
    const ageAtTermEnd = ageOn(m.termEnding, m.birthDate);
    const tooOldThen = ageAtTermEnd >= 64;

    const statusMsg = tooOldNow
      ? '⚰️ <strong>Too Old</strong>'
      : tooOldThen
      ? '⚠️ <strong>Will Be Too Old at Term End</strong>'
      : '👍🏻 <strong>Fit For Office</strong>';

    const partyClass = m.party === 'Democrat' ? 'democrat'
                     : m.party === 'Republican' ? 'republican'
                     : 'independent';

    const card = document.createElement('div');
    card.className = `card ${partyClass}`;
    card.innerHTML = `
      <div class="card-header">
        <img src="${m.photoUrl}" alt="${m.name}" onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(m.name)}&background=aaa&color=fff&size=100';" />
        <div class="card-main-info">
          <h3>${m.name}</h3>
          <ul>
            <li>Born: ${m.birthDate} (${age} years old)</li>
            <li>${m.state} - ${m.party}</li>
            <li>${formatYearsLabel(m.totalYears)} in Congress</li>
            <li>Serving Since: ${m.servingSince}</li>
            <li>Current Term Ends: ${m.termEnding}</li>
          </ul>
        </div>
      </div>
      <div class="card-bottom">
        <h3>${statusMsg}</h3>
        <div>${m.termSummary}</div>
      </div>
    `;
    container.appendChild(card);
  }
}

document.addEventListener('DOMContentLoaded', fetchCongressMembers);
document.addEventListener('DOMContentLoaded', () => {
  fetchCongressMembers().then(renderStats);
});

document.getElementById('filter-party').addEventListener('change', renderCards);
document.getElementById('filter-state').addEventListener('change', renderCards);
document.getElementById('filter-age').addEventListener('change', renderCards);
