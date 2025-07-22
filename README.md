# Warehouse Wizard - Production Backend

A comprehensive, production-ready warehouse management system backend built with Node.js, Express, MongoDB, and TypeScript.

## Features

### 🏗️ Architecture
- **Modular Design**: Clean separation of concerns with controllers, services, and middleware
- **Scalable Structure**: Organized codebase for easy maintenance and expansion
- **Production Ready**: Security, caching, rate limiting, and error handling

### 🔐 Authentication & Authorization
- JWT-based authentication
- Role-based access control (7 user roles)
- Password hashing with bcrypt
- Rate limiting for security

### 📦 Core Modules
- **Warehouse Management**: CRUD operations, search, filtering
- **Quote System**: Multi-step quote process with role-based workflows
- **Booking Management**: Complete booking lifecycle
- **Cargo Dispatch**: Inventory and cargo tracking
- **Delivery System**: End-to-end delivery management
- **Invoice Management**: Billing and payment processing
- **User Management**: Admin panel for user operations

### 🚀 Performance & Scalability
- Redis caching for improved performance
- Database connection pooling
- Compression middleware
- Optimized queries with MongoDB aggregation

### 📧 Notifications
- Email notifications (SMTP)
- SMS notifications (Twilio)
- Event-driven notification system

### 🛡️ Security
- Helmet.js for security headers
- CORS configuration
- Input validation with Zod
- SQL injection prevention
- Rate limiting

## User Roles & Permissions

1. **Customer**: Create quotes, manage bookings, track deliveries
2. **Purchase Support**: Process quote requests, verify customers
3. **Sales Support**: Review and approve quotes
4. **Warehouse**: Manage inventory, process cargo
5. **Supervisor**: Approve bookings, oversee operations
6. **Accounts**: Handle invoicing and payments
7. **Admin**: Full system access and user management

## Warehouse Categories

1. Domestic Dry
2. Domestic Reefer
3. Bonded Dry
4. Bonded Reefer
5. CFS Import
6. CFS Export Dry
7. CFS Export Reefer

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/forgot-password` - Password reset
- `POST /api/auth/guest` - Create guest user

### Warehouses
- `GET /api/warehouses` - List warehouses
- `GET /api/warehouses/search` - Search warehouses
- `GET /api/warehouses/types` - Get warehouse types
- `POST /api/warehouses` - Create warehouse (Admin)
- `PUT /api/warehouses/:id` - Update warehouse
- `DELETE /api/warehouses/:id` - Delete warehouse

### Quotes
- `POST /api/quotes` - Create quote request
- `GET /api/quotes` - Get quotes (role-based)
- `POST /api/quotes/:id/assign` - Assign quote to warehouse
- `POST /api/quotes/:id/approve` - Approve quote
- `POST /api/quotes/:id/reject` - Reject quote

### Bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings` - Get bookings
- `POST /api/bookings/:id/confirm` - Confirm booking (Supervisor)
- `POST /api/bookings/:id/approve` - Customer approval

### Cargo Dispatch
- `POST /api/cargo` - Create cargo dispatch
- `GET /api/cargo` - Get cargo dispatches
- `POST /api/cargo/:id/approve` - Approve cargo (Supervisor)
- `POST /api/cargo/:id/process` - Process cargo (Warehouse)

### Delivery
- `POST /api/delivery` - Create delivery request
- `GET /api/delivery` - Get delivery requests
- `POST /api/delivery/:id/schedule` - Schedule delivery
- `POST /api/delivery/:id/dispatch` - Dispatch delivery
- `GET /api/delivery/:id/track` - Track delivery

### Invoices
- `POST /api/invoices` - Create invoice (Accounts)
- `GET /api/invoices` - Get invoices
- `POST /api/invoices/:id/send` - Send invoice
- `POST /api/invoices/:id/pay` - Pay invoice (Customer)

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/customer` - Customer dashboard
- `GET /api/dashboard/purchase-support` - Purchase support dashboard
- `GET /api/dashboard/sales-support` - Sales support dashboard
- `GET /api/dashboard/warehouse` - Warehouse dashboard
- `GET /api/dashboard/supervisor` - Supervisor dashboard
- `GET /api/dashboard/accounts` - Accounts dashboard
- `GET /api/dashboard/admin` - Admin dashboard

## Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd warehouse-wizard
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Setup**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Database Setup**
```bash
# Make sure MongoDB is running
# Make sure Redis is running (optional, for caching)
```

5. **Start the server**
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Environment Variables

See `.env.example` for all required environment variables.

### Required Variables
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `SMTP_USER` & `SMTP_PASS`: Email configuration

### Optional Variables
- `REDIS_URL`: Redis connection for caching
- `TWILIO_*`: SMS notification configuration

## Database Schema

The system uses MongoDB with Mongoose ODM. Key collections:

- **users**: User accounts and authentication
- **warehouses**: Warehouse facilities and details
- **quotes**: Quote requests and processing
- **bookings**: Confirmed warehouse bookings
- **cargodispatchdetails**: Cargo and inventory tracking
- **deliveryrequests**: Delivery management
- **invoices**: Billing and payments

## Workflow

### Quote to Booking Process
1. Customer creates quote request
2. Purchase Support assigns to warehouse
3. Warehouse provides pricing
4. Sales Support reviews and approves
5. Customer approves final quote
6. Supervisor confirms booking
7. Cargo dispatch and delivery process begins

### Role-Based Dashboards
Each role has a customized dashboard showing relevant information:
- Pending actions
- Status updates
- Role-specific metrics
- Recent activities

## Security Features

- **Authentication**: JWT tokens with expiration
- **Authorization**: Role-based access control
- **Rate Limiting**: Prevent abuse and DoS attacks
- **Input Validation**: Zod schema validation
- **Password Security**: bcrypt hashing with salt
- **CORS**: Configured for frontend domain
- **Headers**: Security headers via Helmet.js

## Performance Optimizations

- **Caching**: Redis for frequently accessed data
- **Database**: Optimized queries and indexes
- **Compression**: Gzip compression for responses
- **Connection Pooling**: MongoDB connection optimization

## Monitoring & Logging

- Request/response logging
- Error tracking
- Performance metrics
- Database query monitoring

## Deployment

### Production Checklist
- [ ] Set strong JWT_SECRET
- [ ] Configure production database
- [ ] Set up email service
- [ ] Configure Redis for caching
- [ ] Set up monitoring
- [ ] Configure reverse proxy (nginx)
- [ ] Set up SSL certificates
- [ ] Configure backup strategy

### Docker Deployment
```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

## API Documentation

For detailed API documentation, import the Postman collection or use tools like Swagger/OpenAPI.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License.