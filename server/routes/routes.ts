import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertQuoteSchema, insertBookingSchema, insertCargoDispatchSchema, insertDeliveryRequestSchema, insertInvoiceSchema, insertUserSchema, insertWarehouseSchema } from "@shared/schema";
import { z } from "zod";
// Import the hashPassword function from auth.ts to avoid duplication
import { hashPassword } from "./auth";

// Security validation function
function validatePasswordSecurity(originalPassword: string, storedPassword: string): boolean {
  // Check if password is properly hashed (should contain a dot for hash.salt format)
  if (!storedPassword.includes('.')) {
    console.error("❌ SECURITY ALERT: Password not properly hashed!");
    return false;
  }
  
  // Check if stored password is different from original (should be hashed)
  if (storedPassword === originalPassword) {
    console.error("❌ SECURITY ALERT: Password stored in plain text!");
    return false;
  }
  
  // Check if hash format is correct (should be hex string + dot + hex string)
  const [hash, salt] = storedPassword.split('.');
  if (!hash || !salt || hash.length < 64 || salt.length < 32) {
    console.error("❌ SECURITY ALERT: Invalid hash format!");
    return false;
  }
  
  console.log("✅ Password security validation passed");
  return true;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);

  // Quote management routes
  app.get("/api/quotes", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      let quotes;
      if (req.user!.role === "customer") {
        quotes = await storage.getQuotesByCustomer(req.user!._id.toString());
      } else if (req.user!.role === "purchase_support") {
        quotes = await storage.getQuotesByStatus("pending");
      } else if (req.user!.role === "sales_support") {
        quotes = await storage.getQuotesByStatus("processing");
      } else {
        quotes = await storage.getAllQuotes();
      }
      res.json(quotes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  app.post("/api/quotes", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const quoteData = insertQuoteSchema.parse({
        ...req.body,
        customerId: req.user!._id.toString(),
      });
      const quote = await storage.createQuote(quoteData);
      res.status(201).json(quote);
    } catch (error) {
      res.status(400).json({ message: "Invalid quote data", error });
    }
  });

  app.patch("/api/quotes/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const id = req.params.id;
      const updateData = req.body;
      const quote = await storage.updateQuote(id, updateData);
      res.json(quote);
    } catch (error) {
      res.status(400).json({ message: "Failed to update quote" });
    }
  });

  app.post("/api/quotes/:id/assign", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "purchase_support") {
      return res.sendStatus(403);
    }
    
    try {
      const id = req.params.id;
      const { assignedTo } = req.body;
      const quote = await storage.assignQuote(id, assignedTo);
      res.json(quote);
    } catch (error) {
      res.status(400).json({ message: "Failed to assign quote" });
    }
  });

  // Booking management routes
  app.get("/api/bookings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      let bookings;
      if (req.user!.role === "customer") {
        bookings = await storage.getBookingsByCustomer(req.user!._id.toString());
      } else if (req.user!.role === "supervisor") {
        bookings = await storage.getBookingsByStatus("pending");
      } else {
        bookings = await storage.getAllBookings();
      }
      res.json(bookings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  app.post("/api/bookings", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const bookingData = insertBookingSchema.parse({
        ...req.body,
        customerId: req.user!._id.toString(),
      });
      const booking = await storage.createBooking(bookingData);
      res.status(201).json(booking);
    } catch (error) {
      res.status(400).json({ message: "Invalid booking data", error });
    }
  });

  app.patch("/api/bookings/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const id = req.params.id;
      const updateData = req.body;
      const booking = await storage.updateBooking(id, updateData);
      res.json(booking);
    } catch (error) {
      res.status(400).json({ message: "Failed to update booking" });
    }
  });

  // Cargo dispatch routes
  app.get("/api/cargo-dispatch", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const { bookingId, status } = req.query;
      let cargoItems;
      
      if (bookingId) {
        cargoItems = await storage.getCargoDispatchByBooking(bookingId as string);
      } else if (status) {
        cargoItems = await storage.getCargoDispatchByStatus(status as string);
      } else {
        cargoItems = await storage.getCargoDispatchByStatus("submitted");
      }
      
      res.json(cargoItems);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch cargo dispatch details" });
    }
  });

  app.post("/api/cargo-dispatch", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const cargoData = insertCargoDispatchSchema.parse(req.body);
      const cargo = await storage.createCargoDispatch(cargoData);
      res.status(201).json(cargo);
    } catch (error) {
      res.status(400).json({ message: "Invalid cargo dispatch data", error });
    }
  });

  app.patch("/api/cargo-dispatch/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const id = req.params.id;
      const updateData = req.body;
      const cargo = await storage.updateCargoDispatch(id, updateData);
      res.json(cargo);
    } catch (error) {
      res.status(400).json({ message: "Failed to update cargo dispatch" });
    }
  });

  // Delivery request routes
  app.get("/api/delivery-requests", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      let deliveryRequests;
      if (req.user!.role === "customer") {
        deliveryRequests = await storage.getDeliveryRequestsByCustomer(req.user!._id.toString());
      } else {
        const { status } = req.query;
        deliveryRequests = status 
          ? await storage.getDeliveryRequestsByStatus(status as string)
          : await storage.getDeliveryRequestsByStatus("requested");
      }
      res.json(deliveryRequests);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch delivery requests" });
    }
  });

  app.post("/api/delivery-requests", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const deliveryData = insertDeliveryRequestSchema.parse({
        ...req.body,
        customerId: req.user!._id.toString(),
      });
      const delivery = await storage.createDeliveryRequest(deliveryData);
      res.status(201).json(delivery);
    } catch (error) {
      res.status(400).json({ message: "Invalid delivery request data", error });
    }
  });

  app.patch("/api/delivery-requests/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const id = req.params.id;
      const updateData = req.body;
      const delivery = await storage.updateDeliveryRequest(id, updateData);
      res.json(delivery);
    } catch (error) {
      res.status(400).json({ message: "Failed to update delivery request" });
    }
  });

  // Invoice routes
  app.get("/api/invoices", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      let invoices;
      if (req.user!.role === "customer") {
        invoices = await storage.getInvoicesByCustomer(req.user!._id.toString());
      } else {
        const { status } = req.query;
        invoices = status 
          ? await storage.getInvoicesByStatus(status as string)
          : await storage.getInvoicesByStatus("sent");
      }
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.post("/api/invoices", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "accounts") {
      return res.sendStatus(403);
    }
    
    try {
      const invoiceData = insertInvoiceSchema.parse(req.body);
      const invoice = await storage.createInvoice(invoiceData);
      res.status(201).json(invoice);
    } catch (error) {
      res.status(400).json({ message: "Invalid invoice data", error });
    }
  });

  app.patch("/api/invoices/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const id = req.params.id;
      const updateData = req.body;
      const invoice = await storage.updateInvoice(id, updateData);
      res.json(invoice);
    } catch (error) {
      res.status(400).json({ message: "Failed to update invoice" });
    }
  });

  // Warehouse routes
  app.get("/api/warehouses", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const { city, state, storageType } = req.query;
      let warehouses;
      
      if (city && state) {
        warehouses = await storage.getWarehousesByLocation(city as string, state as string);
      } else if (storageType) {
        warehouses = await storage.getWarehousesByType(storageType as string);
      } else {
        warehouses = await storage.getAllWarehouses();
      }
      
      res.json(warehouses);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch warehouses" });
    }
  });

  app.post("/api/warehouses", async (req, res) => {
    if (!req.isAuthenticated() || !["admin", "warehouse", "supervisor"].includes(req.user!.role)) {
      return res.sendStatus(403);
    }
    
    try {
      console.log("Received warehouse payload:", req.body); // Log incoming payload
      const warehouseData = insertWarehouseSchema.parse(req.body);
      const warehouse = await storage.createWarehouse(warehouseData);
      res.status(201).json(warehouse);
    } catch (error) {
      console.error("Warehouse validation error:", error);
      res.status(400).json({ message: "Invalid warehouse data", error });
    }
  });

  app.patch("/api/warehouses/:id", async (req, res) => {
    if (!req.isAuthenticated() || !["admin", "warehouse", "supervisor"].includes(req.user!.role)) {
      return res.sendStatus(403);
    }
    
    try {
      const id = req.params.id;
      const updateData = req.body;
      const warehouse = await storage.updateWarehouse(id, updateData);
      res.json(warehouse);
    } catch (error) {
      res.status(400).json({ message: "Failed to update warehouse" });
    }
  });

  app.delete("/api/warehouses/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.sendStatus(403);
    }
    
    try {
      const id = req.params.id;
      await storage.deleteWarehouse(id);
      res.json({ message: "Warehouse deleted successfully" });
    } catch (error) {
      res.status(400).json({ message: "Failed to delete warehouse" });
    }
  });

  // User management routes (Admin only)
  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.sendStatus(403);
    }
    
    try {
      const { role } = req.query;
      const users = role 
        ? await storage.getUsersByRole(role as string)
        : await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post("/api/users", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.sendStatus(403);
    }
    
    try {
      // Admin creates internal users (non-customers)
      const userData = insertUserSchema.parse(req.body);
      if (userData.role === "customer") {
        return res.status(400).json({ message: "Customers must self-register" });
      }
      
      console.log("🔐 ADMIN USER CREATION PROCESS:");
      console.log("📧 Email:", userData.email);
      console.log("👤 Role:", userData.role);
      console.log("🔑 Original password:", userData.password);
      
      // Hash the password before creating the user
      const hashedPassword = await hashPassword(userData.password);
      console.log("🔒 Hashed password:", hashedPassword);
      console.log("✅ Password format verified:", hashedPassword.includes('.') ? "HASH.SALT format" : "INVALID FORMAT");
      
      // Create user with hashed password
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword, // ✅ SECURE: Password is hashed before storage
      });
      
      console.log("🎉 User created successfully!");
      console.log("📊 Stored password in DB:", user.password);
      console.log("🔍 Password is hashed:", user.password !== userData.password);
      
      // Security validation
      const isPasswordSecure = validatePasswordSecurity(userData.password, user.password);
      if (!isPasswordSecure) {
        console.error("🚨 CRITICAL: Password security validation failed!");
        // Still return success but log the security issue
      }
      
      // Return user without exposing the hashed password in response
      const { password, ...userResponse } = user.toObject ? user.toObject() : user;
      res.status(201).json(userResponse);
    } catch (error) {
      console.error("❌ Error creating user:", error);
      res.status(400).json({ message: "Invalid user data", error });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.sendStatus(403);
    }
    
    try {
      const id = req.params.id;
      const updateData = req.body;
      const user = await storage.updateUser(id, updateData);
      res.json(user);
    } catch (error) {
      res.status(400).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.sendStatus(403);
    }
    
    try {
      const id = req.params.id;
      
      // Prevent admin from deleting themselves
      if (id === req.user!._id.toString()) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      await storage.deleteUser(id);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      res.status(400).json({ message: "Failed to delete user" });
    }
  });

  // Fix plain text passwords endpoint (Admin only)
  app.post("/api/fix-passwords", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.sendStatus(403);
    }
    
    try {
      console.log("🔧 ADMIN REQUESTED PASSWORD FIX");
      
      // Get all users
      const allUsers = await storage.getAllUsers();
      console.log(`📊 Found ${allUsers.length} users to check`);
      
      let fixedCount = 0;
      let alreadyHashedCount = 0;
      const results = [];
      
      for (const user of allUsers) {
        const userResult = {
          email: user.email,
          role: user.role,
          wasFixed: false,
          message: ""
        };
        
        // Check if password is properly hashed
        if (validatePasswordSecurity("dummy", user.password)) {
          userResult.message = "Password already properly hashed";
          alreadyHashedCount++;
        } else {
          console.log(`🔧 Fixing password for: ${user.email}`);
          
          try {
            // For plain text passwords, we need to hash them
            // Since we don't have the original password, we'll set a default one
            const defaultPassword = "Welcome123!"; // Default password for fixed users
            const hashedPassword = await hashPassword(defaultPassword);
            
            // Update user with hashed password
            await storage.updateUser(user._id.toString(), { password: hashedPassword });
            
            userResult.wasFixed = true;
            userResult.message = `Password fixed. New password: ${defaultPassword}`;
            fixedCount++;
            
            console.log(`✅ Fixed password for: ${user.email}`);
                     } catch (error) {
             const errorMessage = error instanceof Error ? error.message : 'Unknown error';
             userResult.message = `Failed to fix: ${errorMessage}`;
             console.error(`❌ Failed to fix password for ${user.email}:`, error);
           }
        }
        
        results.push(userResult);
      }
      
      console.log(`📈 PASSWORD FIX SUMMARY:`);
      console.log(`✅ Fixed: ${fixedCount} users`);
      console.log(`✅ Already hashed: ${alreadyHashedCount} users`);
      
      res.json({
        message: `Password fix completed. Fixed ${fixedCount} users, ${alreadyHashedCount} already secure.`,
        results,
        summary: {
          total: allUsers.length,
          fixed: fixedCount,
          alreadyHashed: alreadyHashedCount
        }
      });
         } catch (error) {
       console.error("❌ Password fix failed:", error);
       const errorMessage = error instanceof Error ? error.message : 'Unknown error';
       res.status(500).json({ message: "Failed to fix passwords", error: errorMessage });
    }
  });

  // OTP verification routes
  app.post("/api/verify-otp", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const { type, code } = req.body;
      const otp = await storage.getValidOtp(req.user!._id.toString(), type, code);
      
      if (!otp) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
      }
      
      await storage.markOtpAsUsed(otp._id.toString());
      
      // Update user verification status
      const updateField = type === "email" ? "isEmailVerified" : "isMobileVerified";
      await storage.updateUser(req.user!._id.toString(), { [updateField]: true });
      
      res.json({ message: "OTP verified successfully" });
    } catch (error) {
      res.status(400).json({ message: "OTP verification failed" });
    }
  });

  app.post("/api/send-otp", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const { type } = req.body; // "email" or "mobile"
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      await storage.createOtp({
        userId: req.user!._id.toString(),
        type,
        code,
        expiresAt,
        isUsed: false,
      });
      
      // TODO: Send actual OTP via email/SMS service
      console.log(`OTP for ${type}: ${code}`);
      
      res.json({ message: `OTP sent to your ${type}` });
    } catch (error) {
      res.status(500).json({ message: "Failed to send OTP" });
    }
  });



  const httpServer = createServer(app);
  return httpServer;
}
