import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
export declare class BookingController {
    createBooking(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getBookings(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getBookingById(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    updateBooking(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    confirmBooking(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    cancelBooking(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    approveBooking(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    rejectBooking(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getPendingBookings(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getConfirmedBookings(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getActiveBookings(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getCompletedBookings(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
export declare const bookingController: BookingController;
//# sourceMappingURL=bookingController.d.ts.map