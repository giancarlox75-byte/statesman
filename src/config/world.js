// Static world data: states, voter blocs, issues, parties, offices.
// Everything that "decides" an outcome (elections, NPC votes, approval) reads from here,
// so tuning the game mostly means editing this file.

// ---------- Issues ----------
// Every issue is a scale from -3 (most progressive) to +3 (most conservative).
// `labels` describe each integer step, used for laws, bill text and position pickers.
const ISSUES = {
  taxes: {
    name: 'Taxes & Spending',
    labels: ['Wealth tax, expansive public programs', 'Steep progressive brackets', 'Modestly higher top rates', 'Status quo rates', 'Broad middle-class tax cuts', 'Deep across-the-board cuts', 'Flat tax, minimal government'],
  },
  healthcare: {
    name: 'Healthcare',
    labels: ['Single-payer national system', 'Public option for everyone', 'Expanded subsidies & coverage', 'Mixed public/private system', 'Market-based plans with tax credits', 'Deregulated private insurance', 'Fully private, no federal role'],
  },
  guns: {
    name: 'Gun Policy',
    labels: ['Ban & buyback of most firearms', 'Assault weapons ban + licensing', 'Universal background checks', 'Current federal rules', 'Expanded concealed carry', 'Repeal most federal gun laws', 'Constitutional carry everywhere'],
  },
  immigration: {
    name: 'Immigration',
    labels: ['Open borders, broad amnesty', 'Path to citizenship for all residents', 'Dreamer protections, more visas', 'Current enforcement levels', 'More border enforcement', 'Border wall, cut legal immigration', 'Mass deportation, immigration freeze'],
  },
  climate: {
    name: 'Energy & Climate',
    labels: ['Ban fossil fuels within a decade', 'Green New Deal investments', 'Carbon tax & clean energy credits', 'All-of-the-above energy', 'Expand drilling on federal land', 'Repeal emissions rules', 'Fossil-fuel subsidies, exit climate deals'],
  },
  labor: {
    name: 'Labor & Wages',
    labels: ['$25 minimum wage, sectoral bargaining', '$20 minimum wage, easy unionizing', '$15 minimum wage', 'Current wage & union law', 'Right-to-work encouraged', 'National right-to-work law', 'Abolish minimum wage'],
  },
  crime: {
    name: 'Criminal Justice',
    labels: ['Abolish cash bail, defund police', 'Sweeping sentencing reform', 'Police accountability measures', 'Current justice policy', 'More police funding', 'Mandatory minimums expanded', 'Maximum enforcement, death penalty expansion'],
  },
  social: {
    name: 'Social Policy',
    labels: ['Federal protections for all social rights', 'Codify broad civil liberties', 'Mostly progressive social laws', 'Leave it to the states', 'Mostly traditional social laws', 'Federal traditional-values laws', 'Strict national traditional-values code'],
  },
};
const ISSUE_KEYS = Object.keys(ISSUES);

// How a law moving from `from` to `to` nudges the economy. delta > 0 = conservative shift.
const ECONOMIC_EFFECTS = {
  taxes:       { growth: 0.12, unemployment: -0.05, deficit: 0.35 },
  healthcare:  { growth: 0.04, unemployment: 0,     deficit: -0.25 },
  guns:        { growth: 0,    unemployment: 0,     deficit: 0 },
  immigration: { growth: -0.06, unemployment: 0.02, deficit: 0.02 },
  climate:     { growth: 0.05, unemployment: -0.02, deficit: -0.05 },
  labor:       { growth: 0.06, unemployment: -0.04, deficit: 0 },
  crime:       { growth: 0,    unemployment: 0,     deficit: 0.05 },
  social:      { growth: 0,    unemployment: 0,     deficit: 0 },
};

// ---------- Voter blocs ----------
// prefs: where the bloc sits on each issue. salience: how much it cares (1 = normal).
// lean: partisan lean, -1 (Democratic) .. +1 (Republican). turnout: base share that votes.
const BLOCS = {
  urban_professionals: {
    name: 'Urban Professionals', lean: -0.6, turnout: 0.70,
    prefs: { taxes: -1, healthcare: -2, guns: -2.5, immigration: -2, climate: -2.5, labor: -1, crime: -1.5, social: -2.5 },
    salience: { climate: 1.5, social: 1.3, guns: 1.2 },
  },
  working_class: {
    name: 'Working Families', lean: -0.1, turnout: 0.50,
    prefs: { taxes: -1.5, healthcare: -1.5, guns: 1, immigration: 1, climate: 0.5, labor: -2.5, crime: 1, social: 0.5 },
    salience: { labor: 1.8, healthcare: 1.4, taxes: 1.2 },
  },
  suburban: {
    name: 'Suburban Moderates', lean: 0, turnout: 0.65,
    prefs: { taxes: 0.5, healthcare: -0.5, guns: -0.5, immigration: 0, climate: -0.5, labor: 0, crime: 0.5, social: -0.5 },
    salience: { taxes: 1.3, crime: 1.2, healthcare: 1.2 },
  },
  rural: {
    name: 'Rural Voters', lean: 0.6, turnout: 0.60,
    prefs: { taxes: 1.5, healthcare: 1, guns: 2.8, immigration: 2, climate: 2, labor: 0.5, crime: 1.5, social: 2 },
    salience: { guns: 1.8, climate: 1.3, immigration: 1.2 },
  },
  small_business: {
    name: 'Small Business Owners', lean: 0.4, turnout: 0.70,
    prefs: { taxes: 2.5, healthcare: 1, guns: 1, immigration: 0.5, climate: 1, labor: 2.5, crime: 1, social: 0.5 },
    salience: { taxes: 1.8, labor: 1.6 },
  },
  religious: {
    name: 'Religious Conservatives', lean: 0.6, turnout: 0.70,
    prefs: { taxes: 1, healthcare: 0.5, guns: 1.5, immigration: 1, climate: 1, labor: 0, crime: 1.5, social: 3 },
    salience: { social: 2.0, crime: 1.1 },
  },
  young: {
    name: 'Young Voters', lean: -0.5, turnout: 0.35,
    prefs: { taxes: -1, healthcare: -2, guns: -1.5, immigration: -1.5, climate: -2.8, labor: -1.5, crime: -1.5, social: -2.5 },
    salience: { climate: 1.6, healthcare: 1.3, social: 1.2 },
  },
  seniors: {
    name: 'Seniors', lean: 0.15, turnout: 0.75,
    prefs: { taxes: 0.5, healthcare: -1, guns: 1, immigration: 1, climate: 0.5, labor: 0, crime: 2, social: 1 },
    salience: { healthcare: 1.8, crime: 1.3 },
  },
};
const BLOC_KEYS = Object.keys(BLOCS);

// ---------- Parties ----------
const PARTIES = {
  D: {
    name: 'Democratic Party', short: 'Democrat', lean: -1, color: '#2F6FD0',
    platform: { taxes: -1.5, healthcare: -2, guns: -2, immigration: -1.5, climate: -2, labor: -2, crime: -1, social: -2 },
  },
  R: {
    name: 'Republican Party', short: 'Republican', lean: 1, color: '#D0402F',
    platform: { taxes: 2, healthcare: 1.5, guns: 2.5, immigration: 2, climate: 1.5, labor: 1.5, crime: 2, social: 2 },
  },
  I: {
    name: 'Independent', short: 'Independent', lean: 0, color: '#7A7F87',
    platform: null,
  },
};
const MAJOR_PARTIES = ['D', 'R'];

// ---------- States ----------
// [code, name, house seats (scaled-down chamber), lean (-1 D .. +1 R), urban, religious, union, seniors]
const STATE_ROWS = [
  ['AL', 'Alabama', 1, 0.7, 0.55, 0.85, 0.25, 0.5],
  ['AK', 'Alaska', 1, 0.4, 0.60, 0.45, 0.55, 0.35],
  ['AZ', 'Arizona', 2, 0.1, 0.85, 0.55, 0.20, 0.6],
  ['AR', 'Arkansas', 1, 0.8, 0.50, 0.85, 0.20, 0.5],
  ['CA', 'California', 10, -0.6, 0.95, 0.40, 0.50, 0.4],
  ['CO', 'Colorado', 2, -0.2, 0.85, 0.45, 0.30, 0.4],
  ['CT', 'Connecticut', 1, -0.35, 0.85, 0.40, 0.55, 0.55],
  ['DE', 'Delaware', 1, -0.35, 0.80, 0.45, 0.40, 0.6],
  ['FL', 'Florida', 6, 0.3, 0.90, 0.60, 0.20, 0.85],
  ['GA', 'Georgia', 3, 0.1, 0.75, 0.75, 0.20, 0.4],
  ['HI', 'Hawaii', 1, -0.65, 0.90, 0.40, 0.70, 0.6],
  ['ID', 'Idaho', 1, 0.9, 0.65, 0.70, 0.20, 0.5],
  ['IL', 'Illinois', 3, -0.35, 0.88, 0.50, 0.55, 0.45],
  ['IN', 'Indiana', 2, 0.5, 0.70, 0.65, 0.40, 0.45],
  ['IA', 'Iowa', 1, 0.3, 0.60, 0.60, 0.35, 0.55],
  ['KS', 'Kansas', 1, 0.5, 0.70, 0.65, 0.25, 0.45],
  ['KY', 'Kentucky', 1, 0.8, 0.55, 0.75, 0.35, 0.5],
  ['LA', 'Louisiana', 1, 0.6, 0.70, 0.80, 0.20, 0.45],
  ['ME', 'Maine', 1, -0.1, 0.40, 0.35, 0.45, 0.75],
  ['MD', 'Maryland', 2, -0.6, 0.85, 0.50, 0.45, 0.45],
  ['MA', 'Massachusetts', 2, -0.7, 0.92, 0.30, 0.55, 0.5],
  ['MI', 'Michigan', 3, 0, 0.75, 0.55, 0.65, 0.5],
  ['MN', 'Minnesota', 2, -0.05, 0.75, 0.50, 0.55, 0.45],
  ['MS', 'Mississippi', 1, 0.55, 0.45, 0.90, 0.20, 0.45],
  ['MO', 'Missouri', 2, 0.5, 0.70, 0.70, 0.40, 0.5],
  ['MT', 'Montana', 1, 0.5, 0.55, 0.55, 0.45, 0.6],
  ['NE', 'Nebraska', 1, 0.6, 0.70, 0.65, 0.30, 0.45],
  ['NV', 'Nevada', 1, 0.05, 0.94, 0.45, 0.45, 0.5],
  ['NH', 'New Hampshire', 1, 0, 0.60, 0.30, 0.30, 0.6],
  ['NJ', 'New Jersey', 2, -0.3, 0.94, 0.50, 0.55, 0.5],
  ['NM', 'New Mexico', 1, -0.15, 0.75, 0.55, 0.25, 0.55],
  ['NY', 'New York', 5, -0.5, 0.88, 0.45, 0.70, 0.5],
  ['NC', 'North Carolina', 3, 0.15, 0.66, 0.75, 0.15, 0.5],
  ['ND', 'North Dakota', 1, 0.9, 0.60, 0.65, 0.25, 0.45],
  ['OH', 'Ohio', 3, 0.3, 0.78, 0.60, 0.50, 0.55],
  ['OK', 'Oklahoma', 1, 0.9, 0.66, 0.80, 0.20, 0.45],
  ['OR', 'Oregon', 1, -0.3, 0.81, 0.35, 0.50, 0.55],
  ['PA', 'Pennsylvania', 3, 0.1, 0.79, 0.55, 0.55, 0.6],
  ['RI', 'Rhode Island', 1, -0.4, 0.91, 0.40, 0.60, 0.55],
  ['SC', 'South Carolina', 1, 0.4, 0.66, 0.80, 0.10, 0.6],
  ['SD', 'South Dakota', 1, 0.8, 0.57, 0.70, 0.20, 0.5],
  ['TN', 'Tennessee', 2, 0.7, 0.66, 0.85, 0.20, 0.5],
  ['TX', 'Texas', 8, 0.25, 0.85, 0.70, 0.15, 0.35],
  ['UT', 'Utah', 1, 0.65, 0.90, 0.80, 0.20, 0.3],
  ['VT', 'Vermont', 1, -0.8, 0.40, 0.25, 0.45, 0.65],
  ['VA', 'Virginia', 2, -0.1, 0.76, 0.60, 0.25, 0.5],
  ['WA', 'Washington', 2, -0.4, 0.84, 0.35, 0.60, 0.45],
  ['WV', 'West Virginia', 1, 1.0, 0.49, 0.75, 0.50, 0.65],
  ['WI', 'Wisconsin', 2, 0.05, 0.70, 0.50, 0.45, 0.55],
  ['WY', 'Wyoming', 1, 1.0, 0.65, 0.65, 0.25, 0.5],
];
const STATES = {};
for (const [code, name, houseSeats, lean, urban, religious, union, seniors] of STATE_ROWS) {
  STATES[code] = { code, name, houseSeats, lean, urban, religious, union, seniors, electoralVotes: houseSeats + 2 };
}
const STATE_CODES = Object.keys(STATES);

// ---------- Executive & judiciary ----------
const CABINET_POSTS = {
  state:    { name: 'Secretary of State', bloc: 'suburban' },
  treasury: { name: 'Secretary of the Treasury', bloc: 'small_business' },
  defense:  { name: 'Secretary of Defense', bloc: 'rural' },
  justice:  { name: 'Attorney General', bloc: 'seniors' },
  labor:    { name: 'Secretary of Labor', bloc: 'working_class' },
  health:   { name: 'Secretary of Health', bloc: 'seniors' },
  energy:   { name: 'Secretary of Energy', bloc: 'young' },
};
const COURT_SEATS = 9;

// ---------- NPC name generator ----------
const FIRST_NAMES = ['James', 'Mary', 'Robert', 'Linda', 'Michael', 'Patricia', 'David', 'Susan', 'William', 'Karen', 'Richard', 'Nancy', 'Thomas', 'Lisa', 'Charles', 'Margaret', 'Daniel', 'Sandra', 'Mark', 'Ashley', 'Paul', 'Donna', 'Steven', 'Carol', 'Andrew', 'Michelle', 'Kevin', 'Laura', 'Brian', 'Sharon', 'George', 'Angela', 'Edward', 'Rebecca', 'Ronald', 'Diane', 'Gary', 'Ruth', 'Eric', 'Teresa', 'Raymond', 'Gloria', 'Dennis', 'Janet', 'Walter', 'Carmen', 'Victor', 'Elena', 'Marcus', 'Priya', 'Tomas', 'Grace', 'Calvin', 'Rosa', 'Douglas', 'Helen', 'Hector', 'Naomi', 'Wesley', 'Irene'];
const LAST_NAMES = ['Whitfield', 'Harlan', 'Okafor', 'Brennan', 'Castellano', 'Pruitt', 'Lindqvist', 'Mercer', 'Delgado', 'Ashworth', 'Kowalski', 'Thornton', 'Nakamura', 'Fairbanks', 'Holloway', 'Reyes', 'Sutherland', 'Abernathy', 'Vance', 'Callahan', 'Dunmore', 'Ellison', 'Garrity', 'Hendricks', 'Iverson', 'Jessup', 'Kincaid', 'Langford', 'Marchetti', 'Novak', 'Oyelaran', 'Pemberton', 'Quinlan', 'Rutledge', 'Stanhope', 'Tolliver', 'Underwood', 'Valdez', 'Winslow', 'Yardley', 'Bancroft', 'Coleridge', 'Dorsey', 'Everly', 'Fitzgerald', 'Goodwin', 'Haskell', 'Ingram', 'McAllister', 'Osei', 'Park', 'Sandoval', 'Truong', 'Whitaker'];

module.exports = {
  ISSUES, ISSUE_KEYS, ECONOMIC_EFFECTS,
  BLOCS, BLOC_KEYS,
  PARTIES, MAJOR_PARTIES,
  STATES, STATE_CODES,
  CABINET_POSTS, COURT_SEATS,
  FIRST_NAMES, LAST_NAMES,
};
