/**
 * Seed payment methods into the `payment_methods` table.
 *
 * Run:
 *   npm run seed:payment-methods
 */
require('dotenv').config();

const { sequelize, closeConnection } = require('../config/database');
const PaymentMethod = require('../models/PaymentMethod');

function toRegion(currency) {
  if (currency === 'MMK') return 'Myanmar';
  if (currency === 'THB') return 'Thailand';
  return null;
}

const seedAccounts = [
  // MMK
  { payment_type: 'Wave Pay', account_name: 'Nay Myo Tun', account_number: '09404466692', currency: 'MMK' },
  { payment_type: 'KBZ Pay', account_name: 'Nay Myo Tun', account_number: '09404466692', currency: 'MMK' },
  { payment_type: 'AYA Pay', account_name: 'Nay Myo Tun', account_number: '09404466692', currency: 'MMK' },
  { payment_type: 'UAB Pay', account_name: 'Nay Myo Tun', account_number: '09404466692', currency: 'MMK' },
  { payment_type: 'CB Bank', account_name: 'Nay Myo Tun', account_number: '0179-1009-0000-2337', currency: 'MMK' },

  // THB
  { payment_type: 'Krungthai Bank', account_name: 'Mr. Nay Myo Tun', account_number: '5010-802-937', currency: 'THB' }
];

async function upsertByNaturalKey({ payment_type, account_name, account_number, region, is_active }) {
  const existing = await PaymentMethod.findOne({
    where: { payment_type, account_number, region }
  });

  if (existing) {
    await existing.update({ account_name, is_active });
    return { action: 'updated', id: existing.id };
  }

  const created = await PaymentMethod.create({
    payment_type,
    account_name,
    account_number,
    region,
    is_active
  });
  return { action: 'created', id: created.id };
}

async function main() {
  console.log('🌱 Seeding payment methods...');

  try {
    await sequelize.authenticate();
    console.log('✅ DB connected');

    let created = 0;
    let updated = 0;

    for (const acct of seedAccounts) {
      const region = toRegion(acct.currency);
      if (!region) {
        console.warn('⚠️  Skipped (unknown currency):', acct);
        continue;
      }

      const result = await upsertByNaturalKey({
        payment_type: acct.payment_type,
        account_name: acct.account_name,
        account_number: acct.account_number,
        region,
        is_active: 'active'
      });

      if (result.action === 'created') created += 1;
      if (result.action === 'updated') updated += 1;

      console.log(`- ${result.action.toUpperCase()} #${result.id}: [${region}] ${acct.payment_type} / ${acct.account_name} / ${acct.account_number}`);
    }

    console.log(`✅ Done. created=${created}, updated=${updated}`);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
  } finally {
    await closeConnection();
  }
}

main();

