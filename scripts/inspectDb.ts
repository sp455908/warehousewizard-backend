import 'dotenv/config';
import { prisma } from '../server/config/prisma';

async function main() {
	console.log('Inspecting database tables (excluding User, Warehouse)...');

	try {
		const results: Record<string, unknown> = {};

		results.Booking = await prisma.booking.findMany({ include: { customer: true, warehouse: true, quote: true } });
		results.Quote = await prisma.quote.findMany({ include: { customer: true, warehouse: true } });
		results.CargoDispatchDetail = await prisma.cargoDispatchDetail.findMany({ include: { booking: true, approvedBy: true } });
		results.DeliveryRequest = await prisma.deliveryRequest.findMany({ include: { booking: true, customer: true } });
		results.DeliveryAdvice = await prisma.deliveryAdvice.findMany({ include: { booking: true, customer: true } });
		results.DeliveryOrder = await prisma.deliveryOrder.findMany({ include: { booking: true, customer: true, warehouse: true, deliveryAdvice: true } });
		results.DeliveryReport = await prisma.deliveryReport.findMany({ include: { booking: true, customer: true, warehouse: true, deliveryOrder: true } });
		results.RFQ = await prisma.rFQ.findMany({ include: { quote: true, warehouse: true, rates: true } });
		results.Rate = await prisma.rate.findMany({ include: { rfq: true, warehouse: true } });
		results.CartingDetail = await prisma.cartingDetail.findMany({ include: { booking: true, warehouse: true } });
		results.Invoice = await prisma.invoice.findMany({ include: { booking: true, customer: true } });
		results.FormSubmission = await prisma.formSubmission.findMany({ include: { customer: true, quote: true, warehouse: true } });
		results.WorkflowEvent = await prisma.workflowEvent.findMany();

		console.dir(results, { depth: null, colors: true });
	} catch (error) {
		console.error('Failed to inspect database:', error);
	} finally {
		await prisma.$disconnect();
	}
}

main();
