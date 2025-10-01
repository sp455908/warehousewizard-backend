const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testWorkflowFields() {
  try {
    console.log('Testing workflow fields...');

    // Test Quote table
    const quotes = await prisma.quote.findMany({
      take: 1,
      select: {
        id: true,
        currentWorkflowStep: true,
        flowType: true,
        workflowHistory: true
      }
    });

    console.log('✅ Quote table workflow fields:', quotes[0] || 'No quotes found');

    // Test Booking table
    const bookings = await prisma.booking.findMany({
      take: 1,
      select: {
        id: true,
        currentWorkflowStep: true,
        workflowHistory: true
      }
    });

    console.log('✅ Booking table workflow fields:', bookings[0] || 'No bookings found');

    // Test RFQ table
    const rfqs = await prisma.rfq.findMany({
      take: 1,
      select: {
        id: true,
        currentWorkflowStep: true,
        workflowHistory: true
      }
    });

    console.log('✅ RFQ table workflow fields:', rfqs[0] || 'No RFQs found');

    console.log('🎉 All workflow fields are working correctly!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testWorkflowFields();
