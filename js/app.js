async function fetchCongressMembers() {
  const response = await fetch('https://unitedstates.github.io/congress-legislators/legislators-current.json');
  const data = await response.json();

  return data.map(member => {
    const latestTerm = member.terms.at(-1); // Last item in 'terms' array

    return {
      name: `${member.name.first} ${member.name.last}`,
      role: latestTerm.type === 'rep' ? 'Rep.' : 'Sen.',
      state: latestTerm.state,
      party: latestTerm.party, // Now correctly pulled from latest term
      birthDate: member.bio.birthday,
      photoUrl: `https://unitedstates.github.io/images/congress/225x275/${member.id.bioguide}.jpg`
    };
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

function buildTable(members) {
  const tbody = document.querySelector('#age-table tbody');
  tbody.innerHTML = ''; // Clear old rows if any

  members.sort((a, b) => calculateAge(b.birthDate) - calculateAge(a.birthDate));

  for (const m of members) {
    const age = calculateAge(m.birthDate);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><img src="${m.photoUrl}" alt="${m.name}" width="60"></td>
      <td>${m.name}</td>
      <td>${m.role}</td>
      <td>${m.state}</td>
      <td>${m.party}</td>
      <td>${m.birthDate}</td>
      <td>${age}</td>
      <td>${age >= 65 ? '⚠️ Too Old' : '👍🏻 Fit To Serve'}</td>
    `;
    tbody.appendChild(row);
  }
}

fetchCongressMembers()
  .then(buildTable)
  .catch(err => {
    console.error('Failed to load Congress members:', err);
  });
