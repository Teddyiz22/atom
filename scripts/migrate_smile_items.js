const { sequelize } = require('../config/database');
const Product = require('../models/Product');
const SmileSubItem = require('../models/SmileSubItem');

async function migrate() {
  const transaction = await sequelize.transaction();
  try {
    console.log('Starting migration...');

    // 1. Fetch all products with smileIDCombination
    const products = await Product.findAll({
      where: {
        // We can filter where smileIDCombination is not null if needed, 
        // but findAll is fine for small datasets
      },
      transaction
    });

    console.log(`Found ${products.length} products to check.`);

    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const product of products) {
      if (!product.smileIDCombination) {
        skippedCount++;
        continue;
      }

      const rawCombo = product.smileIDCombination.trim();
      if (!rawCombo) {
        skippedCount++;
        continue;
      }

      // Split by +
      const smileIds = rawCombo.split('+').map(s => s.trim()).filter(Boolean);

      if (smileIds.length === 0) {
        skippedCount++;
        continue;
      }

      console.log(`Processing Product ID ${product.id} (${product.name}) - Combo: ${rawCombo}`);

      // Determine amount per sub-item (simple distribution for now, as it's mostly for display/tracking)
      // Note: nmh_shop controller uses Product.price_mmk for wallet deduction, 
      // so this amount is informational or for partial refund logic if added later.
      const amountPerItem = product.price_mmk / smileIds.length;

      for (let i = 0; i < smileIds.length; i++) {
        const smileId = smileIds[i];
        
        try {
          // Check if already exists to avoid unique constraint violation if re-running
          const existing = await SmileSubItem.findOne({
            where: {
              productId: product.id,
              smileProductId: smileId,
              region: product.region
            },
            transaction
          });

          if (!existing) {
            await SmileSubItem.create({
              productId: product.id,
              smileProductId: smileId,
              name: product.name + (smileIds.length > 1 ? ` (Part ${i+1})` : ''),
              amount: amountPerItem,
              region: product.region,
              status: 'active',
              sortOrder: i + 1
            }, { transaction });
            createdCount++;
          } else {
            // Update existing?
            // console.log(`  Skipping existing sub-item ${smileId} for product ${product.id}`);
          }
        } catch (err) {
          console.error(`  Error creating sub-item for product ${product.id}, smileId ${smileId}:`, err.message);
          errorCount++;
        }
      }
    }

    await transaction.commit();
    console.log('Migration completed successfully.');
    console.log(`Created: ${createdCount}`);
    console.log(`Skipped (no combo or existing): ${skippedCount}`);
    console.log(`Errors: ${errorCount}`);

  } catch (error) {
    await transaction.rollback();
    console.error('Migration failed:', error);
  } finally {
    await sequelize.close();
  }
}

migrate();
