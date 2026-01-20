require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

// Greek names for auto-generation
const greekFirstNames = [
  'Γιώργος', 'Μαρία', 'Νίκος', 'Ελένη', 'Δημήτρης', 'Αικατερίνη', 'Κώστας', 'Σοφία',
  'Παναγιώτης', 'Αναστασία', 'Ιωάννης', 'Χριστίνα', 'Αντώνης', 'Βασιλική', 'Μιχάλης',
  'Ευαγγελία', 'Σπύρος', 'Δέσποινα', 'Αλέξανδρος', 'Παρασκευή'
];

const greekLastNames = [
  'Παπαδόπουλος', 'Παπανικολάου', 'Οικονόμου', 'Γεωργίου', 'Αντωνίου', 'Νικολάου',
  'Κωνσταντίνου', 'Δημητρίου', 'Βασιλείου', 'Αθανασίου', 'Ιωάννου', 'Χριστοδούλου',
  'Παππάς', 'Σταματίου', 'Καραγιάννης', 'Μακρής', 'Αλεξίου', 'Πετρίδης'
];

const departments = ['Emergency Department', 'Cardiology', 'Radiology', 'Pharmacy', 'Laboratory'];

// Convert Greek name to Latin for username/email
function greekToLatin(text) {
  const map = {
    'Α': 'A', 'Β': 'V', 'Γ': 'G', 'Δ': 'D', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'I', 'Θ': 'Th',
    'Ι': 'I', 'Κ': 'K', 'Λ': 'L', 'Μ': 'M', 'Ν': 'N', 'Ξ': 'X', 'Ο': 'O', 'Π': 'P',
    'Ρ': 'R', 'Σ': 'S', 'Τ': 'T', 'Υ': 'Y', 'Φ': 'F', 'Χ': 'Ch', 'Ψ': 'Ps', 'Ω': 'O',
    'α': 'a', 'β': 'v', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'ζ': 'z', 'η': 'i', 'θ': 'th',
    'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'm', 'ν': 'n', 'ξ': 'x', 'ο': 'o', 'π': 'p',
    'ρ': 'r', 'σ': 's', 'ς': 's', 'τ': 't', 'υ': 'y', 'φ': 'f', 'χ': 'ch', 'ψ': 'ps', 'ω': 'o',
    'ά': 'a', 'έ': 'e', 'ή': 'i', 'ί': 'i', 'ό': 'o', 'ύ': 'y', 'ώ': 'o', 'ϊ': 'i', 'ϋ': 'y',
    'Ά': 'A', 'Έ': 'E', 'Ή': 'I', 'Ί': 'I', 'Ό': 'O', 'Ύ': 'Y', 'Ώ': 'O'
  };
  return text.split('').map(char => map[char] || char).join('');
}

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seedAdmin() {
  try {
    console.log('Δημιουργία Χρήστη Διαχειριστή\n');

    const username = await question('Όνομα χρήστη: ');
    const email = await question('Email: ');
    const password = await question('Κωδικός: ');

    if (!username || !email || !password) {
      console.error('Όλα τα πεδία είναι υποχρεωτικά!');
      rl.close();
      await pool.end();
      process.exit(1);
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
      [username, email, password_hash, 'admin']
    );

    const user = result.rows[0];

    console.log('\nΟ χρήστης διαχειριστή δημιουργήθηκε επιτυχώς!');
    console.log(`ID: ${user.id}`);
    console.log(`Όνομα χρήστη: ${user.username}`);
    console.log(`Email: ${user.email}`);
    console.log(`Ρόλος: ${user.role}`);

    rl.close();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Αποτυχία δημιουργίας χρήστη διαχειριστή:', error.message);
    rl.close();
    await pool.end();
    process.exit(1);
  }
}

async function seedDemoUsers() {
  try {
    console.log('Δημιουργία δοκιμαστικών χρηστών με ελληνικά δεδομένα...\n');

    const defaultPassword = await bcrypt.hash('password123', 10);
    const createdUsers = [];

    // Create 1 super_admin (with Internal department)
    const superAdminFirst = getRandomElement(greekFirstNames);
    const superAdminLast = getRandomElement(greekLastNames);
    const superAdminUsername = greekToLatin(superAdminFirst).toLowerCase() + '_admin';
    const superAdminResult = await pool.query(
      'INSERT INTO users (username, email, password_hash, role, department) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, role, department',
      [superAdminUsername, `${superAdminUsername}@example.com`, defaultPassword, 'super_admin', 'Internal']
    );
    createdUsers.push({ ...superAdminResult.rows[0], greekName: `${superAdminFirst} ${superAdminLast}` });

    // Create 2 admins (with Internal department)
    for (let i = 0; i < 2; i++) {
      const firstName = getRandomElement(greekFirstNames);
      const lastName = getRandomElement(greekLastNames);
      const username = greekToLatin(firstName).toLowerCase() + (i + 1);
      const result = await pool.query(
        'INSERT INTO users (username, email, password_hash, role, department) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, role, department',
        [username, `${username}@example.com`, defaultPassword, 'admin', 'Internal']
      );
      createdUsers.push({ ...result.rows[0], greekName: `${firstName} ${lastName}` });
    }

    // Create 5 department users
    for (let i = 0; i < 5; i++) {
      const firstName = getRandomElement(greekFirstNames);
      const lastName = getRandomElement(greekLastNames);
      const department = departments[i % departments.length];
      const username = greekToLatin(firstName).toLowerCase() + '_dept' + (i + 1);
      const result = await pool.query(
        'INSERT INTO users (username, email, password_hash, role, department) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, role, department',
        [username, `${username}@example.com`, defaultPassword, 'department', department]
      );
      createdUsers.push({ ...result.rows[0], greekName: `${firstName} ${lastName}` });
    }

    console.log('Δημιουργήθηκαν οι ακόλουθοι χρήστες:\n');
    console.log('═'.repeat(80));
    console.log('ID\tΡόλος\t\t\tΌνομα χρήστη\t\tΕλληνικό Όνομα\t\tΤμήμα');
    console.log('═'.repeat(80));

    createdUsers.forEach(user => {
      const role = user.role.padEnd(12);
      const username = user.username.padEnd(20);
      const greekName = (user.greekName || '').padEnd(20);
      const dept = user.department || '-';
      console.log(`${user.id}\t${role}\t${username}\t${greekName}\t${dept}`);
    });

    console.log('═'.repeat(80));
    console.log(`\nΣύνολο: ${createdUsers.length} χρήστες δημιουργήθηκαν`);
    console.log('Κωδικός για όλους: password123\n');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Αποτυχία δημιουργίας δοκιμαστικών χρηστών:', error.message);
    await pool.end();
    process.exit(1);
  }
}

// Check command line arguments
const args = process.argv.slice(2);
if (args.includes('--demo') || args.includes('-d')) {
  seedDemoUsers();
} else {
  seedAdmin();
}
