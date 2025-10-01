const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupDuplicateRFQs() {
  try {
    console.log('🔍 Finding duplicate RFQs...');
    
    // Find RFQs with same quoteId and warehouseId
    const duplicates = await prisma.$queryRaw`
      SELECT 
        "quoteId", 
        "warehouseId", 
        COUNT(*) as count,
        array_agg(id) as rfq_ids
      FROM "RFQ" 
      WHERE "warehouseId" IS NOT NULL
      GROUP BY "quoteId", "warehouseId" 
      HAVING COUNT(*) > 1
    `;
    
    console.log(`Found ${duplicates.length} duplicate RFQ groups`);
    
    for (const duplicate of duplicates) {
      console.log(`\n📦 Quote: ${duplicate.quoteId}, Warehouse: ${duplicate.warehouseId}`);
      console.log(`   RFQ IDs: ${duplicate.rfq_ids.join(', ')}`);
      
      // Keep the first RFQ, delete the rest
      const rfqIdsToDelete = duplicate.rfq_ids.slice(1);
      
      for (const rfqId of rfqIdsToDelete) {
        // First delete associated rates
        await prisma.rate.deleteMany({
          where: { rfqId: rfqId }
        });
        
        // Then delete the RFQ
        await prisma.rFQ.delete({
          where: { id: rfqId }
        });
        
        console.log(`   ✅ Deleted RFQ: ${rfqId}`);
      }
    }
    
    console.log('\n🎉 Cleanup completed!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupDuplicateRFQs();