/**
 * Reset Passwords Script
 *
 * Resets passwords for test users to known values
 */

require('dotenv').config();
const User = require('../models/User');

async function resetPasswords() {
  console.log('Resetting user passwords...\n');

  try {
    // Reset superadmin password
    const superadmin = await User.findByUsername('superadmin');
    if (superadmin) {
      await User.updatePassword(superadmin.id, 'admin123');
      console.log('✓ Reset password for superadmin to: admin123');
    }

    // Reset department user passwords
    const departments = ['it.support', 'finance', 'general.support', 'human.resources', 'facilities'];

    for (const username of departments) {
      const user = await User.findByUsername(username);
      if (user) {
        await User.updatePassword(user.id, 'password123');
        console.log(`✓ Reset password for ${username} to: password123`);
      }
    }

    // Reset admin password
    const admin = await User.findByUsername('admin');
    if (admin) {
      await User.updatePassword(admin.id, 'admin123');
      console.log('✓ Reset password for admin to: admin123');
    }

    console.log('\n✅ All passwords reset successfully!');
    console.log('\nYou can now login with:');
    console.log('  - admin / admin123');
    console.log('  - superadmin / admin123');
    console.log('  - it.support / password123');
    console.log('  - (any dept user) / password123\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error resetting passwords:', error.message);
    process.exit(1);
  }
}

resetPasswords();
